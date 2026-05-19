
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
      // Try a forgiving URL parse fallback (some referer strings may be
      // slightly different). Use the global URL constructor if available.
      try {
        const parsed = new URL(pageKey);
        return parsed.hostname || null;
      } catch (e2) {
        return null;
      }
    }
  }

  _getSelectedPageKey() {
    try {
      const { BrowserWindowTracker } = ChromeUtils.importESModule(
        "resource:///modules/BrowserWindowTracker.sys.mjs"
      );
      const win = BrowserWindowTracker.getTopWindow();
      const selectedURI = win?.gBrowser?.selectedBrowser?.currentURI?.spec || "";
      return this._normalizePageKey(selectedURI);
    } catch (e) {
      return null;
    }
  }

  recordBlock(url, contentType, sizeBytes, referrer) {
    const pageKey = this._normalizePageKey(referrer) || this.currentPageKey || this._getSelectedPageKey();

    // Estimate size if not provided (blocked requests save what they would have cost)
    if (sizeBytes <= 0) {
      const estimates = {
        script: 35000,
        image: 45000,
        media: 250000,
        stylesheet: 12000,
        xmlhttprequest: 5000,
        subdocument: 15000,
        other: 2000,
      };
      sizeBytes = estimates[contentType] || estimates.other;
    }

    this.session.blocked++;
    this.session.bytes += sizeBytes;

    const isTracker = this._isTracker(url);
    if (isTracker) this.session.trackers++;

    if (pageKey) {
      const page = this.pageStats.get(pageKey) || { blocked: 0, trackers: 0, bytes: 0, blockedList: [] };
      page.blocked++;
      page.bytes += sizeBytes;
      if (isTracker) page.trackers++;
      
      // Store blocked items for the "nerd" view (limit to last 50)
      if (!page.blockedList) page.blockedList = [];
      page.blockedList.unshift({
        url,
        type: contentType,
        isTracker,
        time: Date.now()
      });
      if (page.blockedList.length > 50) page.blockedList.pop();
      
      this.pageStats.set(pageKey, page);
    }

    this._persistToPrefs();
    this._broadcast();
  }

  _isTracker(url) {
    const trackerDomains = [
      "analytics", "tracker", "telemetry", "pixel", "beacon",
      "doubleclick", "adservice", "adsystem", "adnxs", "taboola",
      "outbrain", "facebook.com/tr", "google-analytics", "googletagmanager",
      "scorecardresearch", "hotjar", "clarity.ms", "mixpanel"
    ];
    return trackerDomains.some(d => url.includes(d));
  }

  recordNavigation(pageKey) {
    const normalizedKey = this._normalizePageKey(pageKey);
    if (!normalizedKey) return;

    this.currentPageKey = normalizedKey;
    if (!this.pageStats.has(normalizedKey)) {
      this.pageStats.set(normalizedKey, { blocked: 0, trackers: 0, bytes: 0, blockedList: [] });
    }
    this._broadcast();
  }

  getStats() {
    const total = (() => { try { return Services.prefs.getIntPref("lykon.shield.stats.total", 0); } catch(e) { return 0; } })();
    const currentPageKey = this._getSelectedPageKey() || this.currentPageKey;
    const page = currentPageKey ? (this.pageStats.get(currentPageKey) || {}) : {};
    return {
      session:  this.session.blocked,
      total,
      trackers: this.session.trackers,
      bytes:    this.session.bytes,
      page: {
        blocked:  page.blocked  || 0,
        trackers: page.trackers || 0,
        bytes:    page.bytes    || 0,
        blockedList: page.blockedList || [],
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
    console.log("[StatsMonitor] observe called with topic:", topic);
    switch (topic) {
      case "adblock-request-blocked": {
        const parts = (data || "").split("|");
        const url = parts[0] || "";
        const contentType = parts[1] || "other";
        const size = parseInt(parts[2]) || 0;
        const referrer = parts[3] || "";

        this.recordBlock(url, contentType, size, referrer);
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