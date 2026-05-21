import { setTimeout, clearTimeout } from "resource://gre/modules/Timer.sys.mjs";

export class LykonShieldChild extends JSWindowActorChild {
  constructor() {
    super();
    this._initialized = false;
    this._cosmeticResources = null;
    this._seenClasses = new Set();
    this._seenIds = new Set();
    this._pendingGenericQuery = null;
    this._pendingHardcodedQuery = null;
    this._destroyed = false;
    this._pendingNodes = [];
    this._firstGenericRunDone = false;
    this._observer = null;
  }

  didDestroy() {
    this._destroyed = true;
    if (this._observer) {
      try {
        this._observer.disconnect();
      } catch (e) {}
      this._observer = null;
    }
    if (this._pendingGenericQuery) {
      clearTimeout(this._pendingGenericQuery);
      this._pendingGenericQuery = null;
    }
    if (this._pendingHardcodedQuery) {
      clearTimeout(this._pendingHardcodedQuery);
      this._pendingHardcodedQuery = null;
    }
  }

  handleEvent(event) {
    if (this._destroyed) return;
    if (event.type === "DOMDocElementInserted") {
      this.init();
    }
  }

  async init() {
    if (this._destroyed) return;
    const url = this.document?.location?.href;
    if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
      return;
    }

    if (this._initialized) return;
    this._initialized = true;

    // 1. Verify if shields are enabled for this site
    try {
      const isEnabled = await this.sendQuery("isShieldEnabled", { url });
      if (this._destroyed) return;
      if (!isEnabled) {
        console.log(
          `[LykonShieldChild] Shields are disabled for ${url}. Skipping cosmetic injection.`
        );
        return;
      }
    } catch (e) {
      console.error("[LykonShieldChild] Failed to verify shield status:", e);
      return;
    }

    if (this._destroyed) return;

    // 2. YouTube Specific Injections
    if (url.includes("youtube.com")) {
      this.injectYouTubeShield();
    }

    // 3. Fetch Cosmetic Resources from Parent
    try {
      this._cosmeticResources = await this.sendQuery("getCosmeticResources", {
        url,
      });
      if (this._destroyed) return;
      if (this._cosmeticResources) {
        this.applyCosmeticResources(this._cosmeticResources);
      }
    } catch (e) {
      console.error("[LykonShield] Failed to get cosmetic resources:", e);
    }

    if (this._destroyed) return;

    // 4. Global Cosmetic Observer (Advanced)
    this.startAdvancedCosmeticObserver();
  }

  injectYouTubeShield() {
    if (this._destroyed || !this.document || !this.document.documentElement)
      return;
    // Overwrite JSON.parse to intercept and strip ads from player response
    const script = this.document.createElement("script");
    script.textContent = `
      (function() {
        const originalParse = JSON.parse;
        JSON.parse = function() {
          const result = originalParse.apply(this, arguments);
          if (result && result.adPlacements) {
            delete result.adPlacements;
          }
          if (result && result.playerAds) {
            delete result.playerAds;
          }
          return result;
        };
        console.log("[LykonShield] YouTube Ad-stripping active");
      })();
    `;
    this.document.documentElement.appendChild(script);
    script.remove();
  }

  applyCosmeticResources(resources) {
    if (this._destroyed || !resources) return;

    if (resources.hide_selectors && resources.hide_selectors.length > 0) {
      this.injectStyle(resources.hide_selectors.join(",\n"), "site-specific");
    }

    if (
      resources.injected_script &&
      this.document &&
      this.document.documentElement
    ) {
      const script = this.document.createElement("script");
      script.textContent = resources.injected_script;
      this.document.documentElement.appendChild(script);
      script.remove();
    }
  }

  injectStyle(selectors, id) {
    if (
      this._destroyed ||
      !selectors ||
      !this.document ||
      !this.document.documentElement
    )
      return;
    const styleId = `lykon-cosmetic-${id}`;
    let style = this.document.getElementById(styleId);
    if (!style) {
      style = this.document.createElement("style");
      style.id = styleId;
      this.document.documentElement.appendChild(style);
    }
    style.textContent = `
      ${selectors} {
        display: none !important;
        visibility: hidden !important;
        height: 0 !important;
        width: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `;
  }

  startAdvancedCosmeticObserver() {
    if (
      this._destroyed ||
      !this.document ||
      !this.document.documentElement ||
      !this.contentWindow
    )
      return;

    // Inject the hardcoded selectors as style ONCE to let the browser CSS engine do the heavy lifting instantly
    const selectors = [
      ".ad-unit",
      ".ad-container",
      ".ad-slot",
      "[class*='ad-slot']",
      "[id*='ad-container']",
      ".sponsored-post",
      ".trc_rbox",
      "#dfp-ad-top",
      ".video-ads",
      ".ytp-ad-module",
      ".aljazeera-ad",
      ".adsbygoogle",
      ".ad-wrapper",
      ".ads",
      ".ads__slot",
      "[class*='adslot']",
      "[id*='adslot']",
      "[class*='ad_slot']",
      "[id*='ad_slot']",
      "[class*='ads__']",
      "iframe[id*='google_ads_iframe']",
      "iframe[id*='ad-slot']",
      "div[class*='-ad-']",
      "div[id*='-ad-']",
      ".adslot300x250ATF",
      ".adslot728x90ATF",
      ".adslot300x600ATF",
    ];
    this.injectStyle(selectors.join(",\n"), "hardcoded");

    // Initial scans
    this.collectClassesAndIds(this.document.documentElement);
    this.queryGenericFilters();
    this.applyHardcodedDimensionRules();

    const observer = new this.contentWindow.MutationObserver(mutations => {
      if (this._destroyed) return;
      let hasAddedElements = false;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1) {
            hasAddedElements = true;
            this._pendingNodes.push(node);
          }
        }
      }
      if (hasAddedElements) {
        this.queryGenericFilters();
      }

      // Debounce the layout-heavy dimension checks to prevent thrashing
      this.scheduleDimensionHiding();
    });
    this._observer = observer;

    observer.observe(this.document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  collectClassesAndIds(root) {
    if (this._destroyed || !root) return false;
    let newFound = false;
    const elements = root.querySelectorAll("*");

    const processElement = el => {
      if (el.id && !this._seenIds.has(el.id)) {
        this._seenIds.add(el.id);
        newFound = true;
      }
      for (const cls of el.classList) {
        if (!this._seenClasses.has(cls)) {
          this._seenClasses.add(cls);
          newFound = true;
        }
      }
    };

    processElement(root);
    for (const el of elements) {
      processElement(el);
    }
    return newFound;
  }

  async queryGenericFilters() {
    if (this._destroyed || this._pendingGenericQuery) return;
    if (this._cosmeticResources?.generichide) return;

    this._pendingGenericQuery = setTimeout(async () => {
      this._pendingGenericQuery = null;
      if (this._destroyed || !this.contentWindow || this.contentWindow.closed)
        return;

      let changed = false;
      const nodes = this._pendingNodes;
      this._pendingNodes = [];

      const processElement = el => {
        if (!el || el.nodeType !== 1) return;
        if (el.id && !this._seenIds.has(el.id)) {
          this._seenIds.add(el.id);
          changed = true;
        }
        for (const cls of el.classList) {
          if (!this._seenClasses.has(cls)) {
            this._seenClasses.add(cls);
            changed = true;
          }
        }
      };

      for (const node of nodes) {
        if (!node.ownerDocument || !node.ownerDocument.defaultView) continue;
        processElement(node);
        for (const child of node.children) {
          processElement(child);
        }
      }

      if (
        !changed &&
        this._seenClasses.size > 0 &&
        this._seenIds.size > 0 &&
        !this._firstGenericRunDone
      ) {
        changed = true;
      }
      this._firstGenericRunDone = true;

      if (!changed) return;

      try {
        const selectors = await this.sendQuery("getHiddenClassIdSelectors", {
          classes: Array.from(this._seenClasses),
          ids: Array.from(this._seenIds),
          exceptions: Array.from(this._cosmeticResources?.exceptions || []),
        });

        if (this._destroyed || !this.contentWindow || this.contentWindow.closed)
          return;

        if (selectors && selectors.length > 0) {
          this.injectStyle(selectors.join(",\n"), "generic");
        }
      } catch (e) {
        console.error("[LykonShield] Generic filter query failed:", e);
      }
    }, 250);
  }

  scheduleDimensionHiding() {
    if (this._destroyed || this._pendingHardcodedQuery) return;
    this._pendingHardcodedQuery = setTimeout(() => {
      this._pendingHardcodedQuery = null;
      if (this._destroyed || !this.contentWindow || this.contentWindow.closed)
        return;
      this.applyHardcodedDimensionRules();
    }, 400);
  }

  applyHardcodedDimensionRules() {
    if (this._destroyed || !this.document || !this.document.defaultView) return;
    try {
      const AD_DIMENSIONS = [
        { w: 300, h: 250 },
        { w: 728, h: 90 },
        { w: 160, h: 600 },
        { w: 300, h: 600 },
        { w: 970, h: 250 },
        { w: 320, h: 50 },
        { w: 336, h: 280 },
      ];

      const divs = this.document.querySelectorAll("div, ins, aside");
      let hiddenCount = 0;
      for (const div of divs) {
        if (div.style.display === "none") continue;

        const hasInlineDimensions = div.style.width || div.style.height;
        const isInsOrAside = div.tagName === "INS" || div.tagName === "ASIDE";
        const hasAdKeywords = /ad|sponsor|promo/i.test(
          div.className + " " + div.id
        );
        const hasIframe =
          div.children.length === 1 && div.children[0].tagName === "IFRAME";

        if (
          !hasInlineDimensions &&
          !isInsOrAside &&
          !hasAdKeywords &&
          !hasIframe
        ) {
          continue;
        }

        if (
          div.children.length === 0 ||
          (div.children.length === 1 && div.children[0].tagName === "IFRAME")
        ) {
          const style = this.document.defaultView.getComputedStyle(div);
          const w = parseInt(style.width);
          const h = parseInt(style.height);

          for (const dim of AD_DIMENSIONS) {
            if (Math.abs(w - dim.w) < 5 && Math.abs(h - dim.h) < 5) {
              div.style.setProperty("display", "none", "important");
              hiddenCount++;
              break;
            }
          }
        }
      }
      if (hiddenCount > 0) {
        console.log(
          `[LykonShieldChild] Dimension check hid ${hiddenCount} empty ad containers`
        );
      }
    } catch (e) {
      console.error("[LykonShieldChild] Dimension check failed:", e);
    }
  }
}
