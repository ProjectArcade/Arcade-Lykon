/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Real-Time Stats Monitor for Lykon Shield
 * Tracks blocking statistics and updates UI live
 */

import adblockService from "resource:///modules/AdblockService.sys.mjs";
import filterManager from "resource:///modules/FilterManager.sys.mjs";

const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

export class StatsMonitor {
  constructor() {
    this.sessionStats = {
      blockedInSession: 0,
      blockedThisPage: 0,
      bandwidthSaved: 0, // in bytes
      startTime: Date.now(),
    };
    this.pageStats = new Map(); // Per-page tracking
    this.listeners = [];
    this.initialized = false;
  }

  /**
   * Initialize stats monitor
   */
  async init() {
    try {
      // Listen for blocking events
      Services.obs.addObserver(this, "adblock-request-blocked");
      Services.obs.addObserver(this, "adblock-page-changed");

      this.initialized = true;
      console.log("[StatsMonitor] Initialized");
    } catch (error) {
      console.error("[StatsMonitor] Failed to initialize:", error);
    }
  }

  /**
   * Record a blocked request
   */
  recordBlockedRequest(url, contentType = "other", sizeBytes = 0) {
    this.sessionStats.blockedInSession++;
    this.sessionStats.blockedThisPage++;
    this.sessionStats.bandwidthSaved += sizeBytes;

    // Notify listeners
    this._notifyStatsUpdated();
  }

  /**
   * Record page navigation
   */
  recordPageNavigation(pageUrl) {
    // Reset per-page counter
    this.sessionStats.blockedThisPage = 0;

    // Store page stats
    this.pageStats.set(pageUrl, {
      url: pageUrl,
      blockedCount: 0,
      timestamp: Date.now(),
    });

    this._notifyPageChanged(pageUrl);
  }

  /**
   * Get current session statistics
   */
  getSessionStats() {
    const uptime = Math.round((Date.now() - this.sessionStats.startTime) / 1000);
    const adblockStats = adblockService.getStats();

    return {
      blockedThisSession: this.sessionStats.blockedInSession,
      blockedThisPage: this.sessionStats.blockedThisPage,
      bandwidthSaved: this.sessionStats.bandwidthSaved,
      bandwidthSavedMB: (this.sessionStats.bandwidthSaved / 1024 / 1024).toFixed(2),
      sessionUptime: `${uptime}s`,
      totalRules: adblockStats.totalRules,
      filterLists: adblockStats.filterListsCount,
      customFilters: filterManager.getStats().customFiltersCount,
      shieldEnabled: adblockStats.enabled,
    };
  }

  /**
   * Get per-page statistics
   */
  getPageStats(pageUrl) {
    return this.pageStats.get(pageUrl) || null;
  }

  /**
   * Format bandwidth for display
   */
  formatBandwidth(bytes) {
    if (bytes === 0) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  /**
   * Register a stats listener
   */
  addListener(callback) {
    this.listeners.push(callback);
  }

  /**
   * Remove a stats listener
   */
  removeListener(callback) {
    this.listeners = this.listeners.filter(l => l !== callback);
  }

  /**
   * Notify listeners of stats update
   */
  _notifyStatsUpdated() {
    const stats = this.getSessionStats();

    for (const listener of this.listeners) {
      try {
        listener({
          type: "stats-updated",
          stats: stats,
          timestamp: Date.now(),
        });
      } catch (error) {
        console.error("[StatsMonitor] Listener error:", error);
      }
    }

    // Also broadcast via observer service
    Services.obs.notifyObservers(null, "adblock-stats-updated", JSON.stringify(stats));
  }

  /**
   * Notify of page change
   */
  _notifyPageChanged(pageUrl) {
    Services.obs.notifyObservers(null, "adblock-page-changed", pageUrl);
  }

  /**
   * Handle observer notifications
   */
  observe(subject, topic, data) {
    switch (topic) {
      case "adblock-request-blocked":
        // Data format: "url|contentType|sizeBytes"
        try {
          const parts = data.split("|");
          const sizeBytes = parseInt(parts[2]) || 0;
          this.recordBlockedRequest(parts[0], parts[1], sizeBytes);
        } catch (error) {
          console.log("[StatsMonitor] Parse error for blocked request:", error);
        }
        break;

      case "adblock-page-changed":
        this.recordPageNavigation(data);
        break;
    }
  }

  /**
   * Reset session statistics
   */
  resetStats() {
    this.sessionStats = {
      blockedInSession: 0,
      blockedThisPage: 0,
      bandwidthSaved: 0,
      startTime: Date.now(),
    };
    this._notifyStatsUpdated();
  }

  /**
   * Get formatted stats for display
   */
  getFormattedStats() {
    const stats = this.getSessionStats();

    return {
      blockedLabel: this.formatBandwidthSavings(stats.blockedThisSession),
      bandwidthLabel: this.formatBandwidth(stats.bandwidthSaved),
      uptime: stats.sessionUptime,
      blockRate: `${stats.blockedThisSession} blocked`,
      enabled: stats.shieldEnabled ? "ON" : "OFF",
    };
  }

  /**
   * Format bandwidth savings text
   */
  formatBandwidthSavings(count) {
    if (count === 0) return "0 ads";
    if (count === 1) return "1 ad";
    return `${count} ads`;
  }

  /**
   * QueryInterface for XPCOM observer
   */
  QueryInterface = ChromeUtils.generateQI(["nsIObserver", "nsISupportsWeakReference"]);
}

// Create singleton instance
export const statsMonitor = new StatsMonitor();

// Auto-initialize
statsMonitor.init().catch(console.error);

export default statsMonitor;
