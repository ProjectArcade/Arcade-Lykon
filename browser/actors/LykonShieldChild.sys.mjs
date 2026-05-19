export class LykonShieldChild extends JSWindowActorChild {
  constructor() {
    super();
    this._initialized = false;
    this._cosmeticResources = null;
    this._seenClasses = new Set();
    this._seenIds = new Set();
    this._pendingGenericQuery = null;
  }

  handleEvent(event) {
    if (event.type === "DOMDocElementInserted") {
      this.init();
    }
  }

  async init() {
    if (this._initialized) return;
    this._initialized = true;

    const url = this.document.location.href;

    // 1. YouTube Specific Injections
    if (url.includes("youtube.com")) {
      this.injectYouTubeShield();
    }

    // 2. Fetch Cosmetic Resources from Parent
    try {
      this._cosmeticResources = await this.sendQuery("getCosmeticResources", { url });
      if (this._cosmeticResources) {
        this.applyCosmeticResources(this._cosmeticResources);
      }
    } catch (e) {
      console.error("[LykonShield] Failed to get cosmetic resources:", e);
    }

    // 3. Global Cosmetic Observer (Advanced)
    this.startAdvancedCosmeticObserver();
  }

  injectYouTubeShield() {
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
    if (!resources) return;

    if (resources.hide_selectors && resources.hide_selectors.length > 0) {
      this.injectStyle(resources.hide_selectors.join(",\n"), "site-specific");
    }

    if (resources.injected_script) {
      const script = this.document.createElement("script");
      script.textContent = resources.injected_script;
      this.document.documentElement.appendChild(script);
      script.remove();
    }
  }

  injectStyle(selectors, id) {
    if (!selectors) return;
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
    // Initial scan
    this.collectClassesAndIds(this.document.documentElement);
    this.queryGenericFilters();

    const observer = new this.contentWindow.MutationObserver(mutations => {
      let changed = false;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1) { // Element
            if (this.collectClassesAndIds(node)) {
              changed = true;
            }
          }
        }
      }
      if (changed) {
        this.queryGenericFilters();
      }
      
      // Fallback: apply hardcoded rules too
      this.applyHardcodedRules();
    });

    observer.observe(this.document.documentElement, {
      childList: true,
      subtree: true
    });
    
    this.applyHardcodedRules();
  }

  collectClassesAndIds(root) {
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
    if (this._pendingGenericQuery) return;
    if (this._cosmeticResources?.generichide) return;

    this._pendingGenericQuery = this.contentWindow.setTimeout(async () => {
      this._pendingGenericQuery = null;
      try {
        const selectors = await this.sendQuery("getHiddenClassIdSelectors", {
          classes: Array.from(this._seenClasses),
          ids: Array.from(this._seenIds),
          exceptions: Array.from(this._cosmeticResources?.exceptions || [])
        });

        if (selectors && selectors.length > 0) {
          this.injectStyle(selectors.join(",\n"), "generic");
        }
      } catch (e) {
        console.error("[LykonShield] Generic filter query failed:", e);
      }
    }, 100); // Batch queries
  }

  applyHardcodedRules() {
    const selectors = [
      ".ad-unit", ".ad-container", ".ad-slot", "[class*='ad-slot']",
      "[id*='ad-container']", ".sponsored-post", ".trc_rbox",
      "#dfp-ad-top", ".video-ads", ".ytp-ad-module",
      ".aljazeera-ad", ".adsbygoogle", ".ad-wrapper",
      ".ads", ".ads__slot", "[class*='adslot']", "[id*='adslot']",
      "[class*='ad_slot']", "[id*='ad_slot']", "[class*='ads__']",
      "iframe[id*='google_ads_iframe']", "iframe[id*='ad-slot']",
      "div[class*='-ad-']", "div[id*='-ad-']",
      ".adslot300x250ATF", ".adslot728x90ATF", ".adslot300x600ATF"
    ];

    for (const selector of selectors) {
      const elements = this.document.querySelectorAll(selector);
      for (const el of elements) {
        el.style.setProperty("display", "none", "important");
      }
    }

    // Dimension-based hiding for empty containers
    const AD_DIMENSIONS = [
      { w: 300, h: 250 }, { w: 728, h: 90 }, { w: 160, h: 600 },
      { w: 300, h: 600 }, { w: 970, h: 250 }, { w: 320, h: 50 },
      { w: 336, h: 280 }
    ];

    const divs = this.document.querySelectorAll("div, ins, aside");
    for (const div of divs) {
      if (div.children.length === 0 || (div.children.length === 1 && div.children[0].tagName === "IFRAME")) {
        const style = this.document.defaultView.getComputedStyle(div);
        const w = parseInt(style.width);
        const h = parseInt(style.height);
        
        for (const dim of AD_DIMENSIONS) {
          if (Math.abs(w - dim.w) < 5 && Math.abs(h - dim.h) < 5) {
            div.style.setProperty("display", "none", "important");
            break;
          }
        }
      }
    }
  }
}
