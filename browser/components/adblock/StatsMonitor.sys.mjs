
import { AdblockService } from "resource:///modules/AdblockService.sys.mjs"; // ✅ named
import { filterManager } from "resource:///modules/FilterManager.sys.mjs";   // ✅ named

export class StatsMonitor {
  constructor() {
    this.session = {
      blocked: 0,
      trackers: 0,
      bytes: 0,
      startTime: Date.now(),
    };
    // Per-tab: key = browsingContextID or url, value = { blocked, trackers, bytes }
    this.pageStats = new Map();
    this.currentPageKey = null;
    this.listeners = [];
    this.initialized = false;
  }

  async init() {
    try {
      // Restore totals from prefs (survive restart)
      this._restoreFromPrefs();

      Services.obs.addObserver(this, "adblock-request-blocked", false);
      Services.obs.addObserver(this, "adblock-page-navigated", false);

      // Watch for tab switches to update per-page key
      Services.obs.addObserver(this, "browser-select-tab", false);

      this.initialized = true;
      console.log("[StatsMonitor] Initialized");
    } catch (e) {
      console.error("[StatsMonitor] Init failed:", e);
    }
  }

  _restoreFromPrefs() {
    try {
      this.session.blocked  = Services.prefs.getIntPref("lykon.shield.stats.session",  0);
      this.session.trackers = Services.prefs.getIntPref("lykon.shield.stats.trackers", 0);
      this.session.bytes    = Services.prefs.getIntPref("lykon.shield.stats.bytes",    0);
    } catch (e) {}
  }

  _persistToPrefs() {
    try {
      const total = Services.prefs.getIntPref("lykon.shield.stats.total", 0);
      Services.prefs.setIntPref("lykon.shield.stats.session",  this.session.blocked);
      Services.prefs.setIntPref("lykon.shield.stats.trackers", this.session.trackers);
      Services.prefs.setIntPref("lykon.shield.stats.bytes",    this.session.bytes);
      Services.prefs.setIntPref("lykon.shield.stats.total",    total + 1); // increment total
    } catch (e) {}
  }

  _normalizePageKey(pageKey) {
    if (!pageKey || typeof pageKey !== "string") {
      return null;
    }

    try {
      const uri = Services.io.newURI(pageKey);
      if (!uri || !(uri.scheme === "http" || uri.scheme === "https")) {
        return null;
      }
      return uri.displayHost || uri.host || uri.spec;
    } catch (e) {
      return null;
    }
  }

  recordBlock(url, contentType, sizeBytes) {
    this.session.blocked++;
    this.session.bytes += sizeBytes;

    // Count trackers separately (analytics/tracking domains)
    if (this._isTracker(url)) this.session.trackers++;

    // Per-page stats
    if (this.currentPageKey) {
      const page = this.pageStats.get(this.currentPageKey) || { blocked: 0, trackers: 0, bytes: 0 };
      page.blocked++;
      page.bytes += sizeBytes;
      if (this._isTracker(url)) page.trackers++;
      this.pageStats.set(this.currentPageKey, page);
    }

    this._persistToPrefs();
    this._broadcast();
  }

  _isTracker(url) {
    return url.includes("analytics") ||
           url.includes("tracker") ||
           url.includes("telemetry") ||
           url.includes("pixel") ||
           url.includes("beacon") ||
           url.includes("doubleclick") ||
           url.includes("facebook.com/tr") ||
           url.includes("google-analytics") ||
           url.includes("googletagmanager");
  }

  recordNavigation(pageKey) {
    const normalizedKey = this._normalizePageKey(pageKey);
    if (!normalizedKey) {
      return;
    }

    this.currentPageKey = normalizedKey;
    if (!this.pageStats.has(normalizedKey)) {
      this.pageStats.set(normalizedKey, { blocked: 0, trackers: 0, bytes: 0 });
    }
    this._broadcast();
  }

  getStats() {
    const total = (() => { try { return Services.prefs.getIntPref("lykon.shield.stats.total", 0); } catch(e) { return 0; } })();
    const page  = this.currentPageKey ? (this.pageStats.get(this.currentPageKey) || {}) : {};
    return {
      session:  this.session.blocked,
      total,
      trackers: this.session.trackers,
      bytes:    this.session.bytes,
      page: {
        blocked:  page.blocked  || 0,
        trackers: page.trackers || 0,
        bytes:    page.bytes    || 0,
      },
    };
  }

  fmtBytes(b) {
    if (!b || b < 1024)    return b + " B";
    if (b < 1048576)       return (b / 1024).toFixed(1) + " KB";
    if (b < 1073741824)    return (b / 1048576).toFixed(1) + " MB";
    return (b / 1073741824).toFixed(2) + " GB";
  }

  addListener(cb) { this.listeners.push(cb); }
  removeListener(cb) { this.listeners = this.listeners.filter(l => l !== cb); }

  _broadcast() {
    const stats = this.getStats();
    // Update panel UI via prefs (lykon-shield-panel.js reads these on open)
    // Also fire live observer for real-time update
    Services.obs.notifyObservers(
      null,
      "adblock-stats-updated",
      JSON.stringify(stats)
    );
    for (const cb of this.listeners) {
      try { cb(stats); } catch (e) {}
    }
  }

  observe(subject, topic, data) {
    switch (topic) {
      case "adblock-request-blocked": {
        const parts = (data || "").split("|");
        this.recordBlock(parts[0] || "", parts[1] || "other", parseInt(parts[2]) || 0);
        break;
      }
      case "adblock-page-navigated":
        this.recordNavigation(data);
        break;
      case "browser-select-tab": {
        try {
          const { BrowserWindowTracker } = ChromeUtils.importESModule(
            "resource:///modules/BrowserWindowTracker.sys.mjs"
          );
          const win = BrowserWindowTracker.getTopWindow();
          const selectedURI = win?.gBrowser?.selectedBrowser?.currentURI?.spec || "";
          this.recordNavigation(selectedURI);
        } catch (e) {}
        break;
      }
    }
  }

  resetSession() {
    this.session = { blocked: 0, trackers: 0, bytes: 0, startTime: Date.now() };
    this._persistToPrefs();
    this._broadcast();
  }

  QueryInterface = ChromeUtils.generateQI(["nsIObserver", "nsISupportsWeakReference"]);
}

export const statsMonitor = new StatsMonitor();
statsMonitor.init().catch(console.error);
export default statsMonitor;