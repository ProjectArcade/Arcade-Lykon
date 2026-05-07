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
  _statsObserverBound: false,
  _latestStats: null,

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

    if (!this._statsObserverBound) {
      try {
        Services.obs.addObserver(this, "adblock-stats-updated");
        this._statsObserverBound = true;
      } catch (e) {}
    }

    this._refreshLatestStats();

    this._loadPrefs();
    this._applyEnabledState(this._el.toggle.checked);
    this._updateStats();
  },

  _refreshLatestStats() {
    try {
      const { statsMonitor } = ChromeUtils.importESModule("resource:///modules/StatsMonitor.sys.mjs");
      this._latestStats = statsMonitor?.getStats ? statsMonitor.getStats() : null;
    } catch (e) {
      this._latestStats = null;
    }
  },

  observe(subject, topic, data) {
    if (topic !== "adblock-stats-updated") {
      return;
    }

    try {
      this._latestStats = data ? JSON.parse(data) : null;
    } catch (e) {
      this._latestStats = null;
    }

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
      const session = Services.prefs.getIntPref("lykon.shield.stats.session",  0);
      const total   = Services.prefs.getIntPref("lykon.shield.stats.total",    0);
      const tracker = Services.prefs.getIntPref("lykon.shield.stats.trackers", 0);
      const bytes   = Services.prefs.getIntPref("lykon.shield.stats.bytes",    0);

      const perSiteBlocked = this._latestStats?.page?.blocked;
      const adsBlockedThisSite = Number.isFinite(perSiteBlocked)
        ? perSiteBlocked
        : session;

      if (this._el.count) {
        this._el.count.textContent = adsBlockedThisSite.toLocaleString();
      }
      if (this._el.total) {
        this._el.total.textContent = total.toLocaleString();
      }
      if (this._el.trackers) {
        this._el.trackers.textContent = tracker.toLocaleString();
      }
      if (this._el.bandwidth) {
        this._el.bandwidth.textContent = this._fmtBytes(bytes);
      }
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

   CHANGES vs previous version:
   • Heuristic score threshold raised: 70 → 85
     (prevents content containers with mild ad-like
      attributes from being hidden)
   • Bubble-up in _hideElement: threshold raised 40 → 60,
     max walk depth reduced 6 → 3, and structural tag list
     expanded — stops the engine from escalating to large
     content wrappers
   • Removed broad substring class selectors that were
     causing false positives:
       [class*='sponsored'], [class*='promoted'],
       [class*='ad-block'], [class*='ad-panel'],
       [class*='ad-section'], [class*='ad-text'],
       [class*='ad-strip'], [class*='ad-insert'],
       [class*='ads-block'], [class*='ads-section']
   • Scoring: removed points for geometry alone on empty
     containers (too many legitimate skeleton loaders hit
     this); empty-container bonus now requires a confirmed
     ad attribute as well
   • Scoring: 'complementary' ARIA role bonus removed
     (sidebars that carry article widgets were being hidden)
   • Sticky-ad eviction threshold raised: 40 → 55
   ════════════════════════════════════════════════════ */
var LykonCosmeticFilter = {

  _initialized:        false,
  _observers:          new WeakMap(),
  _ioObservers:        new WeakMap(),
  _docObserverBound:   false,
  _shieldObserverBound:false,
  _globalSheetURI:     null,

  /* ─────────────────────────────────────────────────
     ❶  SELECTOR BANKS
  ───────────────────────────────────────────────── */

  /*
   * FIX — removed selectors that were hiding real content:
   *
   * REMOVED (too broad, caught article/content wrappers):
   *   [class*='sponsored']      — sponsor badge on articles, event pages
   *   [class*='promoted']       — promoted listings that are real content
   *   [class*='ad-block']       — common content-section class name
   *   [class*='ad-panel']       — sidebar panels with useful widgets
   *   [class*='ad-section']     — page sections named "ad" ambiguously
   *   [class*='ad-text']        — inline label class used by non-ad elements
   *   [class*='ad-strip']       — strip banners that may carry nav
   *   [class*='ad-insert']      — CMS insertion points, not always ads
   *   [class*='ads-block']      — same ambiguity as ad-block
   *   [class*='ads-section']    — same ambiguity as ad-section
   *
   * KEPT but verified against known-safe class names:
   *   [class*='adsbygoogle']    — only Google AdSense uses this
   *   [class*='gpt-ad']         — only GPT/DFP uses this
   *   [class*='ad-slot']        — specific enough
   *   [class*='ad-unit']        — specific enough
   *   [class*='ad-banner']      — specific enough
   *   [class*='advertisement']  — full word, low false-positive risk
   *   [class*='advertise']      — still somewhat specific
   *   [class*='adwrapper']      — specific enough
   *   [class*='ad-wrapper']     — specific enough
   *   [class*='ad-container']   — specific enough
   *   [class*='ad-holder']      — specific enough
   *   [class*='ad-placeholder'] — specific enough
   *   [class*='ad-space']       — specific enough
   *   [class*='ad-area']        — specific enough
   *   [class*='ad-box']         — specific enough
   *   [class*='ad-label']       — specific enough
   *   [class*='ad-frame']       — specific enough
   *   [class*='ad-leaderboard'] — specific enough
   *   [class*='ad-sidebar']     — specific enough
   *   [class*='ad-zone']        — specific enough
   *   [class*='ads-wrapper']    — specific enough
   *   [class*='ads-container']  — specific enough
   *   [class*='ads-box']        — specific enough
   *   [class*='ads-slot']       — specific enough
   */
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
    /* HTML attribute-based — these are reliably ad-only attributes */
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
    /* Class/ID patterns — kept only where specificity is high enough */
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
    /* FIX: removed [class*='sponsored'], [class*='promoted'] — too many
       legitimate elements use these (event sponsors, featured listings, etc.) */
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
    /* FIX: removed [class*='ad-block'], [class*='ad-panel'],
       [class*='ad-section'], [class*='ad-text'], [class*='ad-strip'],
       [class*='ad-insert'] — these matched too many content elements */
    "[class*='ad-leaderboard']",
    "[class*='ad-sidebar']",
    "[class*='ad-zone']",
    "[class*='ads-wrapper']",
    "[class*='ads-container']",
    /* FIX: removed [class*='ads-block'], [class*='ads-section'] */
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
    "ytd-companion-slot-renderer",
    "ytd-ad-slot-renderer",
    "[class*='TpGnAd_ad-wr']",
    "div[class*='TpGnAd_ad-wr']",
    "[class^='TpGnAd_ad-wr']",
    "[class*='TpGnAd']",
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

  /* Ad-label text content signatures (exact match only — no substring) */
  _adLabelTexts: new Set([
    "advertisement","advertisements","advertorial",
    "sponsored content","sponsored post",
    "paid partnership","paid post",
    "around the web","from around the web","from the web",
    "from our partners","more from the web",
    "content from our partners",
    /* Short single-word labels kept but only matched when the element
       contains ONLY that word and has other ad signals (scored separately) */
  ]),

  /*
   * FIX: Moved these out of _adLabelTexts into a separate set that
   * requires ADDITIONAL ad-attribute confirmation before hiding.
   * Single words like "ad", "ads", "sponsored", "promoted" appear as
   * accessible labels, ARIA descriptions, and button text on real content.
   */
  _weakAdLabels: new Set([
    "ad","ads","advt","adv","sponsored","promoted","presented by",
    "you might also like","recommended for you",
    "you may like","you may also like",
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
    this._injectStylesheet(doc);
    this._jsHidePass(doc);
    this._iframeSrcPatrol(doc);
    this._shadowDomPierce(doc);
    this._stickyAdEviction(doc);
    this._attachIntersection(doc);
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
      parent.insertBefore(style, parent.firstChild);
    } catch (e) {}
  },

  /* ─────────────────────────────────────────────────
     Layer 2 – JS selector sweep
     Layer 3 – Heuristic scoring engine

     FIX: Raised heuristic threshold from 70 → 85.
     The old threshold was low enough that content
     containers with a few mild ad signals (IAB-like
     geometry + a class substring) would be hidden.
     85 requires strong, unambiguous ad evidence.
  ───────────────────────────────────────────────── */
  _jsHidePass(doc) {
    let hidden = 0;

    for (const sel of this._selectors) {
      try {
        for (const el of doc.querySelectorAll(sel)) {
          if (this._hideElement(el)) hidden++;
        }
      } catch (e) {}
    }

    /*
     * FIX: Heuristic scoring pass now uses threshold 85 (was 70).
     * Also narrowed candidate tag list — removed <header> and <footer>
     * entirely because page headers/footers are never ads themselves,
     * and the scoring engine was occasionally escalating into them.
     */
    try {
      const candidates = doc.querySelectorAll(
        "div, section, aside, ins, figure"
      );
      for (const el of candidates) {
        if (this._scoreAdLikelihood(el) >= 85) {
          if (this._hideElement(el)) hidden++;
        }
      }
    } catch (e) {}

    if (hidden > 0) console.log(`[LykonCosmetic] JS pass hid ${hidden} elements`);
  },

  /* ─────────────────────────────────────────────────
     ❿  SCORING ENGINE  (0–100)

     FIX summary vs previous version:
     • Empty container geometry bonus removed — skeleton
       loaders and lazy content containers look identical
       to empty ad slots; geometry alone is not reliable.
     • 'complementary' ARIA role no longer adds points —
       many sidebars that carry widgets and article asides
       use role="complementary" legitimately.
     • Weak text labels (single words like "ad", "sponsored",
       "promoted") no longer score unless the element also
       has a confirmed ad attribute (data-ad-slot etc.).
     • IAB geometry match still scores, but only contributes
       40 pts — requires at least one other signal to reach
       the new threshold of 85.
  ───────────────────────────────────────────────── */
  _scoreAdLikelihood(el) {
    let score = 0;
    try {
      const id      = (el.id            || "").toLowerCase();
      const cls     = (el.className     || "").toLowerCase();
      const style   = (el.getAttribute("style") || "").toLowerCase();
      const tag     = el.tagName.toLowerCase();
      const text    = (el.textContent   || "").trim().toLowerCase();
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
      if (/banner[-_]ad|ad[-_]banner/.test(cls))             score += 30;
      if (/placeholder/.test(cls))                           score += 10;
      if (/tpgnad_ad-wr|tpgnad/i.test(cls))                 score += 60;
      /*
       * FIX: Removed broad class signal for 'sponsor|promoted|advertori'
       * which was scoring real article elements (event sponsor listings,
       * promoted products with genuine content, advertorial sections that
       * should still be visible to the reader).
       */

      /* ── Attribute signals ── */
      if (el.hasAttribute("data-ad-slot"))          score += 50;
      if (el.hasAttribute("data-ad-client"))        score += 50;
      if (el.hasAttribute("data-google-query-id"))  score += 50;
      if (el.hasAttribute("data-adunit"))           score += 45;
      if (el.hasAttribute("data-dfp-ad"))           score += 45;
      if (el.hasAttribute("data-adslot"))           score += 45;
      if (el.hasAttribute("data-sponsored"))        score += 30;

      /* Track whether a strong ad attribute is confirmed — used below
         to decide whether weak text labels should add to the score */
      const hasConfirmedAdAttr = score >= 30;

      /* ── Geometry signals ── */
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const IAB_SIZES = [
        [728,90],[970,90],[970,250],[468,60],
        [300,250],[300,600],[336,280],[250,250],
        [160,600],[120,600],[300,1050],
        [320,50],[320,100],[300,50],
        [970,66],[980,120],[930,180],
      ];
      for (const [iw, ih] of IAB_SIZES) {
        if (Math.abs(w - iw) <= 4 && Math.abs(h - ih) <= 4) { score += 40; break; }
      }
      /*
       * FIX: Removed the "empty container at ad-like size" bonus.
       * Skeleton loaders, lazy-load placeholders, and collapsed
       * content panels all have zero text and similar dimensions.
       * Without a confirmed ad attribute, geometry + empty content
       * is not reliable enough to hide an element.
       *
       * FIX: Removed tall-narrow and wide-short shape bonuses for
       * the same reason — too many sidebar widgets and article image
       * containers share these proportions.
       */

      /* ── Content / label signals ── */
      if (this._adLabelTexts.has(text))                      score += 60;
      if (/^advertisement$|^advertorial$/i.test(text))       score += 60;
      if (/ad by |ads by |advert by/i.test(text))            score += 40;
      /*
       * FIX: Weak text labels ("ad", "sponsored", "promoted", etc.) now
       * only contribute if there is already a confirmed ad attribute.
       * A button labelled "Sponsored" or an aside with aria-label="ad"
       * on a real content page should not be hidden on its own.
       */
      if (hasConfirmedAdAttr && this._weakAdLabels.has(text))           score += 30;
      if (hasConfirmedAdAttr && ariaL && /\bad\b|advertisement/i.test(ariaL)) score += 20;
      if (ariaL && /^advertisement$|^advertorial$/i.test(ariaL))        score += 40;
      if (title && /^advertisement$|^advertorial$/i.test(title))        score += 30;
      /*
       * FIX: Removed the role="complementary" score bonus. Too many
       * sidebars that carry useful widgets (weather, related articles,
       * navigation) legitimately use this ARIA role.
       */

      /* ── Child iframe to tracker domain ── */
      try {
        for (const iframe of el.querySelectorAll("iframe[src]")) {
          const src = iframe.getAttribute("src") || "";
          if (this._trackerDomains.some(d => src.includes(d))) { score += 55; break; }
        }
      } catch (e) {}

      /* ── Style signals ── */
      if (style.includes("position:fixed") || style.includes("position: fixed")) {
        if (score > 30) score += 20;
      }
      if (/z-index\s*:\s*[1-9]\d{3,}/.test(style))         score += 10;
    } catch (e) {}
    return Math.min(score, 100);
  },

  /* ─────────────────────────────────────────────────
     Layer 5 – IntersectionObserver (lazy collapse)
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
  ───────────────────────────────────────────────── */
  _shadowDomPierce(doc) {
    try {
      const hosts = doc.querySelectorAll("*");
      for (const host of hosts) {
        if (!host.shadowRoot) continue;
        const shadow = host.shadowRoot;
        if (!shadow.getElementById("lykon-cosmetic-shadow")) {
          const style = doc.createElement("style");
          style.id = "lykon-cosmetic-shadow";
          style.textContent = this._cssRule;
          shadow.insertBefore(style, shadow.firstChild);
        }
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

     FIX: Threshold raised from 40 → 55.
     Fixed/sticky elements include cookie banners,
     navigation bars, chat widgets, and back-to-top
     buttons. A score of 40 was too easy to reach for
     these. 55 requires at least one strong ad signal
     (an ad attribute, a tracker iframe, or an explicit
     ad network class) in addition to the position.
  ───────────────────────────────────────────────── */
  _stickyAdEviction(doc) {
    try {
      const win = doc.defaultView;
      if (!win) return;

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

          /* FIX: threshold raised from 40 to 55 */
          if (this._scoreAdLikelihood(el) >= 55) {
            this._hideElement(el);
          }
        } catch (e) {}
      }
    } catch (e) {}
  },

  /* ─────────────────────────────────────────────────
     HIDE ELEMENT — walks up to find wrapper

     FIX: Two changes vs previous version:
     1. Max walk depth reduced from 6 → 3.
        Walking 6 levels up was regularly reaching
        major content wrapper divs when an ad was
        nested inside a card or article section.
     2. Bubble-up score threshold raised from 40 → 60.
        At 40, layout wrappers that merely contained
        one ad child would absorb the hide — taking
        all sibling content with them. 60 requires the
        parent to be an ad wrapper in its own right.
     3. Expanded structural tag protection list to include
        article, section, ul, ol, li, table — these are
        never themselves ad containers.
  ───────────────────────────────────────────────── */
  _hideElement(element) {
    try {
      let target = element;
      let parent = element?.parentElement;

      try {
        for (let e = element; e; e = e.parentElement) {
          const iid = (e.id || "").toLowerCase();
          const cls = (e.className || "").toString().toLowerCase();

          if (iid.startsWith("ads_")) return false;
          const parts = cls.split(/\s+/).filter(Boolean);
          for (const p of parts) if (p.startsWith("ads_")) return false;

          if (iid === "ignorediv" || iid === "ndpl-iframe" || iid === "videoembed") return false;
          if (
            cls.includes("ins_instory_dv") ||
            cls.includes("art-exp_wr") ||
            cls.includes("sp_txt") ||
            cls.includes("sp-hd") ||
            cls.includes("stp-wr") ||
            cls.includes("js-ad-section")
          ) return false;
        }
      } catch (_e) {}

      /*
       * FIX: Reduced max walk depth (6 → 3) and raised parent score
       * threshold (40 → 60). Also expanded the structural tag list
       * to prevent any content-bearing element from being used as
       * the hide target.
       */
      const STRUCTURAL_TAGS = new Set([
        "body","html","main","nav","header","footer",
        "article","section","ul","ol","li","table","tbody","tr","td",
      ]);

      for (let i = 0; i < 3 && parent; i++) {
        const tag = parent.tagName?.toLowerCase();
        if (STRUCTURAL_TAGS.has(tag)) break; // stop walking — never hide structural elements
        const parentScore = this._scoreAdLikelihood(parent);
        /* FIX: threshold 40 → 60 */
        if (parentScore >= 60) {
          target = parent;
        }
        parent = parent.parentElement;
      }

      if (target.style.display === "none") return false;

      target.style.setProperty("display",        "none",    "important");
      target.style.setProperty("visibility",     "hidden",  "important");
      target.style.setProperty("pointer-events", "none",    "important");
      target.style.setProperty("opacity",        "0",       "important");

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