
import { AdblockService } from "resource:///modules/AdblockService.sys.mjs"; 
import { PREFS } from "resource:///modules/AdblockConfig.sys.mjs";           

export class ShieldUIController {
  constructor() {
    this.initialized = false;
    this.currentBrowser = null;
    this.stats = {
      blocked: 0,
      allowed: 0,
      session: { blocked: 0, allowed: 0 },
    };
  }

  async init() {
    try {
      await AdblockService.init();
      this.initialized = true;
      console.log("[ShieldUIController] Initialized");
    } catch (error) {
      console.error("[ShieldUIController] Failed to init:", error);
    }
  }

  async handleToggle(enabled) {
    try {
      console.log(`[ShieldUIController] Toggle changed: ${enabled}`);

      // Update pref — ShieldIntegration observes this and calls AdblockService.setEnabled()
      Services.prefs.setBoolPref(PREFS.ENABLED, enabled);

      // Also set directly on service for immediate effect
      AdblockService.setEnabled(enabled);

      // Notify ShieldIntegration via observer
      this._notifyToggleChange(enabled);

      // Refresh page
      await this._autoRefreshPage();

    } catch (error) {
      console.error("[ShieldUIController] Toggle error:", error);
    }
  }

  async _autoRefreshPage() {
    try {
      const ChromeWindow = Services.wm.getMostRecentWindow("navigator:browser");
      if (ChromeWindow && ChromeWindow.gBrowser) { // ✅ fixed: was (!ChromeWindow && ...)
        const browser = ChromeWindow.gBrowser.selectedBrowser;
        if (browser && browser.currentURI) {
          browser.reload();
          console.log("[ShieldUIController] Page reloaded after toggle");
        }
      }
    } catch (error) {
      console.log("[ShieldUIController] Could not auto-refresh:", error);
    }
  }

  _notifyToggleChange(enabled) {
    // Fire both topics to cover ShieldIntegration listener
    Services.obs.notifyObservers(null, "adblock-shield-toggled", enabled ? "true" : "false");
    Services.obs.notifyObservers(
      null,
      "adblock-shield-status-changed",
      JSON.stringify({ type: "shield-toggle-changed", enabled, timestamp: Date.now() })
    );
  }

  updateStats() {
    const stats = AdblockService.getStats();
    this.stats = {
      blocked: stats.blockedRequests || 0,
      allowed: stats.allowedRequests || 0,
      blockRate: stats.blockRate || "0%",
      totalRules: stats.totalRules || 0,
      enabled: AdblockService.enabled,
    };
    return this.stats;
  }

  getStatus() {
    return {
      enabled: AdblockService.enabled,
      stats: this.updateStats(),
    };
  }

  async addCustomFilter(name, rules, autoRefresh = true) {
    try {
      await AdblockService.addFilterList(name, rules);
      console.log(`[ShieldUIController] Added filter: ${name}`);
      if (autoRefresh) await this._autoRefreshPage();
      return true;
    } catch (error) {
      console.error("[ShieldUIController] Failed to add filter:", error);
      return false;
    }
  }

  getSampleFilters() {
    return {
      easylist: {
        name: "EasyList",
        rules: `||doubleclick.net^\n||ads.google.com^\n||pagead2.googlesyndication.com^\n||ads.mopub.com^\n||ad-delivery.net^`,
        description: "Standard ad blocking list",
      },
      privacy: {
        name: "Privacy Tracking",
        rules: `||google-analytics.com^\n||googletagmanager.com^\n||facebook.com/tr?\n||analytics.google.com^`,
        description: "Block privacy trackers",
      },
      social: {
        name: "Social Media",
        rules: `||facebook.com/plugins/\n||platform.twitter.com^\n||share.*.facebook.com^`,
        description: "Block social widgets",
      },
    };
  }

  openFilterPanel() {
    Services.obs.notifyObservers(null, "adblock-open-filter-panel", "");
  }

  closeFilterPanel() {
    Services.obs.notifyObservers(null, "adblock-close-filter-panel", "");
  }
}

export const shieldUIController = new ShieldUIController();
shieldUIController.init().catch(console.error);
export default shieldUIController;