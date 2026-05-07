/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { AdblockService } from "resource:///modules/AdblockService.sys.mjs";
import { PREFS } from "resource:///modules/AdblockConfig.sys.mjs";
import { statsMonitor } from "resource:///modules/StatsMonitor.sys.mjs";

export class ShieldIntegration {
  constructor() {
    this.initialized = false;
    this.adblockEnabled = false;
    this.channels = new WeakMap();
  }

  async init() {
    try {
      console.log("[ShieldIntegration] Initializing...");
      await AdblockService.init();
      await statsMonitor.init();
      this.adblockEnabled = AdblockService.enabled;
      this._setupNetworkObservers();
      Services.prefs.addObserver(PREFS.ENABLED, this);
      this.initialized = true;
      console.log("[ShieldIntegration] Initialized successfully");
    } catch (error) {
      console.error("[ShieldIntegration] Failed to initialize:", error);
    }
  }

  _setupNetworkObservers() {
    Services.obs.addObserver(this, "http-on-before-connect", false);
    Services.obs.addObserver(this, "http-on-modify-request", false);
    Services.obs.addObserver(this, "document-element-inserted", false);
    Services.obs.addObserver(this, "adblock-shield-toggled", false);
  }

  observe(subject, topic, data) {
    switch (topic) {
      case "http-on-before-connect":
      case "http-on-modify-request":
        this._onHttpRequest(subject);
        break;
      case "document-element-inserted":
        this._onDocumentInserted(subject);
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
        AdblockService.setEnabled(this.adblockEnabled);
        console.log(`[ShieldIntegration] Shield toggled: ${this.adblockEnabled}`);
        break;
    }
  }

  _onDocumentInserted(subject) {
    if (!this.adblockEnabled || !this.initialized) return;
    try {
      const document = subject?.defaultView ? subject : subject?.documentElement?.ownerDocument || subject;
      if (!document || document.nodeType !== 9) return;
      const root = document.documentElement;
      if (!root || root.localName !== "html") return;

      const win = document.defaultView;
      if (!win || win.top !== win) {
        console.log("[ShieldIntegration] Skipping iframe/subdocument");
        return;
      }

      try {
        const pageUrl = document.documentURI || document.URL || "";
        console.log("[ShieldIntegration] Document inserted, URL:", pageUrl);
        if (pageUrl.startsWith("http://") || pageUrl.startsWith("https://")) {
          console.log("[ShieldIntegration] Emitting adblock-page-navigated for:", pageUrl);
          Services.obs.notifyObservers(null, "adblock-page-navigated", pageUrl);
        }
      } catch (e) {
        console.error("[ShieldIntegration] Error in _onDocumentInserted:", e);
      }

      this._injectCosmeticCSS(document);
      this.sanitizeDocument(document);
    } catch (error) {}
  }

  _onHttpRequest(subject) {
    if (!this.adblockEnabled || !this.initialized) return;

    try {
      const channel = subject.QueryInterface(Ci.nsIHttpChannel);
      const uri = channel.URI;
      const url = uri.spec;

      // Hard bypass: never block YouTube live chat regardless of anything else
      if (url.includes("live_chat") || url.includes("live_chat_replay")) return;

      // Determine resource type from URL only (response headers don't exist yet at request time)
      const contentType = this._getResourceType(null, url);

      let referrer = "";
      try { referrer = channel.referrer?.spec || ""; } catch (e) {}

      if (AdblockService.shouldBlock(url, referrer, contentType)) {
        console.log(`[ShieldIntegration] Blocking: ${url}`);
        channel.cancel(Cr.NS_BINDING_ABORTED);
        try {
          Services.obs.notifyObservers(
            null,
            "adblock-request-blocked",
            `${url}|${contentType}|0|${referrer}`
          );
        } catch (e) {}
      }
    } catch (error) {}
  }

  _getResourceType(contentTypeHeader, url) {
    // Detect YouTube live chat early
    if (url.includes("live_chat") || url.includes("live_chat_replay")) return "subdocument";

    if (!contentTypeHeader) {
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
    if (type.includes("html")) return "subdocument";
    return "other";
  }

  sanitizeDocument(document) {
    if (!this.adblockEnabled) return;
    try {
      this._injectCosmeticCSS(document);
      this._removeAdFrames(document);
      this._removeAdImages(document);
      this._removeAdScripts(document);
      this._removeTrackingPixels(document);
      this._removeAdContainers(document);
    } catch (error) {
      console.error("[ShieldIntegration] Error sanitizing document:", error);
    }
  }

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

  _removeAdImages(document) {
    const images = document.querySelectorAll("img");
    for (const img of images) {
      const src = img.getAttribute("src") || "";
      if (src && AdblockService.shouldBlock(src, "", "image")) {
        img.remove();
      }
    }
  }

  _removeAdScripts(document) {
    const scripts = document.querySelectorAll("script");
    for (const script of scripts) {
      const src = script.getAttribute("src") || "";
      if (src && AdblockService.shouldBlock(src, "", "script")) {
        script.remove();
      }
    }
  }

  _removeTrackingPixels(document) {
    const images = document.querySelectorAll("img");
    for (const img of images) {
      const width = parseInt(img.getAttribute("width") || img.width || "0");
      const height = parseInt(img.getAttribute("height") || img.height || "0");
      if ((width <= 1 && height <= 1) || (img.width <= 1 && img.height <= 1)) {
        const src = img.getAttribute("src") || "";
        if (src && AdblockService.shouldBlock(src, "", "image")) {
          img.remove();
        }
      }
    }
  }

  _removeAdContainers(document) {
    try {
      const selectors = [
        "ins.adsbygoogle",
        "[id*='asw-']", "[id*='aswift_']", "[id*='google_ads_']",
        "[id*='gpt_unit']", "[id*='div-gpt-ad']",
        "[id*='ad-']", "[id^='ad_']", "[id^='ad-']",
        "[class*='adsbygoogle']", "[class*='gpt-ad']",
        "[class*='ad-slot']", "[class*='ad-unit']",
        "[class*='ad-banner']", "[class*='advertisement']",
        "[class*='sponsored']", "[class*='promoted']", "[class*='adwrapper']",
        "[data-ad-slot]", "[data-ad-format]", "[data-ad-client]", "[data-google-query-id]",
        "iframe[src*='doubleclick.net']",
        "iframe[src*='googlesyndication']",
        "iframe[src*='googleadservices']",
      ];
      for (const selector of selectors) {
        for (const el of document.querySelectorAll(selector)) {
          this._removeAdElementAndContainer(el);
        }
      }
      for (const el of document.querySelectorAll("div, section, aside, article")) {
        const id = (el.id || "").toLowerCase();
        const cls = (el.className || "").toLowerCase();
        const style = (el.getAttribute("style") || "").toLowerCase();
        const hasAdMarker =
          id.includes("ad") || cls.includes("ad") ||
          el.hasAttribute("data-ad-slot") || el.hasAttribute("data-ad-client") ||
          el.hasAttribute("data-google-query-id") ||
          style.includes("height: 280px") || style.includes("height:280px") ||
          style.includes("min-height: 250px") || style.includes("min-height:250px");
        if (!hasAdMarker) continue;
        const rect = el.getBoundingClientRect();
        const text = el.textContent.trim();
        if ((rect.height > 0 || rect.width > 0) && text.length === 0) {
          this._removeAdElementAndContainer(el);
        }
      }
    } catch (error) {
      console.error("[ShieldIntegration] Error removing ad containers:", error);
    }
  }

  _injectCosmeticCSS(document) {
    try {
      if (!document || !document.documentElement) return;
      const existing = document.getElementById("lykon-adblock-cosmetic-style");
      if (existing) return;
      const style = document.createElement("style");
      style.id = "lykon-adblock-cosmetic-style";
      style.textContent = `
        ins.adsbygoogle, .ads, .ad, .ad-box, .ad-container, .ad-wrapper,
        .ad-slot, .ad-unit, .ad-banner, .advertisement, .sponsored, .promoted,
        [id*="asw-"], [id*="aswift_"], [id*="google_ads_"], [id*="gpt_unit"],
        [id*="div-gpt-ad"], [id^="ad_"], [id^="ad-"],
        [class*="adsbygoogle"], [class*="gpt-ad"], [class*="ad-slot"],
        [class*="ad-unit"], [class*="ad-banner"], [class*="advertisement"],
        [class*="sponsored"], [class*="promoted"],
        [data-ad-slot], [data-ad-format], [data-ad-client], [data-google-query-id],
        iframe[src*="doubleclick.net"], iframe[src*="googlesyndication"],
        iframe[src*="googleadservices"], iframe[src*="ads.google"],
        iframe[src*="amazon-adsystem"] {
          display: none !important;
          visibility: hidden !important;
          width: 0 !important; height: 0 !important;
          min-width: 0 !important; min-height: 0 !important;
          margin: 0 !important; padding: 0 !important;
          border: 0 !important; overflow: hidden !important;
        }
      `;
      const parent = document.head || document.documentElement;
      parent.appendChild(style);
    } catch (error) {}
  }

  _removeAdElementAndContainer(element) {
    try {
      let target = element;
      let parent = element?.parentElement;
      for (let i = 0; i < 4 && parent; i++) {
        const id = (parent.id || "").toLowerCase();
        const cls = (parent.className || "").toLowerCase();
        const data = [
          parent.getAttribute("data-ad-slot"), parent.getAttribute("data-ad-format"),
          parent.getAttribute("data-ad-client"), parent.getAttribute("data-google-query-id"),
        ].filter(Boolean).join(" ").toLowerCase();
        if (id.includes("ad") || cls.includes("ad") || data.includes("ad") ||
            id.includes("asw") || id.includes("gpt") || cls.includes("adsbygoogle")) {
          target = parent;
          break;
        }
        parent = parent.parentElement;
      }
      target.remove();
    } catch (error) {
      try { element?.remove(); } catch (e) {}
    }
  }

  getStatus() {
    return {
      initialized: this.initialized,
      enabled: this.adblockEnabled,
      stats: AdblockService.getStats(),
    };
  }

  QueryInterface = ChromeUtils.generateQI([
    "nsIObserver",
    "nsISupportsWeakReference",
  ]);
}

export const shieldIntegration = new ShieldIntegration();
export default shieldIntegration;