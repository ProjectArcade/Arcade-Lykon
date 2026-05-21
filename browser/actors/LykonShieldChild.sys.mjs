import {
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
} from "resource://gre/modules/Timer.sys.mjs";

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
    this._playerInterval = null;
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
    if (this._playerInterval) {
      try {
        clearInterval(this._playerInterval);
      } catch (e) {}
      this._playerInterval = null;
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
    let isEnabled = true;
    try {
      isEnabled = await this.sendQuery("isShieldEnabled", { url });
    } catch (e) {
      console.warn(
        "[LykonShieldChild] Failed to verify shield status, defaulting to true:",
        e
      );
    }

    if (this._destroyed) return;
    if (!isEnabled) {
      console.log(
        `[LykonShieldChild] Shields are disabled for ${url}. Skipping cosmetic injection.`
      );
      return;
    }

    if (this._destroyed) return;

    // 2. YouTube Specific Injections
    if (
      url.includes("youtube.com") &&
      !url.includes("live_chat") &&
      !url.includes("live_chat_replay")
    ) {
      this.injectYouTubeShield();
      this.startPlayerObserver();
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
    if (this._destroyed || !this.document || !this.document.documentElement) {
      return;
    }

    const win = this.contentWindow;

    const adStyle = this.document.createElement("style");
    adStyle.id = "lykon-yt-ad-css";
    adStyle.textContent = `
      .video-ads,
      .ytp-ad-module,
      .ytp-ad-overlay-container,
      .ytp-ad-text-overlay,
      .ytp-ad-overlay-close-container,
      .ytp-ad-overlay-slot,
      .ytp-ad-image-overlay,
      .ad-showing .ytp-ad-player-overlay,
      .ad-showing .ytp-ad-player-overlay-instream-info,
      .ytp-ad-skip-button-container,
      .ytp-ad-preview-container,
      .ytp-ad-message-container,
      .ytp-ad-persistent-progress-bar-container,
      .ytp-ad-visit-advertiser-button,
      #player-ads,
      #masthead-ad,
      ytd-ad-slot-renderer,
      ytd-banner-promo-renderer,
      ytd-statement-banner-renderer,
      ytd-in-feed-ad-layout-renderer,
      ytd-promoted-sparkles-web-renderer,
      ytd-display-ad-renderer,
      ytd-promoted-video-renderer,
      ytd-compact-promoted-video-renderer,
      ytd-action-companion-ad-renderer,
      ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"],
      #related ytd-promoted-sparkles-web-renderer,
      tp-yt-paper-dialog:has(ytd-enforcement-message-view-model),
      ytd-popup-container:has(ytd-enforcement-message-view-model),
      ytd-mealbar-promo-renderer,
      .ytd-merch-shelf-renderer,
      ytd-merch-shelf-renderer {
        display: none !important;
      }
    `;
    this.document.documentElement.appendChild(adStyle);

    const xrayedWin = Cu.waiveXrays(win);

    const AD_PROPERTIES = [
      "adPlacements",
      "playerAds",
      "adSlots",
      "adBreakHeartbeatParams",
      "adBreakParams",
      "adModule",
      "adInfoRenderer",
      "instreamVideoAdRenderer",
      "linearAdSequenceRenderer",
      "adPlacementRenderer",
      "adLayoutLoggingData",
      "actionCompanionAdRenderer",
      "adPlacementConfig",
      "adVideoId",
      "advertisedVideo",
      "promotedSparklesWebRenderer",
      "adInfoDialogEndpoint",
      "adHoverTextButtonRenderer",
      "aboutThisAdRenderer",
      "adFeedbackEndpoint",
      "adLayoutMetadata",
      "adInstrumentation",
      "instreamAdPlayerOverlayRenderer",
      "linearAdSequenceRenderer",
      "playerLegacyDesktopWatchAdsRenderer",
      "remoteSlotsToImpression",
    ];

    const AD_RENDERERS = [
      "adSlotRenderer",
      "promotedSparklesWebRenderer",
      "compactPromotedVideoRenderer",
      "mastheadAd",
      "bannerPromoRenderer",
      "statementBannerRenderer",
      "inFeedAdLayoutRenderer",
      "displayAdRenderer",
      "promotedVideoRenderer",
      "compactPromotedVideoRenderer",
      "actionCompanionAdRenderer",
      "merchShelfRenderer",
    ];

    const cleanObject = rawObj => {
      try {
        if (!rawObj || typeof rawObj !== "object") {
          return rawObj;
        }
        const obj = Cu.waiveXrays(rawObj);

        if (Array.isArray(obj)) {
          for (let i = obj.length - 1; i >= 0; i--) {
            const item = obj[i];
            if (item && typeof item === "object") {
              const waivedItem = Cu.waiveXrays(item);
              const shouldRemove = AD_RENDERERS.some(key => key in waivedItem);
              if (shouldRemove) {
                obj.splice(i, 1);
              } else {
                cleanObject(waivedItem);
              }
            }
          }
          return obj;
        }

        if (obj.playabilityStatus) {
          const playabilityStatus = Cu.waiveXrays(obj.playabilityStatus);
          if (
            playabilityStatus.status === "ERROR" ||
            playabilityStatus.status === "LOGIN_REQUIRED"
          ) {
            // Leave legitimate errors alone
          } else if (playabilityStatus.errorScreen) {
            try {
              const errorScreen = Cu.waiveXrays(playabilityStatus.errorScreen);
              const errStr = JSON.stringify(errorScreen);
              if (
                errStr.includes("enforcement") ||
                errStr.includes("adblock") ||
                errStr.includes("block")
              ) {
                delete playabilityStatus.errorScreen;
                playabilityStatus.status = "OK";
              }
            } catch (e) {}
          }
        }

        for (const key of AD_PROPERTIES) {
          if (key in obj) {
            delete obj[key];
          }
        }
        for (const key of AD_RENDERERS) {
          if (key in obj) {
            delete obj[key];
          }
        }

        for (const key in obj) {
          try {
            const val = obj[key];
            if (val && typeof val === "object") {
              cleanObject(val);
            }
          } catch (e) {}
        }
      } catch (e) {}
      return rawObj;
    };

    const getterPlayer = Cu.exportFunction(function () {
      return win.__lykon_ytInitialPlayerResponse;
    }, win);
    const setterPlayer = Cu.exportFunction(function (val) {
      try {
        if (val) {
          cleanObject(val);
        }
      } catch (e) {}
      win.__lykon_ytInitialPlayerResponse = val;
    }, win);

    Object.defineProperty(xrayedWin, "ytInitialPlayerResponse", {
      get: getterPlayer,
      set: setterPlayer,
      configurable: true,
      enumerable: true,
    });

    if (win.ytInitialPlayerResponse) {
      try {
        cleanObject(win.ytInitialPlayerResponse);
      } catch (e) {}
      win.__lykon_ytInitialPlayerResponse = win.ytInitialPlayerResponse;
    }

    const getterData = Cu.exportFunction(function () {
      return win.__lykon_ytInitialData;
    }, win);
    const setterData = Cu.exportFunction(function (val) {
      try {
        if (val) {
          cleanObject(val);
        }
      } catch (e) {}
      win.__lykon_ytInitialData = val;
    }, win);

    Object.defineProperty(xrayedWin, "ytInitialData", {
      get: getterData,
      set: setterData,
      configurable: true,
      enumerable: true,
    });

    if (win.ytInitialData) {
      try {
        cleanObject(win.ytInitialData);
      } catch (e) {}
      win.__lykon_ytInitialData = win.ytInitialData;
    }

    const getterReel = Cu.exportFunction(function () {
      return win.__lykon_ytInitialReelResponse;
    }, win);
    const setterReel = Cu.exportFunction(function (val) {
      try {
        if (val) {
          cleanObject(val);
        }
      } catch (e) {}
      win.__lykon_ytInitialReelResponse = val;
    }, win);

    Object.defineProperty(xrayedWin, "ytInitialReelResponse", {
      get: getterReel,
      set: setterReel,
      configurable: true,
      enumerable: true,
    });

    if (win.ytInitialReelResponse) {
      try {
        cleanObject(win.ytInitialReelResponse);
      } catch (e) {}
      win.__lykon_ytInitialReelResponse = win.ytInitialReelResponse;
    }

    Object.defineProperty(win, "__lykon_originalParse", {
      value: win.JSON.parse,
      writable: false,
      configurable: false,
      enumerable: false,
    });
    Object.defineProperty(win, "__lykon_originalFetch", {
      value: win.fetch,
      writable: false,
      configurable: false,
      enumerable: false,
    });
    Object.defineProperty(win, "__lykon_originalXhrOpen", {
      value: win.XMLHttpRequest.prototype.open,
      writable: false,
      configurable: false,
      enumerable: false,
    });
    Object.defineProperty(win, "__lykon_originalXhrSend", {
      value: win.XMLHttpRequest.prototype.send,
      writable: false,
      configurable: false,
      enumerable: false,
    });

    const customParse = Cu.exportFunction(function (text, reviver) {
      try {
        let result = win.__lykon_originalParse.call(win.JSON, text, reviver);
        if (result && typeof result === "object") {
          cleanObject(result);
        }
        return result;
      } catch (e) {
        return win.__lykon_originalParse.call(win.JSON, text, reviver);
      }
    }, win);
    xrayedWin.JSON.parse = customParse;

    const customFetch = Cu.exportFunction(function (input, init) {
      let url = "";
      if (typeof input === "string") {
        url = input;
      } else if (input) {
        try {
          url = Cu.waiveXrays(input).url || "";
        } catch (e) {}
      }
      const promise = win.__lykon_originalFetch.call(win, input, init);

      const cleanFetchCallback = Cu.exportFunction(function (response) {
        try {
          if (url.includes("/youtubei/") || url.includes("/api/")) {
            const ct = response.headers.get("content-type") || "";
            if (ct.includes("application/json")) {
              const textPromise = response.clone().text();
              const textCallback = Cu.exportFunction(function (text) {
                try {
                  let data = win.__lykon_originalParse(text);
                  cleanObject(data);
                  const headersObj = {};
                  for (const [k, v] of response.headers.entries()) {
                    headersObj[k] = v;
                  }
                  const newResponse = new xrayedWin.Response(
                    JSON.stringify(data),
                    Cu.cloneInto(
                      {
                        status: response.status,
                        statusText: response.statusText,
                        headers: headersObj,
                      },
                      win
                    )
                  );
                  return newResponse;
                } catch (e) {
                  return response;
                }
              }, win);
              return textPromise.then(textCallback).catch(() => response);
            }
          }
        } catch (e) {}
        return response;
      }, win);

      return promise.then(cleanFetchCallback);
    }, win);
    xrayedWin.fetch = customFetch;

    const originalXhrOpen = win.XMLHttpRequest.prototype.open;
    const originalXhrSend = win.XMLHttpRequest.prototype.send;

    const customXhrOpen = Cu.exportFunction(function (
      method,
      url,
      async,
      user,
      password
    ) {
      try {
        this._lykonUrl = url || "";
      } catch (e) {}
      return win.__lykon_originalXhrOpen.call(
        this,
        method,
        url,
        async,
        user,
        password
      );
    }, win);

    const customXhrSend = Cu.exportFunction(function (body) {
      try {
        if (this._lykonUrl && this._lykonUrl.includes("/youtubei/")) {
          const onReadyStateCallback = Cu.exportFunction(function () {
            try {
              if (this.readyState === 4) {
                const ct = this.getResponseHeader("content-type") || "";
                if (ct.includes("application/json") && this.responseText) {
                  let data = win.__lykon_originalParse(this.responseText);
                  cleanObject(data);
                  Object.defineProperty(
                    this,
                    "responseText",
                    Cu.cloneInto(
                      {
                        writable: true,
                        value: JSON.stringify(data),
                      },
                      win
                    )
                  );
                  Object.defineProperty(
                    this,
                    "response",
                    Cu.cloneInto(
                      {
                        writable: true,
                        value: JSON.stringify(data),
                      },
                      win
                    )
                  );
                }
              }
            } catch (e) {}
          }, win);
          this.addEventListener("readystatechange", onReadyStateCallback);
        }
      } catch (e) {}
      return win.__lykon_originalXhrSend.call(this, body);
    }, win);

    xrayedWin.XMLHttpRequest.prototype.open = customXhrOpen;
    xrayedWin.XMLHttpRequest.prototype.send = customXhrSend;
  }

  startPlayerObserver() {
    if (this._destroyed || !this.document) return;

    const checkAd = () => {
      if (this._destroyed || !this.document) return;
      const player = this.document.querySelector("#movie_player");
      if (!player) return;

      // Skip ad button
      const skipBtn = player.querySelector(
        '.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, [class*="skip-button"]'
      );
      if (skipBtn) {
        try {
          skipBtn.click();
        } catch (e) {}
        return;
      }

      // If ad is playing, try to fast-forward and mute
      const video = player.querySelector("video");
      if (video && player.classList.contains("ad-showing")) {
        try {
          video.muted = true;
          video.currentTime = video.duration || 999;
          video.playbackRate = 16;
        } catch (e) {}
      }
    };

    if (this._playerInterval) {
      try {
        clearInterval(this._playerInterval);
      } catch (e) {}
    }
    this._playerInterval = setInterval(checkAd, 300);
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
      ".sponsored-post",
      ".trc_rbox",
      "#dfp-ad-top",
      ".aljazeera-ad",
      ".adsbygoogle",
      ".ad-wrapper",
      ".ads",
      ".ads__slot",
      "iframe[id*='google_ads_iframe']",
      "iframe[id*='ad-slot']",
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
