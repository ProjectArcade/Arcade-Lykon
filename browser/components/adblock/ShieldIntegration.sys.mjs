/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Lykon Shield Integration for Ad Blocking
 * 
 * This module integrates the adblock service with Lykon's security shield.
 * It blocks ads early in the network request lifecycle and removes ad elements
 * from DOM before rendering.
 */

import { AdblockService } from "resource:///modules/AdblockService.sys.mjs"; // ✅ named import
import { PREFS } from "resource:///modules/AdblockConfig.sys.mjs";


export class ShieldIntegration {
  constructor() {
    this.initialized = false;
    this.adblockEnabled = false;
    this.channels = new WeakMap();
  }

  /**
   * Initialize shield integration with the ad blocker
   */
  async init() {
    try {
      console.log("[ShieldIntegration] Initializing...");

      // Initialize ad blocker service first
      await AdblockService.init();
      this.adblockEnabled = AdblockService.enabled;

      // Set up HTTP observers for early blocking
      this._setupNetworkObservers();

      // Watch for pref changes
      Services.prefs.addObserver(PREFS.ENABLED, this);

      this.initialized = true;
      console.log("[ShieldIntegration] Initialized successfully");
    } catch (error) {
      console.error("[ShieldIntegration] Failed to initialize:", error);
    }
  }

  /**
   * Set up HTTP channel observers for ad blocking
   */
  _setupNetworkObservers() {
    Services.obs.addObserver(this, "http-on-before-connect", false);
    Services.obs.addObserver(this, "http-on-modify-request", false);
    Services.obs.addObserver(this, "adblock-shield-toggled", false);
  }

  /**
   * Observe network events
   */
  observe(subject, topic, data) {
    switch (topic) {
      case "http-on-before-connect":
      case "http-on-modify-request":
        this._onHttpRequest(subject);
        break;
      case "adblock-shield-toggled":
        this.adblockEnabled = data === "true";
        AdblockService.setEnabled(this.adblockEnabled);
        console.log("[ShieldIntegration] Shield toggled via UI:", this.adblockEnabled);
        try {
          const { BrowserWindowTracker } = ChromeUtils.importESModule("resource:///modules/BrowserWindowTracker.sys.mjs");
          for (const win of BrowserWindowTracker.orderedWindows) {
            if (win.gBrowser) {
              for (const browser of win.gBrowser.browsers) {
                try { browser.reload(); } catch(e) {}
              }
            }
          }
        } catch(e) {}
        break;
      case PREFS.ENABLED:
        this.adblockEnabled = Services.prefs.getBoolPref(PREFS.ENABLED, true);
        console.log("[ShieldIntegration] Pref changed, blocking now:", this.adblockEnabled);
        AdblockService.setEnabled(this.adblockEnabled);
        console.log(`[ShieldIntegration] Shield toggled: ${this.adblockEnabled}`);
        break;
    }
  }

  /**
   * Handle HTTP requests - perform early blocking
   */
  _onHttpRequest(subject) {
    if (!this.adblockEnabled || !this.initialized) {
      return;
    }

    try {
      const channel = subject.QueryInterface(Ci.nsIHttpChannel);
      const uri = channel.URI;
      const url = uri.spec;

      // Determine resource type from content-type header
      let contentType = "other";
      try {
        const typeHeader = channel.getResponseHeader("Content-Type");
        contentType = this._getResourceType(typeHeader, url);
      } catch (e) {
        // Use default if no response header
      }

      // Get referrer
      let referrer = "";
      try {
        referrer = channel.referrer?.spec || "";
      } catch (e) {
        // No referrer
      }

      // Check if URL should be blocked
      if (AdblockService.shouldBlock(url, referrer, contentType)) {
        console.log(`[ShieldIntegration] Blocking: ${url}`);
        channel.cancel(Cr.NS_BINDING_ABORTED);
      }
    } catch (error) {
      // Silently ignore errors in observation
    }
  }

  /**
   * Determine resource type from headers and URL
   */
  _getResourceType(contentTypeHeader, url) {
    if (!contentTypeHeader) {
      // Try to guess from URL
      if (url.includes(".js")) return "script";
      if (url.includes(".css")) return "stylesheet";
      if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)/i)) return "image";
      if (url.match(/\.(woff|ttf|otf|eot)/i)) return "font";
      return "other";
    }

    const type = contentTypeHeader.toLowerCase();
    if (type.includes("javascript")) return "script";
    if (type.includes("css")) return "stylesheet";
    if (type.includes("image")) return "image";
    if (type.includes("font")) return "font";
    if (type.includes("audio") || type.includes("video")) return "media";
    if (type.includes("xml") || type.includes("json")) return "xmlhttprequest";
    return "other";
  }

  /**
   * Remove ad elements from document
   * Called early in page load
   */
  sanitizeDocument(document) {
    if (!this.adblockEnabled) {
      return;
    }

    try {
      this._removeAdFrames(document);
      this._removeAdImages(document);
      this._removeAdScripts(document);
      this._removeTrackingPixels(document);
    } catch (error) {
      console.error("[ShieldIntegration] Error sanitizing document:", error);
    }
  }

  /**
   * Remove ad iframes
   */
  _removeAdFrames(document) {
    const adDomains = [
      "doubleclick.net",
      "ads.google.com",
      "googlesyndication.com",
      "facebook.com/tr",
      "googletagmanager.com",
      "analytics.google.com",
      "ads.mopub.com",
    ];

    const iframes = document.querySelectorAll("iframe");
    for (const iframe of iframes) {
      const src = iframe.getAttribute("src") || "";
      if (
        adDomains.some(domain => src.includes(domain)) ||
        AdblockService.shouldBlock(src, "", "sub_frame")
      ) {
        iframe.remove();
      }
    }
  }

  /**
   * Remove images that are ad-related
   */
  _removeAdImages(document) {
    const images = document.querySelectorAll("img");
    for (const img of images) {
      const src = img.getAttribute("src") || "";
      if (src && AdblockService.shouldBlock(src, "", "image")) {
        img.remove();
      }
    }
  }

  /**
   * Remove script tags loading ads
   */
  _removeAdScripts(document) {
    const scripts = document.querySelectorAll("script");
    for (const script of scripts) {
      const src = script.getAttribute("src") || "";
      if (src && AdblockService.shouldBlock(src, "", "script")) {
        script.remove();
      }
    }
  }

  /**
   * Remove tracking pixels (1x1 images and beacons)
   */
  _removeTrackingPixels(document) {
    const images = document.querySelectorAll("img");
    for (const img of images) {
      const width = parseInt(img.getAttribute("width") || img.width || "0");
      const height = parseInt(img.getAttribute("height") || img.height || "0");

      // Remove 1x1 images (tracking pixels)
      if ((width <= 1 && height <= 1) || (img.width <= 1 && img.height <= 1)) {
        const src = img.getAttribute("src") || "";
        if (src && AdblockService.shouldBlock(src, "", "image")) {
          img.remove();
        }
      }
    }
  }

  /**
   * Get shield status for UI
   */
  getStatus() {
    return {
      initialized: this.initialized,
      enabled: this.adblockEnabled,
      stats: AdblockService.getStats(),
    };
  }

  /**
   * QueryInterface for XPCOM observer
   */
  QueryInterface = ChromeUtils.generateQI([
    "nsIObserver",
    "nsISupportsWeakReference",
  ]);
}

// Create singleton instance
export const shieldIntegration = new ShieldIntegration();

export default shieldIntegration;
