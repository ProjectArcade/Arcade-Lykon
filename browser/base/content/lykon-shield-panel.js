/* ════════════════════════════════════════════════════
   LYKON SHIELD  —  lykon-shield.js
   Advanced cosmetic filtering — Brave-grade engine
   ════════════════════════════════════════════════════ */

/* ── Utility: tiny throttle ── */
function _lksThrottle(fn, ms) {
  let t = 0;
  return function (...args) {
    const now = Date.now();
    if (now - t >= ms) { t = now; fn.apply(this, args); }
  };
}

/* ════════════════════════════════════════════════════
   LYKON SHIELD UI CONTROLLER
   ════════════════════════════════════════════════════ */
var LykonShield = {

  _el: {},
  _bound: false,

  init() {
    const $ = id => document.getElementById(id);
    this._el = {
      button:     $("lykon-shield-button"),
      toggle:     $("lykon-shield-toggle"),
      content:    $("lykon-shield-panel-content"),
      statusText: $("lykon-shield-status-text"),
      statusHint: $("lks-status-hint"),
      dot:        $("lks-dot"),
      heroTitle:  $("lykon-shield-hero-title"),
      heroSub:    $("lykon-shield-hero-sub"),
      heroAction: $("lykon-shield-hero-action"),
      advHeader:  $("lykon-shield-advanced-header"),
      advPanel:   $("lykon-shield-advanced"),
      advArrow:   $("lykon-shield-adv-arrow"),
      count:      $("lykon-shield-count"),
      total:      $("lykon-shield-total-count"),
      trackers:   $("lykon-shield-tracker-count"),
      bandwidth:  $("lykon-shield-bandwidth"),
    };

    if (!this._el.toggle || !this._el.content) return;

    if (!this._bound) {
      this._el.toggle.addEventListener("change", () => this._onMainToggle());
      if (this._el.heroAction) {
        this._el.heroAction.addEventListener("click", () => {
          this._el.toggle.checked = !this._el.toggle.checked;
          this._onMainToggle();
        });
      }
      if (this._el.advHeader) {
        this._el.advHeader.addEventListener("click", () => this._toggleAdvanced());
      }
      this._bound = true;
    }

    this._loadPrefs();
    this._applyEnabledState(this._el.toggle.checked);
    this._updateStats();
  },

  _onMainToggle() {
    const on = this._el.toggle.checked;
    this._applyEnabledState(on);
    try {
      Services.prefs.setBoolPref("browser.adblock.enabled", on);
      Services.obs.notifyObservers(null, "adblock-shield-toggled", on ? "true" : "false");
      const win = Services.wm.getMostRecentWindow("navigator:browser");
      if (win?.gBrowser) win.gBrowser.selectedBrowser.reload();
    } catch (e) {
      console.error("[LykonShield] Toggle error:", e);
    }
  },

  _applyEnabledState(on) {
    this._el.content?.setAttribute("data-paused", on ? "false" : "true");
    this._el.button?.setAttribute("image",
      on ? "chrome://browser/skin/preferences/Adblocker-on.png"
         : "chrome://browser/skin/preferences/Adblocker-off-concer.png");
    if (this._el.statusText)  this._el.statusText.textContent  = on ? "Blocking ads" : "Lykon Shield is Down";
    if (this._el.statusHint)  this._el.statusHint.textContent  = on ? "You're browsing ad-free." : "You may see more ads and trackers online.";
    if (this._el.heroTitle)   this._el.heroTitle.textContent   = on ? "You're protected!" : "Lykon Shield is Down";
    if (this._el.heroSub)     this._el.heroSub.textContent     = on ? "Enjoy an ad-free browsing experience." : "You may see more ads and trackers online.";
    if (this._el.heroAction)  this._el.heroAction.textContent  = on ? "Turn off Lykon Shield" : "Turn on Lykon Shield";
  },

  _toggleAdvanced() {
    if (!this._el.advPanel || !this._el.advArrow) return;
    const open = this._el.advPanel.style.display !== "none";
    this._el.advPanel.style.display = open ? "none" : "block";
    this._el.advArrow.classList.toggle("open", !open);
  },

  setTrackerMode(val)  { try { Services.prefs.setStringPref("lykon.shield.tracker.mode", val); } catch (e) {} },
  setHttpsMode(val)    { try { Services.prefs.setStringPref("lykon.shield.https.mode", val);   } catch (e) {} },
  setCookieMode(val)   { try { Services.prefs.setStringPref("lykon.shield.cookie.mode", val);  } catch (e) {} },

  toggleScripts() {
    const el = document.getElementById("lykon-shield-scripts");
    try { Services.prefs.setBoolPref("lykon.shield.scripts.blocked", el.checked); } catch (e) {}
  },
  toggleFingerprint() {
    const el  = document.getElementById("lykon-shield-fingerprint");
    const lbl = document.getElementById("lykon-shield-fingerprint-count");
    try { Services.prefs.setBoolPref("lykon.shield.fingerprint.enabled", el.checked); } catch (e) {}
    lbl.textContent = el.checked ? "Active" : "Off";
  },
  toggleForget() {
    const el = document.getElementById("lykon-shield-forget");
    try { Services.prefs.setBoolPref("lykon.shield.forget.onexit", el.checked); } catch (e) {}
  },

  _loadPrefs() {
    try {
      const on = Services.prefs.getBoolPref("browser.adblock.enabled", true);
      this._el.toggle.checked = on;
      this._applyEnabledState(on);
      document.getElementById("lykon-shield-tracker-mode").value = Services.prefs.getStringPref("lykon.shield.tracker.mode", "standard");
      document.getElementById("lykon-shield-https-mode").value   = Services.prefs.getStringPref("lykon.shield.https.mode",   "soft");
      document.getElementById("lykon-shield-cookie-mode").value  = Services.prefs.getStringPref("lykon.shield.cookie.mode",  "all");
      const sc = Services.prefs.getBoolPref("lykon.shield.scripts.blocked",      false);
      const fp = Services.prefs.getBoolPref("lykon.shield.fingerprint.enabled",  false);
      const fg = Services.prefs.getBoolPref("lykon.shield.forget.onexit",        false);
      document.getElementById("lykon-shield-scripts").checked     = sc;
      document.getElementById("lykon-shield-fingerprint").checked = fp;
      document.getElementById("lykon-shield-fingerprint-count").textContent = fp ? "Active" : "Off";
      document.getElementById("lykon-shield-forget").checked      = fg;
    } catch (e) {
      this._applyEnabledState(true);
    }
  },

  _updateStats() {
    try {
      const sess    = Services.prefs.getIntPref("lykon.shield.stats.session",  0);
      const total   = Services.prefs.getIntPref("lykon.shield.stats.total",    0);
      const tracker = Services.prefs.getIntPref("lykon.shield.stats.trackers", 0);
      const bytes   = Services.prefs.getIntPref("lykon.shield.stats.bytes",    0);
      this._el.count.textContent     = sess.toLocaleString();
      this._el.total.textContent     = total.toLocaleString();
      this._el.trackers.textContent  = tracker.toLocaleString();
      this._el.bandwidth.textContent = this._fmtBytes(bytes);
    } catch (e) {}
  },

  _fmtBytes(b) {
    if (b < 1024)       return b + " B";
    if (b < 1048576)    return (b / 1024).toFixed(1) + " KB";
    if (b < 1073741824) return (b / 1048576).toFixed(1) + " MB";
    return (b / 1073741824).toFixed(2) + " GB";
  },
};


/* ════════════════════════════════════════════════════
   LYKON COSMETIC FILTER  —  Brave-grade engine
   ════════════════════════════════════════════════════

   Architecture:
   ┌─────────────────────────────────────────────────┐
   │  Layer 0 – AGENT stylesheet (global, instant)   │
   │  Layer 1 – Per-doc <style> injection            │
   │  Layer 2 – JS selector sweep                    │
   │  Layer 3 – Heuristic / scoring engine           │
   │  Layer 4 – MutationObserver (debounced)         │
   │  Layer 5 – IntersectionObserver (lazy collapse) │
   │  Layer 6 – Iframe src patrol                    │
   │  Layer 7 – Shadow-DOM pierce                    │
   │  Layer 8 – Sticky/fixed ad eviction             │
   │  Layer 9 – Periodic sweep (1 Hz × 10 s)        │
   └─────────────────────────────────────────────────┘
   ════════════════════════════════════════════════════ */
var LykonCosmeticFilter = {

  _initialized:        false,
  _observers:          new WeakMap(),   // browser → MutationObserver
  _ioObservers:        new WeakMap(),   // element → IntersectionObserver
  _docObserverBound:   false,
  _shieldObserverBound:false,
  _globalSheetURI:     null,

  /* ─────────────────────────────────────────────────
     ❶  SELECTOR BANKS
  ───────────────────────────────────────────────── */

  /* Core CSS selectors injected as <style> */
  _selectors: [
    /* Google AdSense / DFP / GPT */
    "ins.adsbygoogle",
    "[id^='google_ads_iframe_']",
    "iframe[id^='google_ads_iframe_']",
    "iframe[name^='google_ads_iframe_']",
    "[id^='div-gpt-ad-']",
    "div[id^='div-gpt-ad-']",
    "[id*='aswift_']",
    "[id*='google_ads_']",
    "[id*='gpt_unit']",
    "[id*='div-gpt-ad']",
    "[id*='asw-']",
    /* Amazon / generic ad networks */
    "iframe[src*='amazon-adsystem']",
    "iframe[src*='doubleclick.net']",
    "iframe[src*='googlesyndication']",
    "iframe[src*='googleadservices']",
    "iframe[src*='ads.google']",
    "iframe[src*='adservice.google']",
    "iframe[src*='pagead2.googlesyndication']",
    "iframe[src*='tpc.googlesyndication']",
    "iframe[src*='moatads.com']",
    "iframe[src*='mediamath.com']",
    "iframe[src*='adnxs.com']",
    "iframe[src*='ib.adnxs.com']",
    "iframe[src*='adsafeprotected.com']",
    "iframe[src*='rubiconproject.com']",
    "iframe[src*='openx.net']",
    "iframe[src*='pubmatic.com']",
    "iframe[src*='casalemedia.com']",
    "iframe[src*='criteo.com']",
    "iframe[src*='criteo.net']",
    "iframe[src*='taboola.com']",
    "iframe[src*='outbrain.com']",
    "iframe[src*='revcontent.com']",
    "iframe[src*='mgid.com']",
    "iframe[src*='sharethrough.com']",
    "iframe[src*='33across.com']",
    "iframe[src*='triplelift.com']",
    "iframe[src*='sonobi.com']",
    "iframe[src*='smartadserver.com']",
    "iframe[src*='liveramp.com']",
    "iframe[src*='bidswitch.net']",
    "iframe[src*='spotxchange.com']",
    "iframe[src*='spotx.tv']",
    "iframe[src*='springserve.com']",
    "iframe[src*='adform.net']",
    "iframe[src*='teads.tv']",
    "iframe[src*='yieldmo.com']",
    "iframe[src*='vidoomy.com']",
    "iframe[src*='insticator.com']",
    "iframe[src*='undertone.com']",
    "iframe[src*='advertising.com']",
    "iframe[src*='aol.com/ads']",
    "iframe[src*='yimg.com/ads']",
    "iframe[src*='yahoosyndicationapis.com']",
    "iframe[src*='ads.yahoo.com']",
    "iframe[src*='adsystem.amazon.com']",
    "iframe[src*='media.net']",
    "iframe[src*='servenobid.com']",
    "iframe[src*='applovin.com']",
    "iframe[src*='mopub.com']",
    "iframe[src*='ads.twitter.com']",
    "iframe[src*='ads.linkedin.com']",
    "iframe[src*='ads.pinterest.com']",
    "iframe[src*='ads.tiktok.com']",
    "iframe[src*='ads.snapchat.com']",
    "iframe[src*='adsrv.eacdn.com']",
    "iframe[src*='propellerads.com']",
    "iframe[src*='popcash.net']",
    "iframe[src*='popads.net']",
    "iframe[src*='zedo.com']",
    "iframe[src*='clicksor.com']",
    "iframe[src*='valueclickmedia.com']",
    "iframe[src*='advertising.com']",
    "iframe[src*='trafficjunky.net']",
    /* Tracker pixels */
    "img[src*='doubleclick']",
    "img[src*='googlesyndication']",
    "img[src*='google-analytics']",
    "img[src*='googletagmanager']",
    "img[src*='facebook.com/tr']",
    "img[src*='connect.facebook.net']",
    "img[src*='pixel.twitter.com']",
    "img[src*='analytics.twitter.com']",
    "img[src*='bat.bing.com']",
    "img[src*='p.adsymptotic.com']",
    "img[src*='px.ads.linkedin.com']",
    "img[src*='ct.pinterest.com']",
    "img[src*='analytics.tiktok.com']",
    "img[src*='sc-static.net/scevent']",
    /* HTML attribute-based */
    "[data-ad-slot]",
    "[data-ad-format]",
    "[data-ad-client]",
    "[data-google-query-id]",
    "[data-ad-unit]",
    "[data-dfp-ad]",
    "[data-adunit]",
    "[data-adslot]",
    "[data-gpt-slot]",
    "[data-gpt-line-item]",
    "[data-ad-type]",
    "[data-ad-rendered]",
    "[data-ad-label]",
    "[data-advert]",
    "[data-advertisement]",
    "[data-sponsorship]",
    /* Class/ID patterns */
    "[id^='ad_']",
    "[id^='ad-']",
    "[id^='ads_']",
    "[id^='ads-']",
    "[id^='adv_']",
    "[id^='adv-']",
    "[id^='advert_']",
    "[id^='advert-']",
    "[id^='banner_']",
    "[id^='banner-ad']",
    "[id^='adsense']",
    "[id^='taboola']",
    "[id^='outbrain']",
    "[id^='criteo']",
    "[id^='revcontent']",
    "[class*='adsbygoogle']",
    "[class*='gpt-ad']",
    "[class*='ad-slot']",
    "[class*='ad-unit']",
    "[class*='ad-banner']",
    "[class*='advertisement']",
    "[class*='advertise']",
    "[class*='sponsored']",
    "[class*='promoted']",
    "[class*='adwrapper']",
    "[class*='ad-wrapper']",
    "[class*='ad-container']",
    "[class*='ad-holder']",
    "[class*='ad-placeholder']",
    "[class*='ad-space']",
    "[class*='ad-area']",
    "[class*='ad-box']",
    "[class*='ad-label']",
    "[class*='ad-frame']",
    "[class*='ad-block']",
    "[class*='ad-panel']",
    "[class*='ad-strip']",
    "[class*='ad-leaderboard']",
    "[class*='ad-sidebar']",
    "[class*='ad-insert']",
    "[class*='ad-section']",
    "[class*='ad-text']",
    "[class*='ad-zone']",
    "[class*='ads-wrapper']",
    "[class*='ads-container']",
    "[class*='ads-block']",
    "[class*='ads-section']",
    "[class*='ads-box']",
    "[class*='ads-slot']",
    "[class*='taboola']",
    "[class*='outbrain']",
    "[class*='criteo']",
    "[class*='revcontent']",
    "[class*='mgid']",
    "[class*='sharethrough']",
    /* Site-specific */
    ".adInv",
    ".paisa-wrapper.mrec_placeHolder",
    ".mrec_placeHolder",
    ".ads-wrp_txt",
    ".ad_position_box.ad-placeholder",
    "div.ad_position_box.ad-placeholder.mb20.mt-20.desktop.adsbygoogle",
    "div.ad_position_box.ad-placeholder.desktop.adsbygoogle",
    "span.ad-text",
    "div.ad-placeholder",
    /* YouTube elements */
    "ytd-companion-slot-renderer",
    "ytd-ad-slot-renderer",
    "yt-formatted-string[role='tooltip'][aria-label='Advertisement']",
    /* TpGnAd / ads-wrp family */
    "[class*='TpGnAd_ad-wr']",
    "div[class*='TpGnAd_ad-wr']",
    "[class^='TpGnAd_ad-wr']",
    "[class*='TpGnAd']",
    ".ads-wrp.ad_hd",
    "div.ads-wrp.ad_hd",
    "[class*='ads-wrp'][class*='ad_hd']",
    "[class*='ads-wrp']",
    "[class^='ads-wrp']",
    "div[class*='ads-wrp']",
    /* Sticky / fixed overlays (common ad positions) */
    "div[style*='position:fixed'][style*='z-index:9']",
    "div[style*='position: fixed'][style*='z-index: 9']",
    /* Consent / cookie banners that wrap ads */
    "#adsense-sticky-wrapper",
    "#sticky-ad-wrapper",
    "#ad-sticky",
    "#adsticky",
    "#floating-ad",
    "#floatingad",
    "#slide-ad",
    "#interstitial-wrapper",
  ],

  /* Collapse (zero out dimensions) — these must shrink to 0 */
  _collapseSelectors: [
    "[id^='div-gpt-ad-']",
    "div[id^='div-gpt-ad-']",
    ".adInv",
    ".paisa-wrapper.mrec_placeHolder",
    ".mrec_placeHolder",
    ".ad_position_box.ad-placeholder",
    ".ads-wrp_txt",
    "ytd-companion-slot-renderer",
    "ytd-ad-slot-renderer",
    "[class*='TpGnAd_ad-wr']",
    "div[class*='TpGnAd_ad-wr']",
    "[class^='TpGnAd_ad-wr']",
    "[class*='TpGnAd']",
    ".ads-wrp.ad_hd",
    "div.ads-wrp.ad_hd",
    "[class*='ads-wrp'][class*='ad_hd']",
    "[class*='ads-wrp']",
    "[class^='ads-wrp']",
    "div[class*='ads-wrp']",
    "[id^='google_ads_iframe_']",
    "iframe[id^='google_ads_iframe_']",
    "iframe[name^='google_ads_iframe_']",
    "ins.adsbygoogle",
    "[id*='aswift_']",
    "[data-ad-slot]",
    "[data-ad-client]",
  ],

  /* Tracker domains for network-layer src sniffing */
  _trackerDomains: [
    "doubleclick.net","googlesyndication.com","googleadservices.com",
    "googletagmanager.com","google-analytics.com","adservice.google.com",
    "pagead2.googlesyndication.com","amazon-adsystem.com","adnxs.com",
    "rubiconproject.com","openx.net","pubmatic.com","casalemedia.com",
    "criteo.com","criteo.net","taboola.com","outbrain.com","mgid.com",
    "revcontent.com","sharethrough.com","moatads.com","ib.adnxs.com",
    "33across.com","triplelift.com","sonobi.com","smartadserver.com",
    "bidswitch.net","spotxchange.com","spotx.tv","springserve.com",
    "adform.net","teads.tv","yieldmo.com","mediamath.com","liveramp.com",
    "advertising.com","media.net","servenobid.com","propellerads.com",
    "trafficjunky.net","zedo.com","popcash.net","popads.net",
    "facebook.com/tr","connect.facebook.net","pixel.twitter.com",
    "bat.bing.com","px.ads.linkedin.com","ct.pinterest.com",
    "analytics.tiktok.com","sc-static.net","applovin.com",
    "ads.twitter.com","ads.linkedin.com","ads.pinterest.com",
  ],

  /* Ad-label text content signatures (exact + prefix) */
  _adLabelTexts: new Set([
    "advertisement","advertise","advertisements","advertorial",
    "sponsored","sponsored content","sponsored post","promoted",
    "promoted content","presented by","paid partnership","paid post",
    "recommended for you","you might also like","around the web",
    "from around the web","from the web","from our partners",
    "you may like","you may also like","more from the web",
    "content from our partners","ad","ads","advt","adv",
  ]),

  /* ─────────────────────────────────────────────────
     ❷  CSS RULE BUILDERS
  ───────────────────────────────────────────────── */
  get _cssRule() {
    const hide = this._selectors.join(",\n") +
      `{\n  display:none!important;\n  visibility:hidden!important;\n  pointer-events:none!important;\n  opacity:0!important;\n}`;
    const collapse = this._collapseSelectors.join(",\n") +
      `{\n  display:none!important;\n  visibility:hidden!important;\n  pointer-events:none!important;\n  opacity:0!important;\n  height:0!important;\n  min-height:0!important;\n  max-height:0!important;\n  width:0!important;\n  min-width:0!important;\n  max-width:0!important;\n  margin:0!important;\n  padding:0!important;\n  border:0!important;\n  overflow:hidden!important;\n}`;
    return hide + "\n" + collapse;
  },

  get _globalCssRule() {
    return `@-moz-document url-prefix("http://"), url-prefix("https://") {\n${this._cssRule}\n}`;
  },

  /* ─────────────────────────────────────────────────
     ❸  GLOBAL AGENT STYLESHEET (Layer 0)
  ───────────────────────────────────────────────── */
  _getStyleSheetService() {
    return Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
  },
  _getGlobalSheetURI() {
    if (!this._globalSheetURI) {
      this._globalSheetURI = Services.io.newURI(
        `data:text/css;charset=utf-8,${encodeURIComponent(this._globalCssRule)}`
      );
    }
    return this._globalSheetURI;
  },
  _registerGlobalStylesheet() {
    try {
      const sss = this._getStyleSheetService();
      const uri = this._getGlobalSheetURI();
      if (!sss.sheetRegistered(uri, sss.AGENT_SHEET))
        sss.loadAndRegisterSheet(uri, sss.AGENT_SHEET);
    } catch (e) { console.error("[LykonCosmetic] register sheet:", e); }
  },
  _unregisterGlobalStylesheet() {
    try {
      const sss = this._getStyleSheetService();
      const uri = this._getGlobalSheetURI();
      if (sss.sheetRegistered(uri, sss.AGENT_SHEET))
        sss.unregisterSheet(uri, sss.AGENT_SHEET);
    } catch (e) { console.error("[LykonCosmetic] unregister sheet:", e); }
  },
  _ensureGlobalStylesheetState() {
    this._isShieldEnabled() ? this._registerGlobalStylesheet() : this._unregisterGlobalStylesheet();
  },

  /* ─────────────────────────────────────────────────
     ❹  SHIELD STATE
  ───────────────────────────────────────────────── */
  _isShieldEnabled() {
    try { return Services.prefs.getBoolPref("browser.adblock.enabled", true); }
    catch (e) { return true; }
  },

  /* ─────────────────────────────────────────────────
     ❺  INIT
  ───────────────────────────────────────────────── */
  init() {
    if (this._initialized) return;
    this._initialized = true;
    try {
      this._startShieldObserver();
      this._ensureGlobalStylesheetState();
      this._startDocumentObserver();

      const enumerator = Services.wm.getEnumerator("navigator:browser");
      while (enumerator.hasMoreElements()) {
        const win = enumerator.getNext();
        if (win?.gBrowser) this._attachBrowserWindow(win);
      }
    } catch (e) { console.error("[LykonCosmetic] init:", e); }
  },

  /* ─────────────────────────────────────────────────
     ❻  OBSERVERS
  ───────────────────────────────────────────────── */
  _startDocumentObserver() {
    if (this._docObserverBound) return;
    try { Services.obs.addObserver(this, "document-element-inserted"); this._docObserverBound = true; }
    catch (e) { console.error("[LykonCosmetic] doc observer:", e); }
  },
  _startShieldObserver() {
    if (this._shieldObserverBound) return;
    try { Services.obs.addObserver(this, "adblock-shield-toggled"); this._shieldObserverBound = true; }
    catch (e) { console.error("[LykonCosmetic] shield observer:", e); }
  },

  observe(subject, topic) {
    if (topic === "adblock-shield-toggled") {
      this._ensureGlobalStylesheetState();
      /* Re-run on all open tabs when shield toggled on */
      if (this._isShieldEnabled()) {
        try {
          const enumerator = Services.wm.getEnumerator("navigator:browser");
          while (enumerator.hasMoreElements()) {
            const win = enumerator.getNext();
            if (!win?.gBrowser) continue;
            for (const browser of win.gBrowser.browsers) {
              const doc = browser.contentDocument;
              if (doc?.location?.protocol?.startsWith("http")) this.run(doc);
            }
          }
        } catch (e) {}
      }
      return;
    }
    if (topic !== "document-element-inserted") return;
    const doc = subject;
    if (!doc || doc.nodeType !== 9 || !doc.location) return;
    const proto = doc.location.protocol;
    if (proto !== "http:" && proto !== "https:") return;
    if (!this._isShieldEnabled()) return;
    this._injectStylesheet(doc);
  },

  /* ─────────────────────────────────────────────────
     ❼  PER-WINDOW ATTACHMENT
  ───────────────────────────────────────────────── */
  _attachBrowserWindow(win) {
    try {
      if (!win?.gBrowser || win.__lykonCosmeticFilterBound) return;
      win.__lykonCosmeticFilterBound = true;
      for (const browser of win.gBrowser.browsers) this._observeBrowser(browser);
      win.gBrowser.tabContainer.addEventListener("TabOpen",       e => { const b = e.target?.linkedBrowser; if (b) this._observeBrowser(b); }, true);
      win.gBrowser.tabContainer.addEventListener("SSTabRestored", e => { const b = e.target?.linkedBrowser; if (b) this._observeBrowser(b); }, true);
    } catch (e) { console.error("[LykonCosmetic] attach:", e); }
  },

  /* ─────────────────────────────────────────────────
     ❽  PER-BROWSER OBSERVATION (Layer 4)
  ───────────────────────────────────────────────── */
  _observeBrowser(browser) {
    try {
      if (!browser || this._observers.has(browser)) return;
      const doc = browser.contentDocument;
      if (!doc || doc.nodeType !== 9 || !doc.defaultView) return;

      this.run(doc);

      /* Throttled mutation callback — 120 ms debounce */
      const mutCb = _lksThrottle(() => {
        if (!this._isShieldEnabled()) return;
        this._jsHidePass(doc);
        this._stickyAdEviction(doc);
        this._shadowDomPierce(doc);
      }, 120);

      const mo = new doc.defaultView.MutationObserver(mutCb);
      mo.observe(doc.documentElement || doc, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: [
          "id","class","style","src",
          "data-ad-slot","data-ad-format","data-ad-client",
          "data-google-query-id","data-adunit","data-adslot",
        ],
      });
      this._observers.set(browser, mo);

      /* Periodic sweep for lazy-loaded ads (runs 10× then stops) */
      let sweepCount = 0;
      const sweepTimer = doc.defaultView.setInterval(() => {
        if (!this._isShieldEnabled() || ++sweepCount > 10) {
          doc.defaultView?.clearInterval(sweepTimer);
          return;
        }
        this._jsHidePass(doc);
        this._stickyAdEviction(doc);
      }, 1000);
    } catch (e) { console.error("[LykonCosmetic] observe browser:", e); }
  },

  /* ─────────────────────────────────────────────────
     ❾  MAIN run() — orchestrates all layers
  ───────────────────────────────────────────────── */
  run(doc) {
    if (!doc || doc.nodeType !== 9) return;
    if (!this._isShieldEnabled()) return;
    this._injectStylesheet(doc);   // Layer 1
    this._jsHidePass(doc);         // Layer 2 + 3
    this._iframeSrcPatrol(doc);    // Layer 6
    this._shadowDomPierce(doc);    // Layer 7
    this._stickyAdEviction(doc);   // Layer 8
    this._attachIntersection(doc); // Layer 5
  },

  /* ─────────────────────────────────────────────────
     Layer 1 – Per-doc <style> injection
  ───────────────────────────────────────────────── */
  _injectStylesheet(doc) {
    try {
      if (doc.getElementById("lykon-cosmetic-filter")) return;
      const parent = doc.head || doc.documentElement;
      if (!parent) return;
      const style = doc.createElement("style");
      style.id = "lykon-cosmetic-filter";
      style.textContent = this._cssRule;
      parent.insertBefore(style, parent.firstChild); // prepend for priority
    } catch (e) {}
  },

  /* ─────────────────────────────────────────────────
     Layer 2 – JS selector sweep
     Layer 3 – Heuristic scoring engine
  ───────────────────────────────────────────────── */
  _jsHidePass(doc) {
    let hidden = 0;

    /* Selector sweep */
    for (const sel of this._selectors) {
      try {
        for (const el of doc.querySelectorAll(sel)) {
          if (this._hideElement(el)) hidden++;
        }
      } catch (e) {}
    }

    /* Heuristic scoring pass on containers */
    try {
      const candidates = doc.querySelectorAll(
        "div, section, aside, article, ins, figure, span, header, footer"
      );
      for (const el of candidates) {
        if (this._scoreAdLikelihood(el) >= 70) {
          if (this._hideElement(el)) hidden++;
        }
      }
    } catch (e) {}

    if (hidden > 0) console.log(`[LykonCosmetic] JS pass hid ${hidden} elements`);
  },

  /* ─────────────────────────────────────────────────
     ❿  SCORING ENGINE  (0–100)
     Brave-inspired signal weighting.
  ───────────────────────────────────────────────── */
  _scoreAdLikelihood(el) {
    let score = 0;
    try {
      const id      = (el.id            || "").toLowerCase();
      const cls     = (el.className     || "").toLowerCase();
      const style   = (el.getAttribute("style") || "").toLowerCase();
      const tag     = el.tagName.toLowerCase();
      const text    = (el.textContent   || "").trim().toLowerCase();
      const role    = (el.getAttribute("role") || "").toLowerCase();
      const ariaL   = (el.getAttribute("aria-label") || "").toLowerCase();
      const title   = (el.getAttribute("title") || "").toLowerCase();

      /* ── ID signals ── */
      if (/\bad[-_]/.test(id) || /[-_]ad\b/.test(id))       score += 30;
      if (/advert|adsense|adslot|adunit|adspace/.test(id))   score += 35;
      if (/taboola|outbrain|criteo|mgid|revcontent/.test(id))score += 40;
      if (/banner|sponsor|promo|affiliat/.test(id))          score += 20;
      if (/leaderboard|skyscraper|mrec|halfpage/.test(id))   score += 25;
      if (/gpt[-_]|dfp[-_]|asw[-_]/.test(id))               score += 40;
      if (/placeholder/.test(id))                            score += 10;

      /* ── Class signals ── */
      if (/\bad[-_]/.test(cls) || /[-_]ad\b/.test(cls))     score += 25;
      if (/advert|adsense|adslot|adunit/.test(cls))          score += 35;
      if (/taboola|outbrain|criteo|mgid/.test(cls))          score += 40;
      if (/sponsor|promoted|advertori/.test(cls))            score += 30;
      if (/banner[-_]ad|ad[-_]banner/.test(cls))             score += 30;
      if (/placeholder/.test(cls))                           score += 10;
      if (/tpgnad_ad-wr|tpgnad/i.test(cls))                 score += 60;
      if (/ads-wrp/.test(cls))                               score += 55;
      if (/ads-wrp.*ad_hd|ad_hd.*ads-wrp/.test(cls))        score += 70;

      /* ── Attribute signals ── */
      if (el.hasAttribute("data-ad-slot"))          score += 50;
      if (el.hasAttribute("data-ad-client"))        score += 50;
      if (el.hasAttribute("data-google-query-id"))  score += 50;
      if (el.hasAttribute("data-adunit"))           score += 45;
      if (el.hasAttribute("data-dfp-ad"))           score += 45;
      if (el.hasAttribute("data-adslot"))           score += 45;
      if (el.hasAttribute("data-sponsored"))        score += 30;

      /* ── Geometry signals ── */
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const IAB_SIZES = [
        [728,90],[970,90],[970,250],[468,60],  // leaderboard variants
        [300,250],[300,600],[336,280],[250,250],// MPU/rectangle
        [160,600],[120,600],[300,1050],         // skyscrapers
        [320,50],[320,100],[300,50],            // mobile banner
        [970,66],[980,120],[930,180],           // large boards
      ];
      for (const [iw, ih] of IAB_SIZES) {
        if (Math.abs(w - iw) <= 4 && Math.abs(h - ih) <= 4) { score += 40; break; }
      }
      /* Empty container at ad-like size */
      if (text.length === 0 && w >= 100 && h >= 50)          score += 15;
      /* Very tall narrow or wide short — typical ad shapes */
      if (h >= 500 && w <= 200)                              score += 10;
      if (h <= 120 && w >= 600)                              score += 10;

      /* ── Content signals ── */
      if (this._adLabelTexts.has(text))                      score += 60;
      if (/^advertisement$|^sponsored$|^promoted$/i.test(text)) score += 60;
      if (/ad by |ads by |advert by/i.test(text))            score += 40;
      if (ariaL && /ad|advertisement|sponsored/i.test(ariaL))score += 30;
      if (title && /advertisement|sponsored/i.test(title))   score += 30;
      if (role === "complementary" && score > 20)            score += 10;

      /* ── Child iframe to tracker domain ── */
      try {
        for (const iframe of el.querySelectorAll("iframe[src]")) {
          const src = iframe.getAttribute("src") || "";
          if (this._trackerDomains.some(d => src.includes(d))) { score += 55; break; }
        }
      } catch (e) {}

      /* ── Style signals ── */
      if (style.includes("position:fixed") || style.includes("position: fixed")) {
        if (score > 20) score += 20; // fixed + other ad signals → likely sticky ad
      }
      if (/z-index\s*:\s*[1-9]\d{3,}/.test(style))         score += 10;
    } catch (e) {}
    return Math.min(score, 100);
  },

  /* ─────────────────────────────────────────────────
     Layer 5 – IntersectionObserver (lazy collapse)
     Hide ad slots only when they scroll into view
     (avoids layout jank on off-screen slots).
  ───────────────────────────────────────────────── */
  _attachIntersection(doc) {
    try {
      if (!doc.defaultView?.IntersectionObserver) return;
      const io = new doc.defaultView.IntersectionObserver(entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) this._hideElement(entry.target);
        }
      }, { rootMargin: "200px" });

      for (const sel of ["[data-ad-slot]","[data-ad-client]","ins.adsbygoogle","[id^='div-gpt-ad-']"]) {
        try {
          for (const el of doc.querySelectorAll(sel)) {
            if (!this._ioObservers.has(el)) {
              io.observe(el);
              this._ioObservers.set(el, io);
            }
          }
        } catch (e) {}
      }
    } catch (e) {}
  },

  /* ─────────────────────────────────────────────────
     Layer 6 – Iframe src patrol
     Dynamically-injected iframes that set src after parse.
  ───────────────────────────────────────────────── */
  _iframeSrcPatrol(doc) {
    try {
      for (const iframe of doc.querySelectorAll("iframe")) {
        const src = (iframe.getAttribute("src") || iframe.src || "").toLowerCase();
        if (!src) continue;
        if (this._trackerDomains.some(d => src.includes(d))) {
          this._hideElement(iframe);
        }
      }
    } catch (e) {}
  },

  /* ─────────────────────────────────────────────────
     Layer 7 – Shadow-DOM pierce
     Some ad networks wrap content in open shadow roots.
  ───────────────────────────────────────────────── */
  _shadowDomPierce(doc) {
    try {
      const hosts = doc.querySelectorAll("*");
      for (const host of hosts) {
        if (!host.shadowRoot) continue;
        const shadow = host.shadowRoot;
        /* Inject our style into shadow root */
        if (!shadow.getElementById("lykon-cosmetic-shadow")) {
          const style = doc.createElement("style");
          style.id = "lykon-cosmetic-shadow";
          style.textContent = this._cssRule;
          shadow.insertBefore(style, shadow.firstChild);
        }
        /* JS pass inside shadow */
        for (const sel of this._selectors) {
          try {
            for (const el of shadow.querySelectorAll(sel)) this._hideElement(el);
          } catch (e) {}
        }
      }
    } catch (e) {}
  },

  /* ─────────────────────────────────────────────────
     Layer 8 – Sticky / fixed ad eviction
     Targets overlay ads that float over content.
  ───────────────────────────────────────────────── */
  _stickyAdEviction(doc) {
    try {
      const win = doc.defaultView;
      if (!win) return;

      /* querySelectorAll is cheaper than getComputedStyle on every element;
         we limit to plausible sticky containers */
      const candidates = doc.querySelectorAll(
        "div[style*='fixed'],aside[style*='fixed'],section[style*='fixed']," +
        "div[style*='sticky'],aside[style*='sticky']," +
        "#sticky-ad,#ad-sticky,.sticky-ad,.ad-sticky," +
        "#floating-ad,.floating-ad,#slide-ad,.slide-ad," +
        "#interstitial,.interstitial-ad,#adhesion,.adhesion-ad"
      );

      for (const el of candidates) {
        try {
          const cs = win.getComputedStyle(el);
          const pos = cs.position;
          if (pos !== "fixed" && pos !== "sticky") continue;

          /* Only remove if it scores as an ad */
          if (this._scoreAdLikelihood(el) >= 40) {
            this._hideElement(el);
          }
        } catch (e) {}
      }
    } catch (e) {}
  },

  /* ─────────────────────────────────────────────────
     HIDE ELEMENT — walks up 6 levels to find wrapper
  ───────────────────────────────────────────────── */
  _hideElement(element) {
    try {
      let target = element;
      let parent = element?.parentElement;

      /* Brave-style: bubble up to find the outermost ad wrapper */
      for (let i = 0; i < 6 && parent; i++) {
        const parentScore = this._scoreAdLikelihood(parent);
        /* Only escalate if parent also looks like an ad, but parent is
           not a major structural element */
        const tag = parent.tagName?.toLowerCase();
        const isStructural = ["body","html","main","nav","header","footer"].includes(tag);
        if (!isStructural && parentScore >= 40) {
          target = parent;
        }
        parent = parent.parentElement;
      }

      if (target.style.display === "none") return false;

      target.style.setProperty("display",        "none",    "important");
      target.style.setProperty("visibility",     "hidden",  "important");
      target.style.setProperty("pointer-events", "none",    "important");
      target.style.setProperty("opacity",        "0",       "important");

      /* Collapse dimensions for known IAB slots */
      if (this._collapseSelectors.some(s => { try { return target.matches(s); } catch(e){ return false; } })) {
        target.style.setProperty("height",     "0", "important");
        target.style.setProperty("min-height", "0", "important");
        target.style.setProperty("max-height", "0", "important");
        target.style.setProperty("width",      "0", "important");
        target.style.setProperty("min-width",  "0", "important");
        target.style.setProperty("max-width",  "0", "important");
        target.style.setProperty("margin",     "0", "important");
        target.style.setProperty("padding",    "0", "important");
        target.style.setProperty("border",     "0", "important");
        target.style.setProperty("overflow",   "hidden", "important");
      }
      return true;
    } catch (e) {
      try {
        if (element?.style.display !== "none") {
          element.style.setProperty("display", "none", "important");
          return true;
        }
      } catch (_) {}
      return false;
    }
  },
};


/* ════════════════════════════════════════════════════
   BOOT
   ════════════════════════════════════════════════════ */
(function () {
  function startCosmeticFiltering() {
    try { LykonCosmeticFilter.init(); }
    catch (e) { console.error("[LykonCosmetic] start error:", e); }
  }

  function bindPopup() {
    const popup = document.getElementById("lykon-shield-popup");
    if (!popup || popup.dataset.lksBound === "true") return;
    popup.dataset.lksBound = "true";
    popup.addEventListener("popupshown", () => LykonShield.init());
  }

  startCosmeticFiltering();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindPopup, { once: true });
  } else {
    bindPopup();
  }
})();