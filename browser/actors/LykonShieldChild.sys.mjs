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

  _isBenignError(e) {
    if (this._destroyed) return true;
    const errMsg = (e?.message || String(e) || "").toLowerCase();
    const errName = (e?.name || "").toLowerCase();
    return (
      errName.includes("abort") ||
      errName.includes("invalidstate") ||
      errMsg.includes("destroyed") ||
      errMsg.includes("cannot send") ||
      errMsg.includes("not available")
    );
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
      const doc = event.originalTarget;
      if (doc && doc.defaultView === this.contentWindow) {
        this.init();
      }
    }
  }

  init() {
    if (this._destroyed) return;
    const doc = this.document;
    if (
      !doc ||
      !doc.documentElement ||
      doc.defaultView !== this.contentWindow
    ) {
      return;
    }
    if (doc.defaultView.closed) {
      return;
    }
    if (
      doc.contentType !== "text/html" &&
      doc.contentType !== "application/xhtml+xml"
    ) {
      return;
    }

    const url = doc.location?.href;
    if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
      return;
    }

    if (this._initialized) return;
    this._initialized = true;

    if (this._needsPageHooks(url)) {
      this.setupSynchronousHooks(url);
    }

    if (this._needsAsyncInit(url)) {
      this.initAsync(url).catch(e => {
        if (!this._isBenignError(e)) {
          console.error("[LykonShieldChild] Error in initAsync:", e);
        }
      });
    }
  }

  _isYouTubeContent(url) {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return (
        hostname === "www.youtube.com" ||
        hostname === "m.youtube.com" ||
        hostname === "youtube.com"
      );
    } catch (e) {
      return false;
    }
  }

  _needsPageHooks(url) {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      const hookDomains = [
        "hianime.ms",
        "pornhub.com",
        "pornhub.org",
        "klrtspet.net",
        "xvideos.com",
        "xnxx.com",
        "xhamster.com",
        "spankbang.com",
        "fmovies.to",
        "123movies.ai",
        "putlocker.vip",
        "soap2day.to",
        "gomovies.sx",
        "solarmovie.pe",
        "1337x.to",
        "nyaa.si",
        "rarbg.to",
        "yts.mx",
        "piratebay.org",
        "thepiratebay.org",
      ];
      return hookDomains.some(
        domain => hostname === domain || hostname.endsWith("." + domain)
      );
    } catch (e) {
      return false;
    }
  }

  _needsAsyncInit(url) {
    if (this._isYouTubeContent(url)) {
      return true;
    }
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      const skipDomains = [
        [/google\.[a-z.]{2,6}$/, true],
        [/gstatic\.com$/, true],
        [/googleapis\.com$/, true],
        [/googleusercontent\.com$/, true],
        [/microsoft\.com$/, true],
        [/microsoftonline\.com$/, true],
        [/live\.com$/, true],
        [/outlook\.com$/, true],
        [/office\.com$/, true],
        [/office365\.com$/, true],
        [/apple\.com$/, true],
        [/icloud\.com$/, true],
        [/github\.com$/, true],
        [/githubusercontent\.com$/, true],
        [/amazon\.[a-z.]{2,6}$/, true],
        [/amazonaws\.com$/, true],
        [/facebook\.com$/, true],
        [/instagram\.com$/, true],
        [/twitter\.com$/, true],
        [/x\.com$/, true],
        [/discord\.com$/, true],
        [/netflix\.com$/, true],
        [/spotify\.com$/, true],
        [/wikipedia\.org$/, true],
        [/youtube\.com$/, true],
        [/ytimg\.com$/, true],
        [/cloudflare\.com$/, true],
        [/mozilla\.(org|com)$/, true],
      ];
      return !skipDomains.some(([regex]) => regex.test(hostname));
    } catch (e) {
      return false;
    }
  }

  setupSynchronousHooks(url) {
    try {
      const doc = this.document;
      if (
        !doc ||
        !doc.documentElement ||
        doc.defaultView !== this.contentWindow
      ) {
        return;
      }
      const win = this.contentWindow;
      if (!win || win.closed) {
        return;
      }

      let enablePropertyHooks = false;
      try {
        const hostname = new URL(url).hostname.toLowerCase();
        const antiAdblockDomains = [
          "hianime.ms",
          "pornhub.com",
          "pornhub.org",
          "klrtspet.net",
        ];
        enablePropertyHooks = antiAdblockDomains.some(
          domain => hostname === domain || hostname.endsWith("." + domain)
        );
      } catch (e) {}

      const scriptText = `(function(enablePropertyHooks) {
        const checkAndBlockUrl = function(urlStr) {
          try {
            if (!urlStr || urlStr === "" || urlStr === "about:blank") {
              return false;
            }
            
            const currentHost = window.location?.hostname || "";
            let targetHost = "";
            try {
              targetHost = new URL(urlStr, window.location.href).hostname.toLowerCase();
            } catch (e) {
              targetHost = urlStr;
            }

            const getBaseDomain = host => {
              const parts = host.split(".");
              if (parts.length >= 2) {
                return parts.slice(-2).join(".");
              }
              return host;
            };

            const currentBase = getBaseDomain(currentHost).toLowerCase();
            const targetBase = getBaseDomain(targetHost).toLowerCase();

            const isUserActivated = navigator?.userActivation?.isActive;

            const isLegitimate = (() => {
              let parsedUrl = null;
              try {
                parsedUrl = new URL(urlStr, window.location.href);
              } catch (e) {}

              if (parsedUrl) {
                const sParams = parsedUrl.searchParams;
                const oauthKeys = [
                  "client_id", "redirect_uri", "response_type", "state", "scope",
                  "code", "access_token", "id_token", "samlrequest", "samlresponse",
                  "openid", "login_hint", "nonce", "checkout_id", "payment_intent",
                  "return_url", "cancel_url", "success_url"
                ];
                for (const key of oauthKeys) {
                  if (sParams.has(key)) return true;
                }
              }

              if (parsedUrl) {
                const path = parsedUrl.pathname.toLowerCase();
                const pathKeywords = [
                  "/oauth", "/auth", "/login", "/signin", "/checkout", "/pay",
                  "/sso", "/register", "/signup", "/sign-in", "/sign-up", "/log-in",
                  "/authorize", "/billing", "/subscribe", "/identity", "/accounts",
                  "/verification", "/security", "/portal", "/wallet", "/connect",
                  "/callback", "/token", "/session"
                ];
                if (pathKeywords.some(kw => path.includes(kw))) return true;
              } else {
                const pathKeywords = [
                  "oauth", "auth", "login", "signin", "checkout", "pay", "sso", "register"
                ];
                if (pathKeywords.some(kw => urlStr.includes(kw))) return true;
              }

              const hostToCheck = parsedUrl ? parsedUrl.hostname.toLowerCase() : targetHost.toLowerCase();
              const hostSegments = hostToCheck.split(".");
              const ssoDomains = [
                "google", "github", "apple", "microsoft", "microsoftonline", "live",
                "office", "facebook", "fb", "twitter", "x", "discord", "discordapp",
                "okta", "auth0", "stripe", "paypal", "amazon", "linkedin", "shopify",
                "coinbase", "keycloak", "clerk"
              ];
              if (hostSegments.some(seg => ssoDomains.includes(seg) || seg === "auth" || seg === "login" || seg === "sso")) {
                return true;
              }
              return false;
            })();

            const isAdUrl =
              urlStr.includes("traffic") ||
              urlStr.includes("click") ||
              urlStr.includes("eta") ||
              urlStr.includes("pop") ||
              urlStr.includes("adserver") ||
              urlStr.includes("adsystem") ||
              urlStr.includes("adservices") ||
              urlStr.includes("popunder") ||
              urlStr.includes("redirect=") ||
              urlStr.includes("klrtspet") ||
              urlStr.includes("etahub") ||
              urlStr.includes("adsterra") ||
              urlStr.includes("exoclick") ||
              urlStr.includes("onclickads") ||
              urlStr.includes("juicyads") ||
              urlStr.includes("condles-temark") ||
              urlStr.includes("tentedienat") ||
              urlStr.includes("bodegashunlike") ||
              urlStr.includes("statlytic") ||
              urlStr.includes("ssp=adcash") ||
              urlStr.includes("adcash") ||
              urlStr.includes("cost=");

            if (!isLegitimate) {
              if (!isUserActivated || isAdUrl) {
                return true;
              } else if (targetBase && currentBase && targetBase !== currentBase) {
                const isSuspicious =
                  urlStr.includes("zone_id=") ||
                  urlStr.includes("zoneid=") ||
                  urlStr.includes("popup") ||
                  urlStr.includes("popunder") ||
                  urlStr.includes("banner") ||
                  urlStr.includes("ad_id") ||
                  urlStr.includes("adid=") ||
                  urlStr.includes("ssp=") ||
                  urlStr.includes("cost=");
                if (isSuspicious) {
                  return true;
                }
              }
            }
          } catch (e) {}
          return false;
        };

        try {
          const originalUA = navigator.userAgent || "";
          if (originalUA.includes("Lykon") || originalUA.includes("Firefox/115.0")) {
            let targetUA = originalUA.replace(/Lykon\\/[0-9.]+/gi, "").trim();
            if (targetUA.includes("Firefox/")) {
              targetUA = targetUA.replace(/rv:109\\.0/gi, "rv:130.0");
              targetUA = targetUA.replace(/Firefox\\/115\\.0/gi, "Firefox/130.0");
            } else {
              targetUA = targetUA + " Firefox/130.0";
            }
            let targetAppVersion = navigator.appVersion || "";
            if (targetAppVersion.includes("Lykon")) {
              targetAppVersion = targetAppVersion.replace(/Lykon\\/[0-9.]+/gi, "").trim();
            }
            
            Object.defineProperty(navigator, "userAgent", {
              get() { return targetUA; },
              configurable: true,
              enumerable: true
            });
            Object.defineProperty(navigator, "appVersion", {
              get() { return targetAppVersion; },
              configurable: true,
              enumerable: true
            });
          }
        } catch (e) {}

        try {
          const originalOpen = window.open;
          if (originalOpen) {
            window.open = function(urlParam, name, features) {
              try {
                const urlStr = String(urlParam || "").trim().toLowerCase();
                if (checkAndBlockUrl(urlStr)) {
                  return new Proxy({}, {
                    get() {
                      return function() {};
                    }
                  });
                }
              } catch (e) {}
              return originalOpen.call(window, urlParam, name, features);
            };
          }
        } catch (e) {}

        try {
          document.addEventListener("click", function(event) {
            try {
              let target = event.target;
              while (target && target.tagName !== "A") {
                target = target.parentNode;
              }
              if (target && target.href) {
                const urlStr = String(target.href).trim().toLowerCase();
                if (checkAndBlockUrl(urlStr)) {
                  event.preventDefault();
                  event.stopPropagation();
                }
              }
            } catch (e) {}
          }, true);
        } catch (e) {}

        try {
          if (window.HTMLAnchorElement) {
            const originalClick = HTMLAnchorElement.prototype.click;
            HTMLAnchorElement.prototype.click = function() {
              try {
                if (this.href) {
                  const urlStr = String(this.href).trim().toLowerCase();
                  if (checkAndBlockUrl(urlStr)) {
                    return;
                  }
                }
              } catch (e) {}
              return originalClick.call(this);
            };
          }
        } catch (e) {}

        if (enablePropertyHooks) {
          try {
            const originalDefineProperty = Object.defineProperty;
            if (originalDefineProperty) {
              Object.defineProperty = function(obj, prop, descriptor) {
                try {
                  if (obj === window || prop === "VueComponents") {
                    if (descriptor && typeof descriptor === "object") {
                      try {
                        descriptor.configurable = true;
                      } catch (e) {
                        descriptor = Object.assign({}, descriptor, { configurable: true });
                      }
                    }
                  }
                } catch (e) {}
                return originalDefineProperty.call(Object, obj, prop, descriptor);
              };
            }

            const originalDefineProperties = Object.defineProperties;
            if (originalDefineProperties) {
              Object.defineProperties = function(obj, props) {
                try {
                  if (props && typeof props === "object") {
                    for (const key of Object.keys(props)) {
                      const desc = props[key];
                      if (desc && typeof desc === "object" && (obj === window || key === "VueComponents")) {
                        try {
                          desc.configurable = true;
                        } catch (e) {
                          props[key] = Object.assign({}, desc, { configurable: true });
                        }
                      }
                    }
                  }
                } catch (e) {}
                return originalDefineProperties.call(Object, obj, props);
              };
            }

            const originalReflectDefineProperty = Reflect?.defineProperty;
            if (originalReflectDefineProperty) {
              Reflect.defineProperty = function(obj, prop, descriptor) {
                try {
                  if (obj === window || prop === "VueComponents") {
                    if (descriptor && typeof descriptor === "object") {
                      try {
                        descriptor.configurable = true;
                      } catch (e) {
                        descriptor = Object.assign({}, descriptor, { configurable: true });
                      }
                    }
                  }
                } catch (e) {}
                return originalReflectDefineProperty.call(Reflect, obj, prop, descriptor);
              };
            }
          } catch (e) {}
        }
      })(${enablePropertyHooks});`;

      const script = doc.createElementNS(
        "http://www.w3.org/1999/xhtml",
        "script"
      );
      script.textContent = scriptText;
      doc.documentElement.appendChild(script);
      script.remove();
    } catch (e) {
      console.error("[LykonShieldChild] Failed to setup native hooks:", e);
    }
  }

  async initAsync(url) {
    try {
      const isSystemDark = await this.sendQuery("isSystemDarkTheme");
      if (this._destroyed || !this.contentWindow || this.contentWindow.closed)
        return;
      const win = this.contentWindow;
      if (win && win.matchMedia && !this._isYouTubeContent(url)) {
        const originalMatchMedia = win.matchMedia;
        win.matchMedia = Cu.exportFunction(function (query) {
          const mql = originalMatchMedia.call(win, query);
          if (
            typeof query === "string" &&
            query.includes("prefers-color-scheme")
          ) {
            const lowerQuery = query.toLowerCase();
            let matches = mql.matches;
            if (lowerQuery.includes("dark")) {
              matches = isSystemDark;
            } else if (lowerQuery.includes("light")) {
              matches = !isSystemDark;
            }
            return new win.Proxy(mql, {
              get(target, prop, receiver) {
                if (prop === "matches") {
                  return matches;
                }
                const val = target[prop];
                if (typeof val === "function") {
                  return val.bind(target);
                }
                return val;
              },
            });
          }
          return mql;
        }, win);
      }
    } catch (e) {
      if (!this._isBenignError(e)) {
        console.error(
          "[LykonShieldChild] Failed to setup prefers-color-scheme spoofing:",
          e
        );
      }
    }

    let isEnabled = true;
    try {
      isEnabled = await this.sendQuery("isShieldEnabled", { url });
    } catch (e) {
      if (!this._isBenignError(e)) {
        console.warn(
          "[LykonShieldChild] Failed to verify shield status, defaulting to true:",
          e
        );
      }
    }

    if (this._destroyed || !this.contentWindow || this.contentWindow.closed)
      return;
    if (!isEnabled) {
      console.log(
        `[LykonShieldChild] Shields are disabled for ${url}. Skipping cosmetic injection.`
      );
      return;
    }

    if (this._destroyed || !this.contentWindow || this.contentWindow.closed)
      return;

    if (
      this._isYouTubeContent(url) &&
      !url.includes("live_chat") &&
      !url.includes("live_chat_replay")
    ) {
      this.injectYouTubeShield();
      this.startPlayerObserver();
    }

    try {
      this._cosmeticResources = await this.sendQuery("getCosmeticResources", {
        url,
      });
      if (this._destroyed || !this.contentWindow || this.contentWindow.closed)
        return;
      if (this._cosmeticResources) {
        this.applyCosmeticResources(this._cosmeticResources);
      }
    } catch (e) {
      if (!this._isBenignError(e)) {
        console.error("[LykonShield] Failed to get cosmetic resources:", e);
      }
    }

    if (this._destroyed || !this.contentWindow || this.contentWindow.closed)
      return;

    if (!this._isYouTubeContent(url)) {
      this.startAdvancedCosmeticObserver();
    }
  }

  injectYouTubeShield() {
    if (this._destroyed || !this.document || !this.document.documentElement) {
      return;
    }

    const win = this.contentWindow;
    if (!win || win.closed) {
      return;
    }

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

    const nativeFetch = xrayedWin.fetch;
    const nativeXhrOpen = xrayedWin.XMLHttpRequest.prototype.open;
    const nativeXhrSend = xrayedWin.XMLHttpRequest.prototype.send;
    const nativeParse = xrayedWin.JSON.parse;

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

    const adKeywords = [
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
      "playerLegacyDesktopWatchAdsRenderer",
      "remoteSlotsToImpression",
      "adSlotRenderer",
      "compactPromotedVideoRenderer",
      "mastheadAd",
      "bannerPromoRenderer",
      "statementBannerRenderer",
      "inFeedAdLayoutRenderer",
      "displayAdRenderer",
      "promotedVideoRenderer",
      "merchShelfRenderer",
      "enforcement",
      "adblock",
      "ytd-enforcement",
    ];

    const customParse = Cu.exportFunction(function (text, reviver) {
      try {
        let result = nativeParse(text, reviver);
        if (result && typeof result === "object" && typeof text === "string") {
          const hasAd = adKeywords.some(kw => text.includes(kw));
          if (hasAd) {
            cleanObject(result);
          }
        }
        return result;
      } catch (e) {
        return nativeParse(text, reviver);
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

      let promise = nativeFetch(input, init);

      const cleanFetchCallback = Cu.exportFunction(function (response) {
        try {
          const isTarget =
            url.includes("/youtubei/v1/player") ||
            url.includes("/youtubei/v1/next") ||
            url.includes("/youtubei/v1/browse") ||
            url.includes("/youtubei/v1/search");
          if (isTarget) {
            const ct = response.headers.get("content-type") || "";
            if (ct.includes("application/json")) {
              const waivedResponse = Cu.waiveXrays(response);
              const originalText = waivedResponse.text;
              const originalJson = waivedResponse.json;
              const originalClone = waivedResponse.clone;

              const customJson = Cu.exportFunction(function () {
                try {
                  return originalJson.call(waivedResponse).then(
                    Cu.exportFunction(function (data) {
                      try {
                        if (data && typeof data === "object") {
                          cleanObject(data);
                        }
                      } catch (e) {}
                      return data;
                    }, win)
                  );
                } catch (err) {
                  return originalJson.call(waivedResponse);
                }
              }, win);

              const customText = Cu.exportFunction(function () {
                try {
                  return originalText.call(waivedResponse).then(
                    Cu.exportFunction(function (text) {
                      try {
                        const hasAd = adKeywords.some(kw => text.includes(kw));
                        if (!hasAd) {
                          return text;
                        }
                        let data = nativeParse(text);
                        cleanObject(data);
                        return JSON.stringify(data);
                      } catch (e) {
                        return text;
                      }
                    }, win)
                  );
                } catch (err) {
                  return originalText.call(waivedResponse);
                }
              }, win);

              const customClone = Cu.exportFunction(function () {
                try {
                  const cloned = originalClone.call(waivedResponse);
                  return cleanFetchCallback(cloned);
                } catch (err) {
                  return originalClone.call(waivedResponse);
                }
              }, win);

              const handler = Cu.cloneInto(
                {
                  get(target, prop) {
                    if (prop === "json") {
                      return customJson;
                    }
                    if (prop === "text") {
                      return customText;
                    }
                    if (prop === "clone") {
                      return customClone;
                    }
                    try {
                      let val = target[prop];
                      if (typeof val === "function" && prop !== "constructor") {
                        return val.bind(target);
                      }
                      return val;
                    } catch (e) {
                      return undefined;
                    }
                  },
                },
                win,
                { cloneFunctions: true }
              );

              return new win.Proxy(waivedResponse, handler);
            }
          }
        } catch (e) {}
        return response;
      }, win);

      return promise.then(cleanFetchCallback);
    }, win);
    xrayedWin.fetch = customFetch;

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
      return nativeXhrOpen.call(this, method, url, async, user, password);
    }, win);

    const customXhrSend = Cu.exportFunction(function (body) {
      try {
        const isTarget =
          this._lykonUrl &&
          (this._lykonUrl.includes("/youtubei/v1/player") ||
            this._lykonUrl.includes("/youtubei/v1/next") ||
            this._lykonUrl.includes("/youtubei/v1/browse") ||
            this._lykonUrl.includes("/youtubei/v1/search"));
        if (isTarget) {
          const onReadyStateCallback = Cu.exportFunction(function () {
            try {
              if (this.readyState === 4) {
                const ct = this.getResponseHeader("content-type") || "";
                if (ct.includes("application/json") && this.responseText) {
                  const text = this.responseText;
                  const hasAd = adKeywords.some(kw => text.includes(kw));
                  if (hasAd) {
                    let data = nativeParse(text);
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
              }
            } catch (e) {}
          }, win);
          this.addEventListener("readystatechange", onReadyStateCallback);
        }
      } catch (e) {}
      return nativeXhrSend.call(this, body);
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
    const doc = this.document;
    if (!doc || !doc.documentElement) return;
    const win = this.contentWindow;
    if (!win || win.closed) return;

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
      "div[data-testid^='bbtype-']",
      "div[class*='ad-container']",
      "div[class*='ad-slot']",
      "[id*='ad-unit']",
      "[id*='ad-slot']",
      ".ad-banner",
      ".video-ad-container",
      ".ads-container",
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
        this.scheduleDimensionHiding();
      }
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
      const className = el.className;
      if (className && typeof className === "string") {
        const classes = className.split(/\s+/);
        for (const cls of classes) {
          if (cls && !this._seenClasses.has(cls)) {
            this._seenClasses.add(cls);
            newFound = true;
          }
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
        const className = el.className;
        if (className && typeof className === "string") {
          const classes = className.split(/\s+/);
          for (const cls of classes) {
            if (cls && !this._seenClasses.has(cls)) {
              this._seenClasses.add(cls);
              changed = true;
            }
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
        if (!this._isBenignError(e)) {
          console.error("[LykonShield] Generic filter query failed:", e);
        }
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
    if (this._destroyed || !this.document || !this.document.documentElement)
      return;
    const win = this.contentWindow;
    if (!win || win.closed) return;
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

        const childrenCount = div.children.length;
        if (childrenCount > 1) {
          continue;
        }

        const hasIframe =
          childrenCount === 1 && div.children[0].tagName === "IFRAME";
        if (childrenCount === 1 && !hasIframe) {
          continue;
        }

        const hasInlineDimensions = div.style.width || div.style.height;
        const isInsOrAside = div.tagName === "INS" || div.tagName === "ASIDE";
        const hasAdKeywords = /ad|sponsor|promo/i.test(
          div.className + " " + div.id
        );

        if (
          !hasInlineDimensions &&
          !isInsOrAside &&
          !hasAdKeywords &&
          !hasIframe
        ) {
          continue;
        }

        const w = div.offsetWidth;
        const h = div.offsetHeight;
        if (w === 0 && h === 0) continue;

        for (const dim of AD_DIMENSIONS) {
          if (Math.abs(w - dim.w) < 5 && Math.abs(h - dim.h) < 5) {
            div.style.setProperty("display", "none", "important");
            hiddenCount++;
            break;
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
