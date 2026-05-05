/* ════════════════════════════════════════════════════
   LYKON SHIELD  —  lykon-shield.js
   ════════════════════════════════════════════════════ */

var LykonShield = {

  /* ─ DOM refs ─ */
  _el: {},
  _bound: false,

  /* ─ Init (called on popupshown) ─ */
  init() {
    const $ = id => document.getElementById(id);
    this._el = {
      button: $("lykon-shield-button"),
      toggle: $("lykon-shield-toggle"),
      content: $("lykon-shield-panel-content"),
      statusText: $("lykon-shield-status-text"),
      statusHint: $("lks-status-hint"),
      dot: $("lks-dot"),
      heroTitle: $("lykon-shield-hero-title"),
      heroSub: $("lykon-shield-hero-sub"),
      heroAction: $("lykon-shield-hero-action"),
      advHeader: $("lykon-shield-advanced-header"),
      advPanel: $("lykon-shield-advanced"),
      advArrow: $("lykon-shield-adv-arrow"),
      count: $("lykon-shield-count"),
      total: $("lykon-shield-total-count"),
      trackers: $("lykon-shield-tracker-count"),
      bandwidth: $("lykon-shield-bandwidth"),
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

  /* ─ Main toggle ─ */
  _onMainToggle() {
    const on = this._el.toggle.checked;
    this._applyEnabledState(on);
    try {
      Services.prefs.setBoolPref("browser.adblock.enabled", on);
      console.log("[LykonShield] Pref set to:", Services.prefs.getBoolPref("browser.adblock.enabled"));

      Services.obs.notifyObservers(null, "adblock-shield-toggled", on ? "true" : "false");
      console.log("[LykonShield] Observer fired: adblock-shield-toggled =", on);

      const win = Services.wm.getMostRecentWindow("navigator:browser");
      if (win && win.gBrowser) {
        win.gBrowser.selectedBrowser.reload();
        console.log("[LykonShield] Tab reloaded");
      }
    } catch (e) {
      console.error("[LykonShield] Toggle error:", e);
    }
  },

  _applyEnabledState(on) {
    if (this._el.content) {
      this._el.content.setAttribute("data-paused", on ? "false" : "true");
    }
    if (this._el.button) {
      this._el.button.setAttribute(
        "image",
        on
          ? "chrome://browser/skin/preferences/Adblocker-on.png"
          : "chrome://browser/skin/preferences/Adblocker-off-concer.png"
      );
    }
    if (this._el.statusText) {
      this._el.statusText.textContent = on ? "Blocking ads" : "Lykon Shield is Down";
    }
    if (this._el.statusHint) {
      this._el.statusHint.textContent = on
        ? "You're browsing ad-free."
        : "You may see more ads and trackers online.";
    }
    if (this._el.heroTitle) {
      this._el.heroTitle.textContent = on ? "You're protected!" : "Lykon Shield is Down";
    }
    if (this._el.heroSub) {
      this._el.heroSub.textContent = on
        ? "Enjoy an ad-free browsing experience."
        : "You may see more ads and trackers online.";
    }
    if (this._el.heroAction) {
      this._el.heroAction.textContent = on ? "Turn off Lykon Shield" : "Turn on Lykon Shield";
    }
  },

  /* ─ Advanced panel ─ */
  _toggleAdvanced() {
    if (!this._el.advPanel || !this._el.advArrow) return;
    const open = this._el.advPanel.style.display !== "none";
    this._el.advPanel.style.display = open ? "none" : "block";
    this._el.advArrow.classList.toggle("open", !open);
  },

  /* ─ Pref setters ─ */
  setTrackerMode(val) {
    try { Services.prefs.setStringPref("lykon.shield.tracker.mode", val); } catch (e) { }
  },
  setHttpsMode(val) {
    try { Services.prefs.setStringPref("lykon.shield.https.mode", val); } catch (e) { }
  },
  toggleScripts() {
    const el = document.getElementById("lykon-shield-scripts");
    try { Services.prefs.setBoolPref("lykon.shield.scripts.blocked", el.checked); } catch (e) { }
  },
  toggleFingerprint() {
    const el = document.getElementById("lykon-shield-fingerprint");
    const lbl = document.getElementById("lykon-shield-fingerprint-count");
    try { Services.prefs.setBoolPref("lykon.shield.fingerprint.enabled", el.checked); } catch (e) { }
    lbl.textContent = el.checked ? "Active" : "Off";
  },
  setCookieMode(val) {
    try { Services.prefs.setStringPref("lykon.shield.cookie.mode", val); } catch (e) { }
  },
  toggleForget() {
    const el = document.getElementById("lykon-shield-forget");
    try { Services.prefs.setBoolPref("lykon.shield.forget.onexit", el.checked); } catch (e) { }
  },

  /* ─ Load saved prefs into UI ─ */
  _loadPrefs() {
    try {
      const on = Services.prefs.getBoolPref("browser.adblock.enabled", true);
      this._el.toggle.checked = on;
      this._applyEnabledState(on);

      document.getElementById("lykon-shield-tracker-mode").value =
        Services.prefs.getStringPref("lykon.shield.tracker.mode", "standard");
      document.getElementById("lykon-shield-https-mode").value =
        Services.prefs.getStringPref("lykon.shield.https.mode", "soft");
      document.getElementById("lykon-shield-cookie-mode").value =
        Services.prefs.getStringPref("lykon.shield.cookie.mode", "all");

      const sc = Services.prefs.getBoolPref("lykon.shield.scripts.blocked", false);
      document.getElementById("lykon-shield-scripts").checked = sc;

      const fp = Services.prefs.getBoolPref("lykon.shield.fingerprint.enabled", false);
      document.getElementById("lykon-shield-fingerprint").checked = fp;
      document.getElementById("lykon-shield-fingerprint-count").textContent = fp ? "Active" : "Off";

      const fg = Services.prefs.getBoolPref("lykon.shield.forget.onexit", false);
      document.getElementById("lykon-shield-forget").checked = fg;
    } catch (e) {
      this._applyEnabledState(true);
    }
  },

  /* ─ Update stat counters ─ */
  _updateStats() {
    try {
      const sess = Services.prefs.getIntPref("lykon.shield.stats.session", 0);
      const total = Services.prefs.getIntPref("lykon.shield.stats.total", 0);
      const tracker = Services.prefs.getIntPref("lykon.shield.stats.trackers", 0);
      const bytes = Services.prefs.getIntPref("lykon.shield.stats.bytes", 0);

      this._el.count.textContent = sess.toLocaleString();
      this._el.total.textContent = total.toLocaleString();
      this._el.trackers.textContent = tracker.toLocaleString();
      this._el.bandwidth.textContent = this._fmtBytes(bytes);
    } catch (e) { }
  },

  /* ─ Format bytes ─ */
  _fmtBytes(b) {
    if (b < 1024) return b + " B";
    if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
    if (b < 1073741824) return (b / 1048576).toFixed(1) + " MB";
    return (b / 1073741824).toFixed(2) + " GB";
  },
};

/* ════════════════════════════════════════════════════
   LYKON COSMETIC FILTER  —  Advanced hide-based approach
   ════════════════════════════════════════════════════ */
var LykonCosmeticFilter = {
  _initialized: false,
  _observers: new WeakMap(),
  _docObserverBound: false,
  _shieldObserverBound: false,
  _globalSheetURI: null,

  /* ─────────────────────────────────────────────────
     Selector list — used for BOTH the injected
     <style> block AND the JS per-element pass.
  ───────────────────────────────────────────────── */
  _selectors: [
    "ins.adsbygoogle",
    "[id^='google_ads_iframe_']",
    "iframe[id^='google_ads_iframe_']",
    "iframe[name^='google_ads_iframe_']",
    "[id^='div-gpt-ad-']",
    "div[id^='div-gpt-ad-']",
    ".adInv",
    "div.adInv",
    ".paisa-wrapper.mrec_placeHolder",
    "div.paisa-wrapper.mrec_placeHolder",
    ".mrec_placeHolder",
    ".ad_position_box.ad-placeholder.mb20.mt-20.desktop.adsbygoogle",
    "div.ad_position_box.ad-placeholder.mb20.mt-20.desktop.adsbygoogle",
    "div.ad_position_box.ad-placeholder.desktop.adsbygoogle",
    ".ad_position_box.ad-placeholder.adsbygoogle",
    "[id*='asw-']",
    "[id*='aswift_']",
    "[id*='google_ads_']",
    "[id*='gpt_unit']",
    "[id*='div-gpt-ad']",
    "[id^='ad_']",
    "[id^='ad-']",
    "[class*='adsbygoogle']",
    "[class*='gpt-ad']",
    "[class*='ad-slot']",
    "[class*='ad-unit']",
    "[class*='ad-banner']",
    "[class*='advertisement']",
    "[class*='sponsored']",
    "[class*='promoted']",
    "[class*='adwrapper']",
    "[data-ad-slot]",
    "[data-ad-format]",
    "[data-ad-client]",
    "[data-google-query-id]",
    "iframe[src*='doubleclick.net']",
    "iframe[src*='googlesyndication']",
    "iframe[src*='googleadservices']",
    "iframe[src*='ads.google']",
    "iframe[src*='amazon-adsystem']",
    "img[src*='doubleclick']",
    "img[src*='googlesyndication']",
    "img[src*='google-analytics']",
    "img[src*='facebook.com/tr']",
    "[class*='ad-placeholder']",
    "[class*='ad-text']",
    "[class*='ad-container']",
    "[class*='ad-wrapper']",
    "[class*='ad-block']",
    "[class*='ad-holder']",
    "[class*='ad-space']",
    "[class*='ad-area']",
    "[class*='ad-box']",
    "[class*='ad-label']",
    "span.ad-text",
    "div.ad-placeholder",
  ],

  _strictCollapseSelectors: [
    "[id^='div-gpt-ad-']",
    "div[id^='div-gpt-ad-']",
    ".adInv",
    "div.adInv",
    ".paisa-wrapper.mrec_placeHolder",
    "div.paisa-wrapper.mrec_placeHolder",
    ".mrec_placeHolder",
    ".ad_position_box.ad-placeholder.mb20.mt-20.desktop.adsbygoogle",
    "div.ad_position_box.ad-placeholder.mb20.mt-20.desktop.adsbygoogle",
    "div.ad_position_box.ad-placeholder.desktop.adsbygoogle",
    ".ad_position_box.ad-placeholder.adsbygoogle",
    "[id^='google_ads_iframe_']",
    "iframe[id^='google_ads_iframe_']",
    "iframe[name^='google_ads_iframe_']",
  ],

  /* CSS block injected once per document */
  get _cssRule() {
    const hideRule = this._selectors.join(",\n") +
      " {\n  display: none !important;\n  visibility: hidden !important;\n  pointer-events: none !important;\n}";

    const collapseRule = this._strictCollapseSelectors.join(",\n") +
      " {\n  display: none !important;\n  visibility: hidden !important;\n  pointer-events: none !important;\n  height: 0 !important;\n  min-height: 0 !important;\n  max-height: 0 !important;\n  margin: 0 !important;\n  padding: 0 !important;\n  border: 0 !important;\n}";

    return hideRule + "\n" + collapseRule;
  },

  get _globalCssRule() {
    return "@-moz-document url-prefix(\"http://\"), url-prefix(\"https://\") {\n" +
      this._cssRule +
      "\n}";
  },

  /* ─ Entry point ─ */
  init() {
    if (this._initialized) return;
    this._initialized = true;

    try {
      this._startShieldObserver();
      this._ensureGlobalStylesheetState();
      this._startDocumentObserver();

      const win = Services.wm.getMostRecentWindow("navigator:browser");
      if (!win || !win.gBrowser) return;

      this._attachBrowserWindow(win);

      const enumerator = Services.wm.getEnumerator("navigator:browser");
      while (enumerator.hasMoreElements()) {
        const browserWin = enumerator.getNext();
        if (browserWin?.gBrowser) this._attachBrowserWindow(browserWin);
      }
    } catch (e) {
      console.error("[LykonCosmetic] init error:", e);
    }
  },

  _getStyleSheetService() {
    return Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
  },

  _getGlobalSheetURI() {
    if (this._globalSheetURI) {
      return this._globalSheetURI;
    }

    const cssData = encodeURIComponent(this._globalCssRule);
    this._globalSheetURI = Services.io.newURI(`data:text/css;charset=utf-8,${cssData}`);
    return this._globalSheetURI;
  },

  _registerGlobalStylesheet() {
    try {
      const sss = this._getStyleSheetService();
      const uri = this._getGlobalSheetURI();
      if (!sss.sheetRegistered(uri, sss.AGENT_SHEET)) {
        sss.loadAndRegisterSheet(uri, sss.AGENT_SHEET);
      }
    } catch (e) {
      console.error("[LykonCosmetic] register sheet error:", e);
    }
  },

  _unregisterGlobalStylesheet() {
    try {
      const sss = this._getStyleSheetService();
      const uri = this._getGlobalSheetURI();
      if (sss.sheetRegistered(uri, sss.AGENT_SHEET)) {
        sss.unregisterSheet(uri, sss.AGENT_SHEET);
      }
    } catch (e) {
      console.error("[LykonCosmetic] unregister sheet error:", e);
    }
  },

  _ensureGlobalStylesheetState() {
    if (this._isShieldEnabled()) {
      this._registerGlobalStylesheet();
      return;
    }
    this._unregisterGlobalStylesheet();
  },

  _isShieldEnabled() {
    try {
      return Services.prefs.getBoolPref("browser.adblock.enabled", true);
    } catch (e) {
      return true;
    }
  },

  _startDocumentObserver() {
    if (this._docObserverBound) return;
    try {
      Services.obs.addObserver(this, "document-element-inserted");
      this._docObserverBound = true;
    } catch (e) {
      console.error("[LykonCosmetic] doc observer error:", e);
    }
  },

  _startShieldObserver() {
    if (this._shieldObserverBound) return;
    try {
      Services.obs.addObserver(this, "adblock-shield-toggled");
      this._shieldObserverBound = true;
    } catch (e) {
      console.error("[LykonCosmetic] shield observer error:", e);
    }
  },

  observe(subject, topic) {
    if (topic === "adblock-shield-toggled") {
      this._ensureGlobalStylesheetState();
      return;
    }

    if (topic !== "document-element-inserted") {
      return;
    }

    const doc = subject;
    if (!doc || doc.nodeType !== 9 || !doc.location) {
      return;
    }

    const protocol = doc.location.protocol;
    if (protocol !== "http:" && protocol !== "https:") {
      return;
    }

    if (!this._isShieldEnabled()) {
      return;
    }

    this._injectStylesheet(doc);
  },

  /* ─ Attach per browser window ─ */
  _attachBrowserWindow(win) {
    try {
      if (!win?.gBrowser || win.__lykonCosmeticFilterBound) return;
      win.__lykonCosmeticFilterBound = true;

      for (const browser of win.gBrowser.browsers) {
        this._observeBrowser(browser);
      }

      win.gBrowser.tabContainer.addEventListener("TabOpen", e => {
        const browser = e.target?.linkedBrowser;
        if (browser) this._observeBrowser(browser);
      }, true);

      win.gBrowser.tabContainer.addEventListener("SSTabRestored", e => {
        const browser = e.target?.linkedBrowser;
        if (browser) this._observeBrowser(browser);
      }, true);
    } catch (e) {
      console.error("[LykonCosmetic] attach error:", e);
    }
  },

  /* ─ Observe a single browser frame ─ */
  _observeBrowser(browser) {
    try {
      if (!browser || this._observers.has(browser)) return;

      const doc = browser.contentDocument;
      if (!doc || doc.nodeType !== 9 || !doc.defaultView) return;

      this.run(doc);

      const observer = new doc.defaultView.MutationObserver(() => this.run(doc));

      const root = doc.documentElement;
      if (!root) return;

      observer.observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: [
          "id", "class", "style",
          "data-ad-slot", "data-ad-format",
          "data-ad-client", "data-google-query-id",
        ],
      });

      this._observers.set(browser, observer);
    } catch (e) {
      console.error("[LykonCosmetic] observe error:", e);
    }
  },

  /* ─────────────────────────────────────────────────
     run(doc)
     1. Inject a <style> block once — covers elements
        that exist now AND future ones parsed by the
        browser before JS fires.
     2. JS pass — hides any already-rendered nodes that
        CSS alone may miss (dynamic inserts, iframes
        that set src after parse, empty containers).
  ───────────────────────────────────────────────── */
  run(doc) {
    if (!doc || doc.nodeType !== 9) return;
    if (!this._isShieldEnabled()) return;

    this._injectStylesheet(doc);
    this._jsHidePass(doc);
  },

  /* ─ Step 1 : CSS stylesheet injection ─ */
  _injectStylesheet(doc) {
    try {
      if (doc.getElementById("lykon-cosmetic-filter")) return;

      const parent = doc.head || doc.documentElement;
      if (!parent) return;

      const style = doc.createElement("style");
      style.id = "lykon-cosmetic-filter";
      style.textContent = this._cssRule;
      parent.appendChild(style);
    } catch (e) { }
  },

  /* ─ Step 2 : JS element-level hide pass ─ */
  _jsHidePass(doc) {
    let hidden = 0;

    /* Selector-matched elements */
    for (const selector of this._selectors) {
      try {
        for (const el of doc.querySelectorAll(selector)) {
          if (this._hideElement(el)) hidden++;
        }
      } catch (e) { }
    }

    /* Empty ad-like containers that selectors don't catch */
    try {
      for (const el of doc.querySelectorAll("div, section, aside, article, ins")) {
        if (this._looksLikeAdContainer(el) && this._hideElement(el)) hidden++;
      }
    } catch (e) { }

    if (hidden > 0) {
      console.log(`[LykonCosmetic] JS pass hid ${hidden} ad elements`);
    }
  },

  /* ─────────────────────────────────────────────────
     _hideElement
     Walks up to 5 levels to find the outermost
     ad-wrapper and hides the whole block via CSS.
     Does NOT remove from DOM — layout-safe.
  ───────────────────────────────────────────────── */
  _hideElement(element) {
    try {
      let target = element;
      let parent = element?.parentElement;

      for (let i = 0; i < 5 && parent; i++) {
        const id = (parent.id || "").toLowerCase();
        const cls = (parent.className || "").toLowerCase();
        const data = [
          parent.getAttribute("data-ad-slot"),
          parent.getAttribute("data-ad-format"),
          parent.getAttribute("data-ad-client"),
          parent.getAttribute("data-google-query-id"),
        ].filter(Boolean).join(" ").toLowerCase();

        if (
          id.includes("asw") || id.includes("gpt") || id.includes("ad") ||
          cls.includes("adsbygoogle") || cls.includes("ad") ||
          cls.includes("placeholder") || cls.includes("mrec") || cls.includes("paisa-wrapper") ||
          data.includes("ad")
        ) {
          target = parent;
        }
        parent = parent.parentElement;
      }

      /* Apply hide — idempotent, won't double-count */
      if (target.style.display === "none") return false;

      target.style.setProperty("display", "none", "important");
      target.style.setProperty("visibility", "hidden", "important");
      target.style.setProperty("pointer-events", "none", "important");
      return true;
    } catch (e) {
      try {
        if (element && element.style.display !== "none") {
          element.style.setProperty("display", "none", "important");
          return true;
        }
      } catch (_) { }
      return false;
    }
  },

  /* ─ Heuristic: is this an empty ad wrapper? ─ */
  _looksLikeAdContainer(el) {
    try {
      const id = (el.id || "").toLowerCase();
      const cls = (el.className || "").toLowerCase();
      const style = (el.getAttribute("style") || "").toLowerCase();
      const text = (el.textContent || "").trim();

      // ── NEW: hide elements whose only visible text is "Advertisement" ──
      const isAdLabel =
        text === "Advertisement" ||
        text === "ADVERTISEMENT" ||
        text === "Sponsored" ||
        text === "SPONSORED";

      const hasAdMarker =
        id.includes("asw") || id.includes("gpt") || id.includes("ad") ||
        cls.includes("adsbygoogle") || cls.includes("ad") ||
        cls.includes("sponsored") || cls.includes("promoted") ||
        cls.includes("ad-placeholder") ||                   // ← NEW
        el.hasAttribute("data-ad-slot") ||
        el.hasAttribute("data-ad-client") ||
        el.hasAttribute("data-google-query-id") ||
        style.includes("height: 280px") ||
        style.includes("min-height: 250px") ||
        (style.includes("display: block") && text.length === 0);

      // Hide if it's just an "Advertisement" label, or matches ad markers
      if (isAdLabel) return true;
      if (!hasAdMarker) return false;

      const rect = el.getBoundingClientRect();
      return (rect.width > 0 || rect.height > 0) && text.length === 0;
    } catch (e) {
      return false;
    }
  },
};

/* Fire on popup open (only where popup exists) */
(function () {
  function startCosmeticFiltering() {
    try {
      LykonCosmeticFilter.init();
    } catch (e) {
      console.error("[LykonCosmetic] start error:", e);
    }
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
