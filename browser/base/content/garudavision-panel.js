/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var GarudaVisionPanel = {
  init() {
    const popup = document.getElementById("lykon-garudavision-popup");
    if (popup) {
      popup.addEventListener("popupshowing", this);
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
    const enabled = Services.prefs.getBoolPref("browser.garudavision.enabled", true);
    const privateEnabled = Services.prefs.getBoolPref("browser.garudavision.privateAndTor.enabled", true);
    const { PrivateBrowsingUtils } = ChromeUtils.importESModule("resource://gre/modules/PrivateBrowsingUtils.sys.mjs");
    const isPrivate = PrivateBrowsingUtils.isWindowPrivate(window);

    const btn = document.getElementById("lykon-garudavision-button");
    if (btn) {
      btn.hidden = !enabled || (isPrivate && !privateEnabled);
    }

    // Listen for preference updates reactively
    this._prefObserver = (subject, topic, data) => {
      if (topic === "nsPref:changed") {
        if (data === "browser.garudavision.enabled" || data === "browser.garudavision.privateAndTor.enabled") {
          const isEnabled = Services.prefs.getBoolPref("browser.garudavision.enabled", true);
          const isPrivateEnabled = Services.prefs.getBoolPref("browser.garudavision.privateAndTor.enabled", true);
          const { PrivateBrowsingUtils: pbUtils } = ChromeUtils.importESModule("resource://gre/modules/PrivateBrowsingUtils.sys.mjs");
          const isWindowPrivate = pbUtils.isWindowPrivate(window);

          const button = document.getElementById("lykon-garudavision-button");
          if (button) {
            button.hidden = !isEnabled || (isWindowPrivate && !isPrivateEnabled);
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
        Services.prefs.removeObserver("browser.garudavision.", this._prefObserver);
      }
    });

    // Add Tabs progress listener for active URL security monitoring
    if (window.gBrowser) {
      window.gBrowser.addTabsProgressListener({
        onLocationChange: (aBrowser, aWebProgress, aRequest, aLocation) => {
          if (!aWebProgress || !aWebProgress.isTopLevel) return;
          this.updateSecurityIndicators(aBrowser, aLocation?.spec || "");
        }
      });

      // Update styling when switching tabs
      window.gBrowser.tabContainer.addEventListener("TabSelect", () => {
        const browser = window.gBrowser.selectedBrowser;
        const url = browser?.currentURI?.spec || "";
        this.updateSecurityIndicators(browser, url);
      });

      // Revert styles cleanly when tabs are closed
      window.gBrowser.tabContainer.addEventListener("TabClose", (event) => {
        const tab = event.target;
        if (tab && tab.selected) {
          this.styleToolbar(0);
        }
      });
    }
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
      const host = currentURI?.host || "No active site";

      const domainEl = document.getElementById("garudavision-domain");
      if (domainEl) {
        domainEl.textContent = host;
      }

      if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
        this.setCleanUI("0", "Clean", "System/Local Page");
        return;
      }

      const score = GarudaService.checkUrl(url);
      const reasons = GarudaService.checkUrlReasons(url);

      this.updateScoreUI(score, reasons);

    } catch (e) {
      console.error("[GarudaVisionPanel] Failed to update panel:", e);
    }
  },

  setCleanUI(score, verdict, message) {
    const scoreValEl = document.getElementById("garudavision-score-val");
    const verdictEl = document.getElementById("garudavision-verdict");
    const circleEl = document.getElementById("garudavision-score-circle");
    const reasonsContainer = document.getElementById("garudavision-reasons-container");
    const noReasonsEl = document.getElementById("garudavision-no-reasons");
    const warningBanner = document.getElementById("garudavision-warning-banner");

    if (scoreValEl) scoreValEl.textContent = score;
    if (verdictEl) {
      verdictEl.textContent = verdict;
      verdictEl.style.color = "#10b981";
    }
    if (circleEl) {
      circleEl.style.borderColor = "#10b981";
      circleEl.style.boxShadow = "0 0 20px rgba(16,185,129,0.15)";
    }
    if (reasonsContainer) reasonsContainer.style.display = "none";
    if (noReasonsEl) {
      noReasonsEl.style.display = "block";
      noReasonsEl.textContent = message || "No security threats detected on this page.";
    }
    if (warningBanner) {
      warningBanner.style.display = "none";
    }
  },

  updateScoreUI(score, reasons) {
    const scoreValEl = document.getElementById("garudavision-score-val");
    const verdictEl = document.getElementById("garudavision-verdict");
    const circleEl = document.getElementById("garudavision-score-circle");
    const reasonsContainer = document.getElementById("garudavision-reasons-container");
    const reasonsListEl = document.getElementById("garudavision-reasons-list");
    const noReasonsEl = document.getElementById("garudavision-no-reasons");

    if (scoreValEl) scoreValEl.textContent = score;

    let verdict = "Clean";
    let color = "#10b981";
    let shadow = "0 0 20px rgba(16,185,129,0.15)";

    if (score >= 80) {
      verdict = "Block";
      color = "#ef4444";
      shadow = "0 0 25px rgba(239,68,68,0.3)";
    } else if (score >= 50) {
      verdict = "Caution";
      color = "#f97316";
      shadow = "0 0 25px rgba(249,115,22,0.25)";
    } else if (score >= 25) {
      verdict = "Suspicious";
      color = "#f59e0b";
      shadow = "0 0 20px rgba(245,158,11,0.2)";
    }

    if (verdictEl) {
      verdictEl.textContent = verdict;
      verdictEl.style.color = color;
    }
    if (circleEl) {
      circleEl.style.borderColor = color;
      circleEl.style.boxShadow = shadow;
    }

    // Dynamic warning banner setup based on score
    const warningBanner = document.getElementById("garudavision-warning-banner");
    const warningText = document.getElementById("garudavision-warning-text");
    const dismissBtn = document.getElementById("garudavision-dismiss-btn");

    if (score >= 25) {
      if (warningBanner) {
        warningBanner.style.display = "flex";
        if (score >= 50) {
          warningBanner.style.background = "rgba(239, 68, 68, 0.15)";
          warningBanner.style.borderColor = "rgba(239, 68, 68, 0.3)";
          if (warningText) {
            warningText.textContent = "This is marked as a suspicious link. Navigate at your own risk.";
            warningText.style.color = "#ef4444";
          }
          if (dismissBtn) {
            dismissBtn.style.background = "#ef4444";
            dismissBtn.style.color = "#ffffff";
          }
        } else {
          warningBanner.style.background = "rgba(245, 158, 11, 0.15)";
          warningBanner.style.borderColor = "rgba(245, 158, 11, 0.3)";
          if (warningText) {
            warningText.textContent = "This is marked as a suspicious link. Navigate at your own risk.";
            warningText.style.color = "#f59e0b";
          }
          if (dismissBtn) {
            dismissBtn.style.background = "#f59e0b";
            dismissBtn.style.color = "#000000";
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
      if (reasonsContainer) reasonsContainer.style.display = "block";
      if (reasonsListEl) {
        reasonsListEl.innerHTML = "";
        for (const reason of reasons) {
          const item = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
          item.style.display = "flex";
          item.style.alignItems = "center";
          item.style.gap = "8px";
          item.style.padding = "6px 10px";
          item.style.background = "#1e1e20";
          item.style.borderRadius = "6px";
          item.style.border = "1px solid #27272a";
          item.style.fontSize = "12px";

          const dot = document.createElementNS("http://www.w3.org/1999/xhtml", "span");
          dot.style.width = "6px";
          dot.style.height = "6px";
          dot.style.borderRadius = "50%";
          dot.style.background = color;
          
          const text = document.createElementNS("http://www.w3.org/1999/xhtml", "span");
          text.textContent = this.formatReason(reason);
          text.style.color = "#d4d4d8";
          text.style.fontWeight = "500";

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
      const isEnabled = Services.prefs.getBoolPref("browser.garudavision.enabled", true);
      const isPrivateEnabled = Services.prefs.getBoolPref("browser.garudavision.privateAndTor.enabled", true);
      const { PrivateBrowsingUtils } = ChromeUtils.importESModule("resource://gre/modules/PrivateBrowsingUtils.sys.mjs");
      const isPrivate = PrivateBrowsingUtils.isBrowserPrivate(browser) || PrivateBrowsingUtils.isWindowPrivate(window);

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

      const { GarudaService } = ChromeUtils.importESModule(
        "resource:///modules/GarudaService.sys.mjs"
      );

      if (!GarudaService.loaded) {
        GarudaService.init();
      }

      const score = (url && (url.startsWith("http://") || url.startsWith("https://")))
        ? GarudaService.checkUrl(url)
        : 0;

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
    const tabColoringDisabled = Services.prefs.getBoolPref("browser.garudavision.tabColoring.disabled", false);
    const finalScore = tabColoringDisabled ? 0 : score;

    const tabBackground = tab.querySelector(".tab-background");

    if (finalScore >= 50) {
      if (tabBackground) {
        tabBackground.style.setProperty("background-color", "#ef4444", "important");
      } else {
        tab.style.setProperty("background-color", "#ef4444", "important");
      }
      tab.style.setProperty("color", "#ffffff", "important");
    } else if (finalScore >= 25) {
      if (tabBackground) {
        tabBackground.style.setProperty("background-color", "#f59e0b", "important");
      } else {
        tab.style.setProperty("background-color", "#f59e0b", "important");
      }
      tab.style.setProperty("color", "#000000", "important");
    } else {
      if (tabBackground) {
        tabBackground.style.removeProperty("background-color");
      }
      tab.style.removeProperty("background-color");
      tab.style.removeProperty("color");
    }
  },

  styleToolbar(score) {
    const tabColoringDisabled = Services.prefs.getBoolPref("browser.garudavision.tabColoring.disabled", false);
    const finalScore = tabColoringDisabled ? 0 : score;

    const navBar = document.getElementById("nav-bar");
    const toolbox = document.getElementById("navigator-toolbox");
    const btn = document.getElementById("lykon-garudavision-button");

    if (finalScore >= 50) {
      if (navBar) {
        navBar.style.setProperty("background-color", "#ef4444", "important");
        navBar.style.setProperty("color", "#ffffff", "important");
      }
      if (toolbox) {
        toolbox.style.setProperty("border-bottom", "2px solid #b91c1c", "important");
      }
      if (btn) {
        btn.style.setProperty("filter", "drop-shadow(0 0 8px #ffffff)", "important");
      }
    } else if (finalScore >= 25) {
      if (navBar) {
        navBar.style.setProperty("background-color", "#f59e0b", "important");
        navBar.style.setProperty("color", "#000000", "important");
      }
      if (toolbox) {
        toolbox.style.setProperty("border-bottom", "2px solid #d97706", "important");
      }
      if (btn) {
        btn.style.setProperty("filter", "drop-shadow(0 0 8px #000000)", "important");
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
  }
};

window.addEventListener("load", () => {
  GarudaVisionPanel.init();
});
