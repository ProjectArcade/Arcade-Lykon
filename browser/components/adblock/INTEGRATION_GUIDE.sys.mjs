/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Integration Guide: Using the Adblock Service in Browser Components
 * 
 * This document outlines how to integrate the adblock service into various parts
 * of the browser to intercept and filter network requests.
 */

// ============================================================================
// 1. SIMPLE USAGE: Import and Check URLs
// ============================================================================

import adblockService from "resource://gre/modules/AdblockService.sys.mjs";
import adblockIntegration from "resource://gre/modules/AdblockIntegration.sys.mjs";

export class NetworkFilter {
  async filterRequest(details) {
    // Usage: Call this when intercepting network requests
    const shouldBlock = adblockIntegration.shouldBlockRequest({
      url: details.url,
      originUrl: details.initiator || details.originUrl,
      type: details.type,
    });

    return {
      cancel: shouldBlock, // true to block the request
    };
  }
}

// ============================================================================
// 2. CONTENT SCRIPT INTEGRATION: Web Request Listener
// ============================================================================

export class WebRequestListener {
  constructor() {
    this.initialized = false;
  }

  async init() {
    try {
      await adblockService.init();
      this.initialized = true;
      console.log("Web request listener initialized");
    } catch (error) {
      console.error("Failed to initialize web request listener:", error);
    }
  }

  /**
   * Handle before-request event
   * This is called BEFORE the request is sent to the network
   */
  onBeforeRequest(details) {
    if (!this.initialized) return {};

    const shouldBlock = adblockIntegration.shouldBlockRequest({
      url: details.url,
      originUrl: details.initiator,
      type: details.type,
    });

    if (shouldBlock) {
      console.log(`[WebRequest] Blocked: ${details.url}`);
      return { cancel: true };
    }

    return {};
  }

  /**
   * Handle before-send-headers event
   * Can inspect and modify headers before sending
   */
  onBeforeSendHeaders(details) {
    if (!this.initialized) return {};

    // Could add header stripping here
    return {};
  }

  /**
   * Register listeners with the WebRequest API
   */
  registerListeners() {
    // This is pseudo-code - actual registration depends on Firefox API
    // In real implementation, use browser.webRequest.onBeforeRequest.addListener()
  }
}

// ============================================================================
// 3. HTML SANITIZER: Remove Ad Frames and Known Ad Elements
// ============================================================================

export class HtmlSanitizer {
  /**
   * Called to process HTML before rendering
   */
  sanitizeDocument(document) {
    // Remove all ad-related elements
    this._removeAdFrames(document);
    this._removeKnownAdContainers(document);
    this._removeTrackingPixels(document);

    return document;
  }

  _removeAdFrames(document) {
    // Find and remove <iframe> elements that match ad domains
    const iframes = document.querySelectorAll("iframe");
    for (const iframe of iframes) {
      const src = iframe.getAttribute("src") || "";
      if (adblockIntegration.shouldBlockRequest({
        url: src,
        type: "sub_frame",
      })) {
        iframe.remove();
        console.log(`[Sanitizer] Removed ad iframe: ${src}`);
      }
    }
  }

  _removeKnownAdContainers(document) {
    // Remove elements with common ad class/id names
    const adSelectors = [
      "[class*='advertisement']",
      "[id*='advertisement']",
      "[class*='ads']",
      "[id*='ads']",
      ".ad-banner",
      "#ad-banner",
    ];

    for (const selector of adSelectors) {
      document.querySelectorAll(selector).forEach(el => el.remove());
    }
  }

  _removeTrackingPixels(document) {
    // Find and remove tracking pixels (1x1 images)
    const images = document.querySelectorAll("img");
    for (const img of images) {
      const width = parseInt(img.getAttribute("width") || 0);
      const height = parseInt(img.getAttribute("height") || 0);

      // Remove 1x1 images (likely tracking pixels)
      if ((width <= 1 && height <= 1) || 
          (img.width <= 1 && img.height <= 1)) {
        const src = img.getAttribute("src") || "";
        if (adblockIntegration.shouldBlockRequest({
          url: src,
          type: "image",
        })) {
          img.remove();
          console.log(`[Sanitizer] Removed tracking pixel: ${src}`);
        }
      }
    }
  }
}

// ============================================================================
// 4. PREFERENCE/SETTINGS INTEGRATION
// ============================================================================

export class AdblockSettings {
  /**
   * Initialize from Firefox preferences
   */
  async initFromPreferences() {
    const Services = ChromeUtils.import("resource://gre/modules/Services.jsm").Services;

    // Check if adblock is enabled
    const enabled = Services.prefs.getBoolPref("browser.adblock.enabled", true);
    adblockService.setEnabled(enabled);

    // Load custom filter lists from preferences
    const customFilters = Services.prefs.getStringPref(
      "browser.adblock.customfilters",
      ""
    );

    if (customFilters) {
      await adblockService.addFilterList("user-custom", customFilters);
    }
  }

  /**
   * Listen for preference changes
   */
  observePreferences() {
    const Services = ChromeUtils.import("resource://gre/modules/Services.jsm").Services;

    Services.prefs.addObserver("browser.adblock.", this);
  }

  observe(subject, topic, data) {
    if (data === "browser.adblock.enabled") {
      const enabled = subject.getBoolPref("browser.adblock.enabled");
      adblockService.setEnabled(enabled);
      console.log(`Adblock ${enabled ? "enabled" : "disabled"}`);
    }
  }
}

// ============================================================================
// 5. STATISTICS AND MONITORING
// ============================================================================

export class AdblockStats {
  constructor() {
    this.blockedRequests = 0;
    this.allowedRequests = 0;
    this.startTime = Date.now();
  }

  recordBlockedRequest(url) {
    this.blockedRequests++;
    console.log(`[Stats] Blocked request #${this.blockedRequests}: ${url}`);
  }

  recordAllowedRequest(url) {
    this.allowedRequests++;
  }

  getStats() {
    const uptime = Date.now() - this.startTime;
    const totalRequests = this.blockedRequests + this.allowedRequests;
    const blockRate = totalRequests > 0
      ? (this.blockedRequests / totalRequests * 100).toFixed(2)
      : 0;

    return {
      blockedRequests: this.blockedRequests,
      allowedRequests: this.allowedRequests,
      totalRequests: totalRequests,
      blockRate: `${blockRate}%`,
      uptime: `${(uptime / 1000 / 60).toFixed(1)} minutes`,
      filterStats: adblockService.getStats(),
    };
  }

  printStats() {
    const stats = this.getStats();
    console.log("[AdblockStats]", JSON.stringify(stats, null, 2));
  }
}

// ============================================================================
// 6. COMMON PATTERNS AND EXAMPLES
// ============================================================================

/**
 * Example 1: Check if URL should be blocked
 */
function example_checkUrl() {
  const url = "https://ads.doubleclick.net/banner.js";
  const sourceUrl = "https://example.com";
  const type = "script";

  if (adblockIntegration.shouldBlockRequest({ url, sourceUrl, type })) {
    console.log("URL would be blocked");
  } else {
    console.log("URL allowed to load");
  }
}

/**
 * Example 2: Add custom filters from user input
 */
async function example_addCustomFilters() {
  const customRules = `
! My custom advertisement filters
||customads.example.com^
/banner-ad-*
*.example.com/*ads
`;

  try {
    await adblockIntegration.addCustomFilters(customRules);
    console.log("Custom filters added successfully");
  } catch (error) {
    console.error("Failed to add custom filters:", error);
  }
}

/**
 * Example 3: Enable/disable adblock dynamically
 */
function example_toggleAdblock() {
  const currentStats = adblockService.getStats();
  const newState = !currentStats.enabled;

  adblockService.setEnabled(newState);
  console.log(`Adblock is now ${newState ? "ON" : "OFF"}`);
}

/**
 * Example 4: Get and display statistics
 */
function example_showStats() {
  const stats = adblockService.getStats();
  console.log("Filter Statistics:");
  console.log(`  Initialized: ${stats.initialized}`);
  console.log(`  Enabled: ${stats.enabled}`);
  console.log(`  Filter Lists: ${stats.filterListsCount}`);
  console.log(`  Total Rules: ${stats.totalRules}`);
}

export default {
  NetworkFilter,
  WebRequestListener,
  HtmlSanitizer,
  AdblockSettings,
  AdblockStats,
  example_checkUrl,
  example_addCustomFilters,
  example_toggleAdblock,
  example_showStats,
};
