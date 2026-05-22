(function() {
  "use strict";

  const { Services } = ChromeUtils.importESModule(
    "resource://gre/modules/Services.sys.mjs"
  );

  const PREF_AUTO_ENABLED = "lykon.optimise.auto.enabled";
  const AUTO_MIN_BYTES = 157286400;

  const LykonOptimiser = {
    _bound: false,
    _daemonTimer: null,

    init() {
      if (this._bound) return;

      const popup = document.getElementById("lykon-optimise-popup");
      if (!popup) return;

      popup.addEventListener("popupshown", () => this.updatePanel());

      const toggle = document.getElementById("lykon-optimise-auto-toggle");
      if (toggle) {
        toggle.checked = Services.prefs.getBoolPref(PREF_AUTO_ENABLED, false);
        toggle.addEventListener("change", () => {
          Services.prefs.setBoolPref(PREF_AUTO_ENABLED, toggle.checked);
          this.toggleDaemon(toggle.checked);
        });
      }

      const btn = document.getElementById("lykon-optimise-now-btn");
      if (btn) {
        btn.addEventListener("click", () => this.manualOptimise());
      }

      this.toggleDaemon(Services.prefs.getBoolPref(PREF_AUTO_ENABLED, false));
      this._bound = true;
    },

    toggleDaemon(enable) {
      if (this._daemonTimer) {
        clearInterval(this._daemonTimer);
        this._daemonTimer = null;
      }
      if (enable) {
        this._daemonTimer = setInterval(() => this.runAutoOptimise(), 30000);
      }
    },

    canDiscard(tab) {
      if (tab.selected || tab.pinned || tab.soundPlaying || tab.pictureinpicture) {
        return false;
      }
      const browser = tab.linkedBrowser;
      if (!browser) return false;
      if (window.webrtcUI && window.webrtcUI.browserHasStreams && window.webrtcUI.browserHasStreams(browser)) {
        return false;
      }
      if (browser.browsingContext?.currentWindowGlobal?.hasActivePeerConnections &&
          browser.browsingContext.currentWindowGlobal.hasActivePeerConnections()) {
        return false;
      }
      if (window.PrivateBrowsingUtils && window.PrivateBrowsingUtils.isBrowserPrivate && window.PrivateBrowsingUtils.isBrowserPrivate(browser)) {
        return false;
      }
      if (tab.discarded || !tab.linkedPanel || tab.hasAttribute("discarded")) {
        return false;
      }
      return true;
    },

    async updatePanel() {
      const activeEl = document.getElementById("lko-active-memory");
      const totalEl = document.getElementById("lko-total-memory");
      const countEl = document.getElementById("lko-optimised-count");

      if (activeEl) activeEl.textContent = "Calculating...";
      if (totalEl) totalEl.textContent = "Calculating...";

      try {
        const procInfo = await ChromeUtils.requestProcInfo();
        const activeTab = gBrowser.selectedTab;
        const activePids = new Set(gBrowser.getTabPids(activeTab));

        const allTabPids = new Set();
        for (const tab of gBrowser.tabs) {
          const pids = gBrowser.getTabPids(tab);
          for (const pid of pids) {
            allTabPids.add(pid);
          }
        }

        let activeTabMemory = 0;
        let totalTabsMemory = 0;

        for (const child of procInfo.children) {
          if (activePids.has(child.pid)) {
            activeTabMemory += child.memory;
          }
          if (allTabPids.has(child.pid)) {
            totalTabsMemory += child.memory;
          }
        }

        if (activeEl) activeEl.textContent = this.formatBytes(activeTabMemory);
        if (totalEl) totalEl.textContent = this.formatBytes(totalTabsMemory);
      } catch (e) {
        if (activeEl) activeEl.textContent = "Unavailable";
        if (totalEl) totalEl.textContent = "Unavailable";
      }

      if (countEl) {
        const count = gBrowser.tabs.filter(t => !t.linkedPanel).length;
        countEl.textContent = count.toString();
      }
    },

    async manualOptimise() {
      const btn = document.getElementById("lykon-optimise-now-btn");
      if (btn) {
        btn.disabled = true;
        const textSpan = btn.querySelector(".lko-btn-text");
        if (textSpan) textSpan.textContent = "Optimising...";
      }

      const tabsToDiscard = gBrowser.tabs.filter(t => this.canDiscard(t));
      for (const tab of tabsToDiscard) {
        try {
          await gBrowser.prepareDiscardBrowser(tab);
          gBrowser.discardBrowser(tab, true);
        } catch (e) {}
      }

      try {
        Cc["@mozilla.org/memory-reporter-manager;1"]
          .getService(Ci.nsIMemoryReporterManager)
          .minimizeMemoryUsage(() => {});
      } catch (e) {}

      setTimeout(() => {
        this.updatePanel();
        if (btn) {
          btn.disabled = false;
          const textSpan = btn.querySelector(".lko-btn-text");
          if (textSpan) textSpan.textContent = "Optimise Now";
        }
      }, 1500);
    },

    async runAutoOptimise() {
      if (!Services.prefs.getBoolPref(PREF_AUTO_ENABLED, false)) {
        this.toggleDaemon(false);
        return;
      }

      try {
        const procInfo = await ChromeUtils.requestProcInfo();
        const discardCandidates = [];

        for (const tab of gBrowser.tabs) {
          if (!this.canDiscard(tab)) continue;

          const pids = new Set(gBrowser.getTabPids(tab));
          let tabMemory = 0;

          for (const child of procInfo.children) {
            if (pids.has(child.pid)) {
              tabMemory += child.memory;
            }
          }

          if (tabMemory > AUTO_MIN_BYTES) {
            discardCandidates.push(tab);
          }
        }

        if (discardCandidates.length > 0) {
          for (const tab of discardCandidates) {
            await gBrowser.prepareDiscardBrowser(tab);
            gBrowser.discardBrowser(tab, true);
          }

          Cc["@mozilla.org/memory-reporter-manager;1"]
            .getService(Ci.nsIMemoryReporterManager)
            .minimizeMemoryUsage(() => {});
        }
      } catch (e) {}
    },

    formatBytes(bytes) {
      if (bytes === 0) return "0 MB";
      if (bytes < 1024) return bytes + " B";
      if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
      if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + " MB";
      return (bytes / 1073741824).toFixed(1) + " GB";
    }
  };

  const bindPopup = () => {
    const popup = document.getElementById("lykon-optimise-popup");
    if (!popup || popup.dataset.lkoBound === "true") return;
    popup.dataset.lkoBound = "true";
    LykonOptimiser.init();
  };

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", () => bindPopup(), { once: true });
  } else {
    bindPopup();
  }
})();
