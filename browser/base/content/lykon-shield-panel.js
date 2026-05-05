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
        button:      $("lykon-shield-button"),
        toggle:      $("lykon-shield-toggle"),
        content:     $("lykon-shield-panel-content"),
        statusText:  $("lykon-shield-status-text"),
        statusHint:  $("lks-status-hint"),
        dot:         $("lks-dot"),
        heroTitle:   $("lykon-shield-hero-title"),
        heroSub:     $("lykon-shield-hero-sub"),
        heroAction:  $("lykon-shield-hero-action"),
        advHeader:   $("lykon-shield-advanced-header"),
        advPanel:    $("lykon-shield-advanced"),
        advArrow:    $("lykon-shield-adv-arrow"),
        count:       $("lykon-shield-count"),
        total:       $("lykon-shield-total-count"),
        trackers:    $("lykon-shield-tracker-count"),
        bandwidth:   $("lykon-shield-bandwidth"),
      };

      if (!this._el.toggle || !this._el.content) {
        return;
      }

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
    
    // Fire the observer topic ShieldIntegration listens to directly
    Services.obs.notifyObservers(null, "adblock-shield-toggled", on ? "true" : "false");
    console.log("[LykonShield] Observer fired: adblock-shield-toggled =", on);

    // Reload current tab
    const win = Services.wm.getMostRecentWindow("navigator:browser");
    if (win && win.gBrowser) {
      win.gBrowser.selectedBrowser.reload();
      console.log("[LykonShield] Tab reloaded");
    }
  } catch(e) {
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
      if (!this._el.advPanel || !this._el.advArrow) {
        return;
      }
      const open = this._el.advPanel.style.display !== "none";
      this._el.advPanel.style.display = open ? "none" : "block";
      this._el.advArrow.classList.toggle("open", !open);
    },

    /* ─ Pref setters ─ */
    setTrackerMode(val) {
      try { Services.prefs.setStringPref("lykon.shield.tracker.mode", val); } catch(e) {}
    },

    setHttpsMode(val) {
      try { Services.prefs.setStringPref("lykon.shield.https.mode", val); } catch(e) {}
    },

    toggleScripts() {
      const el = document.getElementById("lykon-shield-scripts");
      try { Services.prefs.setBoolPref("lykon.shield.scripts.blocked", el.checked); } catch(e) {}
    },

    toggleFingerprint() {
      const el  = document.getElementById("lykon-shield-fingerprint");
      const lbl = document.getElementById("lykon-shield-fingerprint-count");
      try { Services.prefs.setBoolPref("lykon.shield.fingerprint.enabled", el.checked); } catch(e) {}
      lbl.textContent = el.checked ? "Active" : "Off";
    },

    setCookieMode(val) {
      try { Services.prefs.setStringPref("lykon.shield.cookie.mode", val); } catch(e) {}
    },

    toggleForget() {
      const el = document.getElementById("lykon-shield-forget");
      try { Services.prefs.setBoolPref("lykon.shield.forget.onexit", el.checked); } catch(e) {}
    },

    /* ─ Load saved prefs into UI ─ */
    _loadPrefs() {
      try {
        const on = Services.prefs.getBoolPref("browser.adblock.enabled", true);
        this._el.toggle.checked = on;
        this._applyEnabledState(on);

        const tm = Services.prefs.getStringPref("lykon.shield.tracker.mode", "standard");
        document.getElementById("lykon-shield-tracker-mode").value = tm;

        const hm = Services.prefs.getStringPref("lykon.shield.https.mode", "soft");
        document.getElementById("lykon-shield-https-mode").value = hm;

        const cm = Services.prefs.getStringPref("lykon.shield.cookie.mode", "all");
        document.getElementById("lykon-shield-cookie-mode").value = cm;

        const sc = Services.prefs.getBoolPref("lykon.shield.scripts.blocked", false);
        document.getElementById("lykon-shield-scripts").checked = sc;

        const fp = Services.prefs.getBoolPref("lykon.shield.fingerprint.enabled", false);
        document.getElementById("lykon-shield-fingerprint").checked = fp;
        document.getElementById("lykon-shield-fingerprint-count").textContent = fp ? "Active" : "Off";

        const fg = Services.prefs.getBoolPref("lykon.shield.forget.onexit", false);
        document.getElementById("lykon-shield-forget").checked = fg;

      } catch(e) {
        this._applyEnabledState(true);
      }
    },

    /* ─ Update stat counters ─ */
    _updateStats() {
      try {
        const sess    = Services.prefs.getIntPref("lykon.shield.stats.session",  0);
        const total   = Services.prefs.getIntPref("lykon.shield.stats.total",    0);
        const tracker = Services.prefs.getIntPref("lykon.shield.stats.trackers", 0);
        const bytes   = Services.prefs.getIntPref("lykon.shield.stats.bytes",    0);

        this._el.count.textContent    = sess.toLocaleString();
        this._el.total.textContent    = total.toLocaleString();
        this._el.trackers.textContent = tracker.toLocaleString();
        this._el.bandwidth.textContent = this._fmtBytes(bytes);
      } catch(e) {}
    },

    /* ─ Format bytes ─ */
    _fmtBytes(b) {
      if (b < 1024)       return b + " B";
      if (b < 1048576)    return (b / 1024).toFixed(1) + " KB";
      if (b < 1073741824) return (b / 1048576).toFixed(1) + " MB";
      return (b / 1073741824).toFixed(2) + " GB";
    },
  };

  /* Fire on popup open (only where popup exists) */
  (function() {
    function bindPopup() {
      const popup = document.getElementById("lykon-shield-popup");
      if (!popup || popup.dataset.lksBound == "true") {
        return;
      }
      popup.dataset.lksBound = "true";
      popup.addEventListener("popupshown", () => LykonShield.init());
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", bindPopup, { once: true });
    } else {
      bindPopup();
    }
  })();