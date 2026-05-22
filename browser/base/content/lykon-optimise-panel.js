(function () {
  "use strict";



  const Cc = Components.classes;
  const Ci = Components.interfaces;

  const PREF_AUTO_ENABLED = "lykon.optimise.auto.enabled";
  const PREF_AGGRESSIVENESS = "lykon.optimise.aggressiveness";
  const PREF_TOTAL_SAVED_MB = "lykon.optimise.total.saved.mb";

  const EXCLUDED_DOMAINS = [
    "youtube.com",
    "spotify.com",
    "discord.com",
    "slack.com",
    "teams.microsoft.com",
    "zoom.us",
    "meet.google.com",
    "whatsapp.com",
    "telegram.org",
    "netflix.com",
  ];

  const LykonOptimiser = {
    _bound: false,
    _daemonTimer: null,
    _panelTimer: null,
    _lastActiveMemory: null,
    _lastTotalMemory: null,

    init() {
      if (this._bound) return;

      try {
        const toggle = document.getElementById("lykon-optimise-auto-toggle");
        if (toggle) {
          try {
            toggle.checked = Services.prefs.getBoolPref(PREF_AUTO_ENABLED, false);
          } catch (e) {
            toggle.checked = false;
          }
          toggle.addEventListener("change", () => {
            Services.prefs.setBoolPref(PREF_AUTO_ENABLED, toggle.checked);
            this.toggleDaemon(toggle.checked);
            this.updatePulsingDot(toggle.checked);
          });
          this.updatePulsingDot(toggle.checked);
        }

        const btn = document.getElementById("lykon-optimise-now-btn");
        if (btn) {
          btn.addEventListener("click", () => this.manualOptimise());
        }

        const select = document.getElementById("lykon-optimise-aggressiveness");
        if (select) {
          try {
            select.value = Services.prefs.getIntPref(PREF_AGGRESSIVENESS, 1).toString();
          } catch (e) {
            select.value = "1";
          }
          select.addEventListener("change", () => {
            const val = parseInt(select.value, 10);
            Services.prefs.setIntPref(PREF_AGGRESSIVENESS, val);
            try {
              this.toggleDaemon(Services.prefs.getBoolPref(PREF_AUTO_ENABLED, false));
            } catch (e) {}
          });
        }

        let autoEnabled = false;
        try {
          autoEnabled = Services.prefs.getBoolPref(PREF_AUTO_ENABLED, false);
        } catch (e) {}
        this.toggleDaemon(autoEnabled);
      } catch (e) {
        console.error("LykonOptimiser init error:", e);
      }
      this._bound = true;
    },

    updatePulsingDot(active) {
      const dot = document.getElementById("lko-status-dot");
      if (dot) {
        dot.classList.toggle("active", active);
      }
    },

    toggleDaemon(enable) {
      if (this._daemonTimer) {
        clearInterval(this._daemonTimer);
        this._daemonTimer = null;
      }
      if (enable) {
        let aggressiveness = 1;
        try {
          aggressiveness = Services.prefs.getIntPref(PREF_AGGRESSIVENESS, 1);
        } catch (e) {}
        
        let interval = 60000;
        if (aggressiveness === 0) interval = 120000;
        if (aggressiveness === 2) interval = 30000;

        this._daemonTimer = setInterval(() => this.runAutoOptimise(), interval);
      }
    },

    getPidsSafe(tab) {
      if (tab && typeof gBrowser !== "undefined" && gBrowser && typeof gBrowser.getTabPids === "function") {
        try {
          return gBrowser.getTabPids(tab) || [];
        } catch (e) {}
      }
      return [];
    },

    canDiscard(tab) {
      if (
        tab.selected ||
        tab.pinned ||
        tab.soundPlaying ||
        tab.pictureInPicture ||
        tab.multiselected
      ) {
        return false;
      }
      const browser = tab.linkedBrowser;
      if (!browser) return false;
      if (
        window.webrtcUI &&
        window.webrtcUI.browserHasStreams &&
        window.webrtcUI.browserHasStreams(browser)
      ) {
        return false;
      }
      if (
        browser.browsingContext?.currentWindowGlobal?.hasActivePeerConnections &&
        browser.browsingContext.currentWindowGlobal.hasActivePeerConnections()
      ) {
        return false;
      }
      if (
        window.PrivateBrowsingUtils &&
        window.PrivateBrowsingUtils.isBrowserPrivate &&
        window.PrivateBrowsingUtils.isBrowserPrivate(browser)
      ) {
        return false;
      }
      if (tab.discarded || !tab.linkedPanel || tab.hasAttribute("discarded")) {
        return false;
      }
      try {
        const spec = browser.currentURI?.spec;
        if (spec) {
          const hostname = new URL(spec).hostname.toLowerCase();
          if (
            EXCLUDED_DOMAINS.some(
              d => hostname === d || hostname.endsWith("." + d)
            )
          ) {
            return false;
          }
        }
      } catch (e) {}
      return true;
    },

    startPanelUpdates() {
      this.stopPanelUpdates();
      this.updatePanel();
      this._panelTimer = setInterval(() => this.updatePanel(), 2000);
    },

    stopPanelUpdates() {
      if (this._panelTimer) {
        clearInterval(this._panelTimer);
        this._panelTimer = null;
      }
    },

    async _requestProcInfoSafe() {
      try {
        return await Promise.race([
          ChromeUtils.requestProcInfo(),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2500))
        ]);
      } catch (e) {
        return null;
      }
    },

    async updatePanel() {
      const activeEl = document.getElementById("lko-active-memory");
      const totalEl = document.getElementById("lko-total-memory");
      const savedEl = document.getElementById("lko-saved-memory");
      const countEl = document.getElementById("lko-optimised-count");

      if (activeEl && this._lastActiveMemory === null) {
        activeEl.textContent = "Calculating...";
      }
      if (totalEl && this._lastTotalMemory === null) {
        totalEl.textContent = "Calculating...";
      }
      if (savedEl) {
        try {
          const savedMb = Services.prefs.getIntPref(PREF_TOTAL_SAVED_MB, 0);
          savedEl.textContent = this.formatMegabytes(savedMb);
        } catch (e) {
          savedEl.textContent = "0 MB";
        }
      }

      try {
        const procInfo = await this._requestProcInfoSafe();
        if (!procInfo) {
          throw new Error("procInfo is null");
        }

        const activeTab = typeof gBrowser !== "undefined" ? gBrowser.selectedTab : null;
        const activePids = new Set();
        if (
          activeTab &&
          !activeTab.discarded &&
          !activeTab.hasAttribute("discarded") &&
          activeTab.linkedPanel
        ) {
          const pids = this.getPidsSafe(activeTab);
          for (const pid of pids) {
            activePids.add(pid);
          }
        }

        const allTabPids = new Set();
        if (typeof gBrowser !== "undefined" && gBrowser.tabs) {
          // Convert to array to avoid issues with filter or iterable
          const tabsArray = Array.from(gBrowser.tabs);
          for (const tab of tabsArray) {
            if (
              tab.discarded ||
              tab.hasAttribute("discarded") ||
              !tab.linkedPanel
            ) {
              continue;
            }
            const pids = this.getPidsSafe(tab);
            for (const pid of pids) {
              allTabPids.add(pid);
            }
          }
        }

        let activeTabMemory = 0;
        let totalTabsMemory = 0;

        if (activePids.has(procInfo.pid)) {
          activeTabMemory += (procInfo.memory || 0);
        }
        if (allTabPids.has(procInfo.pid)) {
          totalTabsMemory += (procInfo.memory || 0);
        }

        if (procInfo.children) {
          for (const child of procInfo.children) {
            if (activePids.has(child.pid)) {
              activeTabMemory += (child.memory || 0);
            }
            if (allTabPids.has(child.pid)) {
              totalTabsMemory += (child.memory || 0);
            }
          }
        }

        this._lastActiveMemory = activeTabMemory;
        this._lastTotalMemory = totalTabsMemory;

        if (activeEl && activeEl.textContent !== "Optimising...") {
          activeEl.textContent = this.formatBytes(activeTabMemory);
        }
        if (totalEl && totalEl.textContent !== "Optimising...") {
          totalEl.textContent = this.formatBytes(totalTabsMemory);
        }
      } catch (e) {
        console.error("LykonOptimiser updatePanel error:", e);
        if (activeEl) activeEl.textContent = "Unavailable";
        if (totalEl) totalEl.textContent = "Unavailable";
        this._lastActiveMemory = 0;
        this._lastTotalMemory = 0;
      }

      if (countEl && typeof gBrowser !== "undefined" && gBrowser.tabs) {
        try {
          const tabsArray = Array.from(gBrowser.tabs);
          const count = tabsArray.filter(
            t => !t.linkedPanel || t.discarded || t.hasAttribute("discarded")
          ).length;
          countEl.textContent = count.toString();
        } catch (e) {
          countEl.textContent = "0";
        }
      }
    },

    async manualOptimise() {
      const btn = document.getElementById("lykon-optimise-now-btn");
      const activeEl = document.getElementById("lko-active-memory");
      const totalEl = document.getElementById("lko-total-memory");

      if (btn) {
        btn.disabled = true;
        const textSpan = btn.querySelector(".lko-btn-text");
        if (textSpan) textSpan.textContent = "Optimising...";
      }

      if (activeEl) activeEl.textContent = "Optimising...";
      if (totalEl) totalEl.textContent = "Optimising...";

      let savedBytes = 0;
      const procInfo = await this._requestProcInfoSafe();

      try {
        if (typeof gBrowser !== "undefined" && gBrowser.tabs) {
          const tabsArray = Array.from(gBrowser.tabs);
          const tabsToDiscard = tabsArray.filter(t => this.canDiscard(t));
          
          for (const tab of tabsToDiscard) {
            try {
              let tabMemory = 0;
              if (procInfo?.children) {
                const pids = new Set(this.getPidsSafe(tab));
                for (const child of procInfo.children) {
                  if (pids.has(child.pid)) {
                    tabMemory += (child.memory || 0);
                  }
                }
              }
              savedBytes += tabMemory || 150 * 1024 * 1024;

              if (typeof gBrowser.prepareDiscardBrowser === "function") {
                await Promise.race([
                  gBrowser.prepareDiscardBrowser(tab),
                  new Promise(r => setTimeout(r, 1000))
                ]);
              }
              if (typeof gBrowser.discardBrowser === "function") {
                gBrowser.discardBrowser(tab, true);
              }
            } catch (e) {
              console.error("LykonOptimiser manual discard error:", e);
            }
          }
        }
      } catch (e) {
        console.error("LykonOptimiser manual error:", e);
      }

      if (savedBytes > 0) {
        try {
          const currentSaved = Services.prefs.getIntPref(PREF_TOTAL_SAVED_MB, 0);
          const savedMb = Math.round(savedBytes / 1048576);
          Services.prefs.setIntPref(PREF_TOTAL_SAVED_MB, currentSaved + savedMb);
        } catch (e) {}
      }

      try {
        Services.obs.notifyObservers(null, "child-mmu-request");
      } catch (e) {}

      let done = false;
      const onComplete = () => {
        if (done) return;
        done = true;
        
        if (activeEl) activeEl.textContent = "Calculating...";
        if (totalEl) totalEl.textContent = "Calculating...";
        
        this.updatePanel();
        
        if (btn) {
          btn.disabled = false;
          const textSpan = btn.querySelector(".lko-btn-text");
          if (textSpan) textSpan.textContent = "Optimise Now";
        }
      };

      try {
        Cc["@mozilla.org/memory-reporter-manager;1"]
          .getService(Ci.nsIMemoryReporterManager)
          .minimizeMemoryUsage(onComplete);
      } catch (e) {
        try {
          Services.obs.notifyObservers(null, "memory-pressure", "heap-minimize");
        } catch (e2) {}
        onComplete();
      }

      // Safety fallback
      setTimeout(onComplete, 1500);
    },

    async runAutoOptimise() {
      let enabled = false;
      try {
        enabled = Services.prefs.getBoolPref(PREF_AUTO_ENABLED, false);
      } catch (e) {}
      
      if (!enabled) {
        this.toggleDaemon(false);
        return;
      }

      try {
        const procInfo = await this._requestProcInfoSafe();
        if (!procInfo) return;

        const discardCandidates = [];
        let aggressiveness = 1;
        try {
          aggressiveness = Services.prefs.getIntPref(PREF_AGGRESSIVENESS, 1);
        } catch (e) {}

        let threshold = 1073741824; // 1 GB
        if (aggressiveness === 0) threshold = 1536 * 1024 * 1024; // 1.5 GB
        if (aggressiveness === 2) threshold = 500 * 1024 * 1024; // 500 MB

        if (typeof gBrowser !== "undefined" && gBrowser.tabs) {
          const tabsArray = Array.from(gBrowser.tabs);
          for (const tab of tabsArray) {
            if (!this.canDiscard(tab)) continue;

            const pids = new Set(this.getPidsSafe(tab));
            let tabMemory = 0;

            if (procInfo.children) {
              for (const child of procInfo.children) {
                if (pids.has(child.pid)) {
                  tabMemory += (child.memory || 0);
                }
              }
            }

            if (tabMemory > threshold) {
              discardCandidates.push({ tab, memory: tabMemory });
            }
          }
        }

        if (discardCandidates.length > 0) {
          let savedBytes = 0;
          for (const cand of discardCandidates) {
            try {
              savedBytes += cand.memory || 150 * 1024 * 1024;
              if (typeof gBrowser.prepareDiscardBrowser === "function") {
                await gBrowser.prepareDiscardBrowser(cand.tab);
              }
              if (typeof gBrowser.discardBrowser === "function") {
                gBrowser.discardBrowser(cand.tab, true);
              }
            } catch (e) {}
          }

          if (savedBytes > 0) {
            try {
              const currentSaved = Services.prefs.getIntPref(PREF_TOTAL_SAVED_MB, 0);
              const savedMb = Math.round(savedBytes / 1048576);
              Services.prefs.setIntPref(PREF_TOTAL_SAVED_MB, currentSaved + savedMb);
            } catch (e) {}
          }

          try {
            Services.obs.notifyObservers(null, "child-mmu-request");
          } catch (e) {}
          
          try {
            Cc["@mozilla.org/memory-reporter-manager;1"]
              .getService(Ci.nsIMemoryReporterManager)
              .minimizeMemoryUsage(() => {
                this.updatePanel();
              });
          } catch (e) {
            try {
              Services.obs.notifyObservers(null, "memory-pressure", "heap-minimize");
            } catch (e2) {}
            this.updatePanel();
          }
        }
      } catch (e) {
        console.error("LykonOptimiser auto error:", e);
      }
    },

    formatBytes(bytes) {
      if (!bytes || isNaN(bytes) || bytes === 0) return "0 MB";
      if (bytes < 1024) return bytes + " B";
      if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
      if (bytes < 1073741824) return (bytes / 1048576).toFixed(0) + " MB";
      return (bytes / 1073741824).toFixed(1) + " GB";
    },

    formatMegabytes(mb) {
      if (!mb || isNaN(mb) || mb === 0) return "0 MB";
      if (mb < 1024) return mb.toFixed(0) + " MB";
      return (mb / 1024).toFixed(1) + " GB";
    },
  };

  window.addEventListener(
    "popupshown",
    e => {
      if (e.target?.id === "lykon-optimise-popup") {
        LykonOptimiser.init();
        LykonOptimiser.startPanelUpdates();
      }
    },
    true
  );

  window.addEventListener(
    "popuphiding",
    e => {
      if (e.target?.id === "lykon-optimise-popup") {
        LykonOptimiser.stopPanelUpdates();
      }
    },
    true
  );
})();
