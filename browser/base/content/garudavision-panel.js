/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var GarudaVisionPanel = {
  init() {
    const popup = document.getElementById("lykon-garudavision-popup");
    const button = document.getElementById("lykon-garudavision-button");
    if (popup) {
      popup.addEventListener("popupshowing", this);
      popup.addEventListener("popupshown", () => {
        const panelContent = document.getElementById(
          "lykon-garudavision-panel-content"
        );
        if (panelContent) {
          panelContent.classList.remove("gv-animate");
          void panelContent.offsetWidth;
          panelContent.classList.add("gv-animate");
        }
      });
    }

    if (popup && button) {
      button.addEventListener("command", event => {
        event.preventDefault();
        if (popup.state === "open") {
          popup.hidePopup();
          return;
        }
        popup.openPopup(button, "bottomright");
      });
    }

    // Dismiss button within the warning banner inside the popup
    const dismissBtn = document.getElementById("garudavision-dismiss-btn");
    if (dismissBtn) {
      dismissBtn.addEventListener("click", () => {
        const popup = document.getElementById("lykon-garudavision-popup");
        if (popup) {
          popup.hidePopup();
        }
      });
    }

    // Initialize toolbar button hidden state based on preference
    const enabled = Services.prefs.getBoolPref(
      "browser.garudavision.enabled",
      true
    );
    const privateEnabled = Services.prefs.getBoolPref(
      "browser.garudavision.privateAndTor.enabled",
      true
    );
    const { PrivateBrowsingUtils } = ChromeUtils.importESModule(
      "resource://gre/modules/PrivateBrowsingUtils.sys.mjs"
    );
    const isPrivate = PrivateBrowsingUtils.isWindowPrivate(window);

    const btn = document.getElementById("lykon-garudavision-button");
    if (btn) {
      btn.hidden = !enabled || (isPrivate && !privateEnabled);
    }

    // Listen for preference updates reactively
    this._prefObserver = (subject, topic, data) => {
      if (topic === "nsPref:changed") {
        if (
          data === "browser.garudavision.enabled" ||
          data === "browser.garudavision.privateAndTor.enabled"
        ) {
          const isEnabled = Services.prefs.getBoolPref(
            "browser.garudavision.enabled",
            true
          );
          const isPrivateEnabled = Services.prefs.getBoolPref(
            "browser.garudavision.privateAndTor.enabled",
            true
          );
          const { PrivateBrowsingUtils: pbUtils } = ChromeUtils.importESModule(
            "resource://gre/modules/PrivateBrowsingUtils.sys.mjs"
          );
          const isWindowPrivate = pbUtils.isWindowPrivate(window);

          const button = document.getElementById("lykon-garudavision-button");
          if (button) {
            button.hidden =
              !isEnabled || (isWindowPrivate && !isPrivateEnabled);
          }
          const browser = window.gBrowser?.selectedBrowser;
          if (browser) {
            const url = browser?.currentURI?.spec || "";
            this.updateSecurityIndicators(browser, url);
          }
        } else if (data === "browser.garudavision.tabColoring.disabled") {
          const browser = window.gBrowser?.selectedBrowser;
          if (browser) {
            const url = browser?.currentURI?.spec || "";
            this.updateSecurityIndicators(browser, url);
          }
          // Also update all tabs style
          if (window.gBrowser?.tabs) {
            for (const tab of window.gBrowser.tabs) {
              const tabBrowser = tab.linkedBrowser;
              const tabUrl = tabBrowser?.currentURI?.spec || "";
              this.updateSecurityIndicators(tabBrowser, tabUrl);
            }
          }
        }
      }
    };
    Services.prefs.addObserver("browser.garudavision.", this._prefObserver);

    // Clean up observer on window unload to prevent memory leaks
    window.addEventListener("unload", () => {
      if (this._prefObserver) {
        Services.prefs.removeObserver(
          "browser.garudavision.",
          this._prefObserver
        );
      }
    });

    // Add Tabs progress listener for active URL security monitoring
    if (window.gBrowser) {
      window.gBrowser.addTabsProgressListener({
        onLocationChange: (aBrowser, aWebProgress, aRequest, aLocation) => {
          if (!aWebProgress || !aWebProgress.isTopLevel) return;
          this.updateSecurityIndicators(aBrowser, aLocation?.spec || "");
        },
      });

      // Update styling when switching tabs
      window.gBrowser.tabContainer.addEventListener("TabSelect", () => {
        const browser = window.gBrowser.selectedBrowser;
        const url = browser?.currentURI?.spec || "";
        this.updateSecurityIndicators(browser, url);
      });

      // Revert styles cleanly when tabs are closed
      window.gBrowser.tabContainer.addEventListener("TabClose", event => {
        const tab = event.target;
        if (tab && tab.selected) {
          this.styleToolbar(0);
        }
      });
    }

    // Allowlist toggle button inside the popup
    const allowlistBtn = document.getElementById("garudavision-allowlist-btn");
    if (allowlistBtn) {
      allowlistBtn.addEventListener("click", () => {
        const currentURI = window.gBrowser?.currentURI;
        let host = "";
        try {
          host = currentURI?.host || "";
        } catch (e) {}
        if (!host) return;

        const list = this.getAllowList();
        const index = list.findIndex(item => item.host === host);
        if (index > -1) {
          // Remove from allow list (show warnings again)
          list.splice(index, 1);
        } else {
          // Add to allow list (disable warnings)
          list.push({ host, enabled: true });
        }
        this.setAllowList(list);

        // Hide popup and refresh state
        const popup = document.getElementById("lykon-garudavision-popup");
        if (popup) {
          popup.hidePopup();
        }

        // Trigger updates in all windows to apply styling changes immediately
        const browser = window.gBrowser?.selectedBrowser;
        if (browser) {
          this.updateSecurityIndicators(
            browser,
            browser.currentURI?.spec || ""
          );
        }
      });
    }
  },

  getAllowList() {
    try {
      const listStr = Services.prefs.getStringPref(
        "browser.garudavision.allowlist",
        "[]"
      );
      return JSON.parse(listStr);
    } catch (e) {
      return [];
    }
  },

  setAllowList(list) {
    try {
      Services.prefs.setStringPref(
        "browser.garudavision.allowlist",
        JSON.stringify(list)
      );
    } catch (e) {
      console.error("Failed to set allowlist pref:", e);
    }
  },

  isHostAllowed(host) {
    if (!host) return false;
    const list = this.getAllowList();
    return list.some(item => item.host === host && item.enabled);
  },

  handleEvent(event) {
    if (event.type === "popupshowing") {
      this.updatePanel();
    }
  },

  updatePanel() {
    try {
      const { GarudaService } = ChromeUtils.importESModule(
        "resource:///modules/GarudaService.sys.mjs"
      );

      if (!GarudaService.loaded) {
        GarudaService.init();
      }

      const currentURI = window.gBrowser?.currentURI;
      const url = currentURI?.spec || "";
      let host = "No active site";
      try {
        host = currentURI?.host || "No active site";
      } catch (e) {}

      const domainEl = document.getElementById("garudavision-domain");
      if (domainEl) {
        domainEl.textContent = host;
      }

      const allowlistBtn = document.getElementById(
        "garudavision-allowlist-btn"
      );

      if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
        this.setCleanUI("0", "Secure", "System/Local Page");
        if (allowlistBtn) {
          const parentCard = allowlistBtn.closest(".gv-settings-card");
          if (parentCard) {
            parentCard.style.display = "none";
          } else {
            allowlistBtn.style.display = "none";
          }
        }
        return;
      }

      if (allowlistBtn) {
        const parentCard = allowlistBtn.closest(".gv-settings-card");
        if (parentCard) {
          parentCard.style.display = "flex";
        } else {
          allowlistBtn.style.display = "flex";
        }

        if (host && this.isHostAllowed(host)) {
          allowlistBtn.setAttribute("data-checked", "true");
        } else {
          allowlistBtn.setAttribute("data-checked", "false");
        }
      }

      if (host && this.isHostAllowed(host)) {
        this.setCleanUI(
          "0",
          "Allowed",
          "This site is in your GarudaVision allow list."
        );
        return;
      }

      const score = GarudaService.checkUrl(url);
      const reasons = GarudaService.checkUrlReasons(url);

      this.updateScoreUI(score, reasons);
    } catch (e) {
      console.error("[GarudaVisionPanel] Failed to update panel:", e);
    }
  },

  animateScoreCountUp(targetScore) {
    const scoreValEl = document.getElementById("garudavision-score-val");
    if (!scoreValEl) return;

    let currentScore = 0;
    const duration = 800; // ms
    const startTime = performance.now();

    const updateCount = timestamp => {
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const scoreVal = Math.floor(easeProgress * targetScore);

      scoreValEl.textContent = scoreVal;

      if (progress < 1) {
        requestAnimationFrame(updateCount);
      } else {
        scoreValEl.textContent = targetScore;
      }
    };

    requestAnimationFrame(updateCount);
  },

  setCleanUI(score, verdict, message) {
    const scoreValEl = document.getElementById("garudavision-score-val");
    const verdictEl = document.getElementById("garudavision-verdict");
    const reasonsContainer = document.getElementById(
      "garudavision-reasons-container"
    );
    const noReasonsEl = document.getElementById("garudavision-no-reasons");
    const warningBanner = document.getElementById(
      "garudavision-warning-banner"
    );
    const panelContent = document.getElementById(
      "lykon-garudavision-panel-content"
    );

    if (panelContent) {
      panelContent.setAttribute(
        "data-state",
        verdict === "Allowed" ? "informational" : "safe"
      );
      panelContent.classList.remove("gv-animate");
      void panelContent.offsetWidth;
      panelContent.classList.add("gv-animate");
    }

    if (scoreValEl) {
      this.animateScoreCountUp(0);
    }
    if (verdictEl) {
      verdictEl.textContent = verdict === "Allowed" ? "Allowed" : "Secure";
    }
    if (reasonsContainer) reasonsContainer.style.display = "none";
    if (noReasonsEl) {
      noReasonsEl.style.display = "block";
      noReasonsEl.textContent =
        message || "No security threats detected on this page.";
    }
    if (warningBanner) {
      warningBanner.style.display = "none";
    }
  },

  updateScoreUI(score, reasons) {
    const scoreValEl = document.getElementById("garudavision-score-val");
    const verdictEl = document.getElementById("garudavision-verdict");
    const reasonsContainer = document.getElementById(
      "garudavision-reasons-container"
    );
    const reasonsListEl = document.getElementById("garudavision-reasons-list");
    const noReasonsEl = document.getElementById("garudavision-no-reasons");
    const warningBanner = document.getElementById(
      "garudavision-warning-banner"
    );
    const warningText = document.getElementById("garudavision-warning-text");
    const panelContent = document.getElementById(
      "lykon-garudavision-panel-content"
    );

    let verdict = "Secure";
    let state = "safe";

    if (score >= 50) {
      verdict = "Unsafe";
      state = "dangerous";
    } else if (score >= 25) {
      verdict = "Suspicious";
      state = "suspicious";
    }

    if (panelContent) {
      panelContent.setAttribute("data-state", state);
      panelContent.classList.remove("gv-animate");
      void panelContent.offsetWidth;
      panelContent.classList.add("gv-animate");
    }

    if (scoreValEl) {
      this.animateScoreCountUp(score);
    }

    if (verdictEl) {
      verdictEl.textContent = verdict;
    }

    // Dynamic warning banner setup based on score
    if (score >= 25) {
      if (warningBanner) {
        warningBanner.style.display = "flex";
        if (warningText) {
          if (score >= 50) {
            warningText.textContent =
              "Potential phishing or malware risk detected. Navigate at your own risk.";
          } else {
            warningText.textContent =
              "This page contains indicators that may require caution.";
          }
        }
      }
    } else {
      if (warningBanner) {
        warningBanner.style.display = "none";
      }
    }

    const hasReasons = reasons && reasons.length > 0;
    if (hasReasons) {
      if (noReasonsEl) noReasonsEl.style.display = "none";
      if (reasonsContainer) reasonsContainer.style.display = "flex";
      if (reasonsListEl) {
        reasonsListEl.innerHTML = "";
        for (const reason of reasons) {
          const item = document.createElementNS(
            "http://www.w3.org/1999/xhtml",
            "div"
          );
          item.className = "gv-reason-item";

          const dot = document.createElementNS(
            "http://www.w3.org/1999/xhtml",
            "span"
          );
          dot.className = "gv-reason-dot";

          const text = document.createElementNS(
            "http://www.w3.org/1999/xhtml",
            "span"
          );
          text.textContent = this.formatReason(reason);

          item.appendChild(dot);
          item.appendChild(text);
          reasonsListEl.appendChild(item);
        }
      }
    } else {
      if (reasonsContainer) reasonsContainer.style.display = "none";
      if (noReasonsEl) {
        noReasonsEl.style.display = "block";
        noReasonsEl.textContent = "No security threats detected on this page.";
      }
    }
  },

  updateSecurityIndicators(browser, url) {
    try {
      const isEnabled = Services.prefs.getBoolPref(
        "browser.garudavision.enabled",
        true
      );
      const isPrivateEnabled = Services.prefs.getBoolPref(
        "browser.garudavision.privateAndTor.enabled",
        true
      );
      const { PrivateBrowsingUtils } = ChromeUtils.importESModule(
        "resource://gre/modules/PrivateBrowsingUtils.sys.mjs"
      );
      const isPrivate =
        PrivateBrowsingUtils.isBrowserPrivate(browser) ||
        PrivateBrowsingUtils.isWindowPrivate(window);

      const tab = window.gBrowser.getTabForBrowser(browser);

      if (!isEnabled || (isPrivate && !isPrivateEnabled)) {
        if (tab) {
          tab.garudaScore = 0;
          this.styleTab(tab, 0);
        }
        if (window.gBrowser.selectedBrowser === browser) {
          this.styleToolbar(0);
          const button = document.getElementById("lykon-garudavision-button");
          if (button) {
            button.hidden = true;
          }
        }
        return;
      }

      // Ensure button is shown if not disabled
      if (window.gBrowser.selectedBrowser === browser) {
        const button = document.getElementById("lykon-garudavision-button");
        if (button) {
          button.hidden = false;
        }
      }

      let score = 0;
      let isAllowed = false;
      try {
        const currentURI = Services.io.newURI(url);
        const host = currentURI.host;
        if (host && this.isHostAllowed(host)) {
          isAllowed = true;
        }
      } catch (e) {}

      if (!isAllowed) {
        const { GarudaService } = ChromeUtils.importESModule(
          "resource:///modules/GarudaService.sys.mjs"
        );

        if (!GarudaService.loaded) {
          GarudaService.init();
        }

        score =
          url && (url.startsWith("http://") || url.startsWith("https://"))
            ? GarudaService.checkUrl(url)
            : 0;
      }

      if (tab) {
        tab.garudaScore = score;
        this.styleTab(tab, score);
      }

      if (window.gBrowser.selectedBrowser === browser) {
        this.styleToolbar(score);

        // Automatically open the GarudaVision popup warning when loading a suspicious link
        if (score >= 25) {
          setTimeout(() => {
            this.showWarningPopup();
          }, 300);
        }
      }
    } catch (e) {
      console.error("[GarudaVisionPanel] updateSecurityIndicators failed:", e);
    }
  },

  showWarningPopup() {
    try {
      const btn = document.getElementById("lykon-garudavision-button");
      const popup = document.getElementById("lykon-garudavision-popup");
      if (popup && btn && popup.state !== "open") {
        popup.openPopup(btn, "bottomright");
      }
    } catch (e) {
      console.error("[GarudaVisionPanel] showWarningPopup failed:", e);
    }
  },

  styleTab(tab, score) {
    const tabColoringDisabled = Services.prefs.getBoolPref(
      "browser.garudavision.tabColoring.disabled",
      false
    );
    const finalScore = tabColoringDisabled ? 0 : score;

    const tabBackground = tab.querySelector(".tab-background");

    if (finalScore >= 50) {
      if (tabBackground) {
        tabBackground.style.setProperty(
          "background-color",
          "#FF453A",
          "important"
        );
      } else {
        tab.style.setProperty("background-color", "#FF453A", "important");
      }
      tab.style.setProperty("color", "#ffffff", "important");
    } else if (finalScore >= 25) {
      if (tabBackground) {
        tabBackground.style.setProperty(
          "background-color",
          "#FF9F0A",
          "important"
        );
      } else {
        tab.style.setProperty("background-color", "#FF9F0A", "important");
      }
      tab.style.setProperty("color", "#ffffff", "important");
    } else {
      if (tabBackground) {
        tabBackground.style.removeProperty("background-color");
      }
      tab.style.removeProperty("background-color");
      tab.style.removeProperty("color");
    }
  },

  styleToolbar(score) {
    const tabColoringDisabled = Services.prefs.getBoolPref(
      "browser.garudavision.tabColoring.disabled",
      false
    );
    const finalScore = tabColoringDisabled ? 0 : score;

    const navBar = document.getElementById("nav-bar");
    const toolbox = document.getElementById("navigator-toolbox");
    const btn = document.getElementById("lykon-garudavision-button");

    if (finalScore >= 50) {
      if (navBar) {
        navBar.style.setProperty("background-color", "#FF453A", "important");
        navBar.style.setProperty("color", "#ffffff", "important");
      }
      if (toolbox) {
        toolbox.style.setProperty(
          "border-bottom",
          "2px solid #FF453A",
          "important"
        );
      }
      if (btn) {
        btn.style.setProperty(
          "filter",
          "drop-shadow(0 0 4px rgba(255, 69, 58, 0.4))",
          "important"
        );
      }
    } else if (finalScore >= 25) {
      if (navBar) {
        navBar.style.setProperty("background-color", "#FF9F0A", "important");
        navBar.style.setProperty("color", "#ffffff", "important");
      }
      if (toolbox) {
        toolbox.style.setProperty(
          "border-bottom",
          "2px solid #FF9F0A",
          "important"
        );
      }
      if (btn) {
        btn.style.setProperty(
          "filter",
          "drop-shadow(0 0 4px rgba(255, 159, 10, 0.4))",
          "important"
        );
      }
    } else {
      if (navBar) {
        navBar.style.removeProperty("background-color");
        navBar.style.removeProperty("color");
      }
      if (toolbox) {
        toolbox.style.removeProperty("border-bottom");
      }
      if (btn) {
        btn.style.removeProperty("filter");
      }
    }
  },

  formatReason(reason) {
    if (reason.startsWith("brand_impersonation:")) {
      const brand = reason.split(":")[1];
      return `Impersonating brand: ${brand}`;
    }
    if (reason.startsWith("suspicious_keyword:")) {
      const keyword = reason.split(":")[1];
      return `Suspicious keyword: ${keyword}`;
    }
    if (reason.startsWith("suspicious_hosting:")) {
      const hosting = reason.split(":")[1];
      return `Free hosting: ${hosting}`;
    }
    if (reason.startsWith("many_subdomains:")) {
      return "Subdomain flooding detected";
    }
    if (reason.startsWith("many_hyphens:")) {
      return "Excessive hyphens in domain";
    }
    if (reason.startsWith("long_hostname:")) {
      return "Unusually long host name";
    }
    if (reason === "ip_address_hostname") {
      return "IP Address used as host name";
    }
    if (reason === "dangerous_scheme") {
      return "Dangerous URI scheme protocol";
    }
    if (reason === "malicious_blocklist_match") {
      return "Blocked by Malware blocklist";
    }
    return reason;
  },
};

window.addEventListener("load", () => {
  GarudaVisionPanel.init();
});
