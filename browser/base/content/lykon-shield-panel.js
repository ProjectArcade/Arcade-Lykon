var LykonShield = {
  _shieldsUp: true,
  _advancedOpen: false,

  init() {
    if (!gBrowser) {
      setTimeout(() => this.init(), 500);
      return;
    }

    // Read global enabled state first
    this._shieldsUp = globalThis.LykonAdblock?.getStats?.().enabled ?? true;
    this._syncFingerprintState();

    const btn = document.getElementById("lykon-shield-button");
    if (btn) {
      btn.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        this.open(btn);
      });
    }

    // Attach toggle listener via addEventListener
    const toggle = document.getElementById("lykon-shield-toggle");
    if (toggle) {
      toggle.addEventListener("change", (e) => {
        e.stopPropagation();
        this.toggleShields();
      });
    }

    const advancedHeader = document.getElementById("lykon-shield-advanced-header");
    if (advancedHeader) {
      advancedHeader.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        this.toggleAdvanced();
      });
    }

    const learnMoreLink = document.getElementById("lykon-shield-learn-more");
    if (learnMoreLink) {
      learnMoreLink.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        this.openLearnMore();
      });
    }

    gBrowser.tabContainer.addEventListener("TabSelect", () => {
      this._updateButtonState();
      this._syncShieldStateForCurrentSite();
    });
    gBrowser.addTabsProgressListener({
      onLocationChange: () => {
        this._updateButtonState();
        this._syncShieldStateForCurrentSite();
      }
    });

    this._updateButtonState();
    this._syncShieldStateForCurrentSite();
  },

  open(anchor = document.getElementById("lykon-shield-button")) {
    try {
      const popup = document.getElementById("lykon-shield-popup");
      if (!popup || !anchor) {
        console.error("[LykonShield] open failed: missing popup or anchor");
        return;
      }

      if (popup.state == "open") {
        popup.hidePopup();
        return;
      }

      this._onPanelOpen();
      popup.openPopup(anchor, "bottomright topright");
    } catch (e) {
      console.error("[LykonShield] open failed:", e);
    }
  },

  _isRestrictedPage() {
    try {
      const uri = gBrowser?.selectedBrowser?.currentURI;
      if (!uri) return false;
      const spec = uri.spec;
      return spec === "about:blank" ||
             spec === "about:newtab" ||
             spec === "about:home" ||
             spec === "about:privatebrowsing" ||
             (spec.startsWith("about:") && spec !== "about:reader");
    } catch(e) { return false; }
  },

  _getCurrentOrigin() {
    try {
      const uri = gBrowser?.selectedBrowser?.currentURI;
      if (!uri || this._isRestrictedPage()) return null;
      return uri.prePath;
    } catch(e) { return null; }
  },

  _updateButtonState() {
    const btn = document.getElementById("lykon-shield-button");
    if (!btn) return;
    if (this._isRestrictedPage()) {
      btn.setAttribute("disabled", "true");
      btn.style.opacity = "0.35";
      btn.style.pointerEvents = "none";
    } else {
      btn.removeAttribute("disabled");
      btn.style.opacity = "1";
      btn.style.pointerEvents = "";
    }
  },

  _syncShieldStateForCurrentSite() {
    const origin = this._getCurrentOrigin();
    if (!origin) return;
    const isDisabled = globalThis.LykonAdblock?.isOriginDisabled?.(origin) ?? false;
    this._shieldsUp = !isDisabled;
    // Sync checkbox visual state
    const toggle = document.getElementById("lykon-shield-toggle");
    if (toggle) toggle.checked = this._shieldsUp;
    this._refreshPanelStatus();
  },

  _refreshPanelStatus() {
    const statusEl = document.getElementById("lykon-shield-status-text");
    const hintEl = document.querySelector(".lykon-shield-status-hint");
    if (statusEl) {
      statusEl.textContent = this._shieldsUp ? "Blocking ads" : "Blocking disabled";
      statusEl.style.color = this._shieldsUp ? "#34c759" : "#ff453a";
    }
    if (hintEl) {
      hintEl.textContent = this._shieldsUp
        ? "You're browsing ad-free."
        : "Ads may appear on this site.";
    }
  },

  _onPanelOpen() {
    this._syncShieldStateForCurrentSite();
    this.updateSiteInfo();
  },

  updateSiteInfo() {
    try {
      const browser = gBrowser.selectedBrowser;
      const uri = browser?.currentURI;
      if (!uri) return;

      const origin = uri.prePath || "";
      const adblockStats = globalThis.LykonAdblock?.getStats?.(origin);
      const count = adblockStats?.ready ? adblockStats.siteBlockedCount : this._getBlockedCount();
      
      // Update all stats
      this._updateCount(count);
      this._updateTotalBlockedCount();
      this._updateTrackerBlockedCount();
      this._syncFingerprintState();

      // Warn user if bridge isn't ready (only CSS blocking active)
      const warningEl = document.getElementById("lykon-shield-bridge-warning");
      if (warningEl) {
        const bridgeReady = adblockStats?.ready ?? false;
        warningEl.style.display = bridgeReady ? "none" : "block";
        warningEl.textContent = bridgeReady
          ? ""
          : "⚠️ Network blocking unavailable — check browser console for errors.";
      }
    } catch(e) {
      console.error("[LykonShield] updateSiteInfo failed:", e);
    }
  },

  _getBlockedCount() {
    try {
      const browser = gBrowser.selectedBrowser;
      const blockedLog = browser?.securityUI?.contentBlockingLog;
      if (!blockedLog) return 0;
      const log = JSON.parse(blockedLog);
      let count = 0;
      for (const entries of Object.values(log)) {
        if (entries.some(e => e[0] === true)) count++;
      }
      return count;
    } catch(e) { return 0; }
  },

  _updateCount(count) {
    const el = document.getElementById("lykon-shield-count");
    if (el) el.textContent = count.toLocaleString();
  },

  _updateTotalBlockedCount() {
    try {
      const totalEl = document.getElementById("lykon-shield-total-count");
      const totalCount = globalThis.LykonAdblock?.getTotalBlockedCount?.() ?? 0;
      if (totalEl) totalEl.textContent = totalCount.toLocaleString();
    } catch(e) {}
  },

  _updateTrackerBlockedCount() {
    try {
      const origin = this._getCurrentOrigin();
      if (!origin) return;
      const trackerEl = document.getElementById("lykon-shield-tracker-count");
      const trackerCount = globalThis.LykonAdblock?.getTrackerBlockedCount?.(origin) ?? 0;
      if (trackerEl) trackerEl.textContent = trackerCount.toLocaleString();
    } catch(e) {}
  },

  _syncFingerprintState() {
    try {
      const el = document.getElementById("lykon-shield-fingerprint");
      const stateEl = document.getElementById("lykon-shield-fingerprint-count");
      const enabled = Services.prefs.getBoolPref("privacy.resistFingerprinting", false);
      if (el) el.checked = enabled;
      if (stateEl) {
        stateEl.textContent = enabled ? "On" : "Off";
        stateEl.style.color = enabled ? "#34c759" : "#ff453a";
      }
    } catch (e) {}
  },

  _reloadCurrentSite() {
    try {
      const browser = gBrowser?.selectedBrowser;
      const spec = browser?.currentURI?.spec || "";
      if (browser && spec && !spec.startsWith("about:")) {
        browser.reload();
      }
    } catch (e) {}
  },

  toggleShields() {
    const origin = this._getCurrentOrigin();
    if (!origin) {
      console.warn("[LykonShield] toggleShields: no valid origin for current tab");
      return;
    }

    // Read desired state directly from the checkbox
    const toggle = document.getElementById("lykon-shield-toggle");
    this._shieldsUp = toggle ? toggle.checked : !this._shieldsUp;
    this._refreshPanelStatus();

    console.log(`[LykonShield] toggleShields: origin=${origin} shieldsUp=${this._shieldsUp}`);

    try {
      globalThis.LykonAdblock?.setOriginEnabled?.(origin, this._shieldsUp);

      const browser = gBrowser.selectedBrowser;
      const perm = Services.perms;
      if (this._shieldsUp) {
        perm.removeFromPrincipal(browser.contentPrincipal, "trackingprotection");
      } else {
        perm.addFromPrincipal(
          browser.contentPrincipal,
          "trackingprotection",
          Services.perms.DENY_ACTION
        );
      }

      this._reloadCurrentSite();
    } catch(e) {
      console.error("[LykonShield] toggleShields failed:", e);
    }
  },

  toggleAdvanced() {
    this._advancedOpen = !this._advancedOpen;
    const el = document.getElementById("lykon-shield-advanced");
    const arrow = document.getElementById("lykon-shield-adv-arrow");
    const label = document.getElementById("lykon-shield-adv-label");
    if (el) el.style.display = this._advancedOpen ? "block" : "none";
    if (arrow) arrow.textContent = this._advancedOpen ? "⌃" : "⌄";
    if (label) label.textContent = this._advancedOpen
      ? "Hide advanced controls"
      : "Advanced controls";
  },

  setTrackerMode(mode) {
    try {
      const prefs = Services.prefs;
      if (mode === "aggressive") {
        prefs.setBoolPref("privacy.trackingprotection.enabled", true);
        prefs.setBoolPref("privacy.trackingprotection.socialtracking.enabled", true);
      } else if (mode === "standard") {
        prefs.setBoolPref("privacy.trackingprotection.enabled", true);
        prefs.setBoolPref("privacy.trackingprotection.socialtracking.enabled", false);
      } else {
        prefs.setBoolPref("privacy.trackingprotection.enabled", false);
      }
      this._reloadCurrentSite();
    } catch(e) {}
  },

  setHttpsMode(mode) {
    try {
      Services.prefs.setBoolPref("dom.security.https_only_mode", mode === "strict");
      this._reloadCurrentSite();
    } catch(e) {}
  },

  toggleScripts() {
    try {
      const el = document.getElementById("lykon-shield-scripts");
      Services.prefs.setBoolPref("javascript.enabled", !el?.checked);
      this._reloadCurrentSite();
    } catch(e) {}
  },

  toggleFingerprint() {
    try {
      const el = document.getElementById("lykon-shield-fingerprint");
      Services.prefs.setBoolPref("privacy.resistFingerprinting", el?.checked);
      this._syncFingerprintState();
      this._reloadCurrentSite();
    } catch(e) {}
  },

  setCookieMode(mode) {
    try {
      const val = mode === "all" ? 0 : mode === "third-party" ? 1 : 2;
      Services.prefs.setIntPref("network.cookie.cookieBehavior", val);
      this._reloadCurrentSite();
    } catch(e) {}
  },

  toggleForget() {
    try {
      const el = document.getElementById("lykon-shield-forget");
      Services.prefs.setIntPref("network.cookie.lifetimePolicy", el?.checked ? 2 : 0);
      this._reloadCurrentSite();
    } catch(e) {}
  },

  openLearnMore() {
    openTrustedLinkIn("https://lykon.vercel.app/lykon-shield", "tab");
    document.getElementById("lykon-shield-popup")?.hidePopup();
  },
};