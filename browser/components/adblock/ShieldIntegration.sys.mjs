/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { AdblockService } from "resource:///modules/AdblockService.sys.mjs";
import { PREFS } from "resource:///modules/AdblockConfig.sys.mjs";
import { statsMonitor } from "resource:///modules/StatsMonitor.sys.mjs";

const CONTENT_POLICY_TYPE_MAP = {
  [Ci.nsIContentPolicy.TYPE_SCRIPT]: "script",
  [Ci.nsIContentPolicy.TYPE_STYLESHEET]: "stylesheet",
  [Ci.nsIContentPolicy.TYPE_IMAGE]: "image",
  [Ci.nsIContentPolicy.TYPE_FONT]: "font",
  [Ci.nsIContentPolicy.TYPE_XMLHTTPREQUEST]: "xmlhttprequest",
  [Ci.nsIContentPolicy.TYPE_FETCH]: "xmlhttprequest",
  [Ci.nsIContentPolicy.TYPE_MEDIA]: "media",
  [Ci.nsIContentPolicy.TYPE_OBJECT]: "object",
  [Ci.nsIContentPolicy.TYPE_SUBDOCUMENT]: "subdocument",
  [Ci.nsIContentPolicy.TYPE_DOCUMENT]: "document",
  [Ci.nsIContentPolicy.TYPE_PING]: "ping",
  [Ci.nsIContentPolicy.TYPE_WEBSOCKET]: "websocket",
  [Ci.nsIContentPolicy.TYPE_BEACON]: "ping",
};

export class ShieldIntegration {
  constructor() {
    this.initialized = false;
    this.adblockEnabled = false;
    this.channels = new WeakMap();
  }

  async init() {
    try {
      await AdblockService.init();
      await statsMonitor.init();
      this.adblockEnabled = AdblockService.enabled;
      this._setupNetworkObservers();
      Services.prefs.addObserver(PREFS.ENABLED, this);
      this.initialized = true;
      console.log(
        `[ShieldIntegration] Initialized (engine: ${AdblockService.isNative ? "native" : "js"})`
      );
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
        try {
          const { BrowserWindowTracker } = ChromeUtils.importESModule(
            "resource:///modules/BrowserWindowTracker.sys.mjs"
          );
          for (const win of BrowserWindowTracker.orderedWindows) {
            if (win.gBrowser) {
              for (const browser of win.gBrowser.browsers) {
                try {
                  browser.reload();
                } catch (e) {}
              }
            }
          }
        } catch (e) {}
        break;
      case PREFS.ENABLED:
        this.adblockEnabled = Services.prefs.getBoolPref(PREFS.ENABLED, true);
        AdblockService.setEnabled(this.adblockEnabled);
        break;
    }
  }

  _onDocumentInserted(subject) {
    if (!this.adblockEnabled || !this.initialized) return;
    try {
      const document =
        subject?.defaultView
          ? subject
          : subject?.documentElement?.ownerDocument || subject;
      if (!document || document.nodeType !== 9) return;
      const root = document.documentElement;
      if (!root || root.localName !== "html") return;

      const win = document.defaultView;
      if (!win || win.top !== win) return;

      try {
        const pageUrl = document.documentURI || document.URL || "";
        if (pageUrl.startsWith("http://") || pageUrl.startsWith("https://")) {
          Services.obs.notifyObservers(
            null,
            "adblock-page-navigated",
            pageUrl
          );
        }
      } catch (e) {}

      this._injectCosmeticCSS(document);
    } catch (error) {}
  }

  _onHttpRequest(subject) {
    if (!this.adblockEnabled || !this.initialized) return;

    try {
      const channel = subject.QueryInterface(Ci.nsIHttpChannel);
      const uri = channel.URI;
      const url = uri.spec;

      if (url.includes("live_chat") || url.includes("live_chat_replay")) return;

      const contentType = this._getResourceType(channel);

      let referrer = "";
      try {
        referrer = channel.referrer?.spec || "";
      } catch (e) {}
      if (!referrer) {
        try {
          referrer = channel.loadInfo?.loadingPrincipal?.URI?.spec || "";
        } catch (e) {}
      }
      if (!referrer) {
        try {
          const hdr = channel.getRequestHeader("Referer");
          if (hdr) referrer = hdr;
        } catch (e) {}
      }

      if (AdblockService.shouldBlock(url, referrer, contentType)) {
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

  _getResourceType(channel) {
    try {
      const loadInfo = channel.loadInfo;
      if (loadInfo) {
        const policyType = loadInfo.externalContentPolicyType;
        const mapped = CONTENT_POLICY_TYPE_MAP[policyType];
        if (mapped) return mapped;
      }
    } catch (e) {}

    const url = channel.URI.spec;
    return this._guessTypeFromUrl(url);
  }

  _guessTypeFromUrl(url) {
    if (url.includes("live_chat") || url.includes("live_chat_replay"))
      return "subdocument";
    if (/\.js(?:\?|$|#)/i.test(url)) return "script";
    if (/\.css(?:\?|$|#)/i.test(url)) return "stylesheet";
    if (/\.(jpg|jpeg|png|gif|webp|svg|ico)(?:\?|$|#)/i.test(url))
      return "image";
    if (/\.(woff2?|ttf|otf|eot)(?:\?|$|#)/i.test(url)) return "font";
    if (/\.(mp4|webm|m3u8|mpd|mp3|ogg|aac|flac)(?:\?|$|#)/i.test(url))
      return "media";
    return "other";
  }

  _injectCosmeticCSS(document) {
    try {
      if (!document || !document.documentElement) return;
      const existing = document.getElementById(
        "lykon-adblock-cosmetic-style"
      );
      if (existing) return;
      const style = document.createElement("style");
      style.id = "lykon-adblock-cosmetic-style";
      style.textContent = `
        /* High-specificity Generic Ad Hiding */
        ins.adsbygoogle, .ads, .ad, .ad-box, .ad-container, .ad-wrapper,
        .ad-slot, .ad-unit, .ad-banner, .advertisement, .sponsored-post,
        [id*="asw-"], [id*="aswift_"], [id*="google_ads_"], [id*="gpt_unit"],
        [id*="div-gpt-ad"], [id^="ad_"], [id^="ad-"], [id*="-ad-"],
        [class*="adsbygoogle"], [class*="gpt-ad"], [class*="ad-slot"],
        [class*="ad-unit"], [class*="ad-banner"], [class*="advertisement"],
        [data-ad-slot], [data-ad-format], [data-ad-client], [data-google-query-id],
        [data-adunit], [data-adslot], [data-gpt-slot],
        
        /* YouTube Specific Ad Hiding */
        ytd-companion-slot-renderer, 
        ytd-ad-slot-renderer, 
        ytd-promoted-sparkles-web-renderer,
        ytd-promoted-sparkles-text-search-renderer,
        ytd-display-ad-render,
        ytd-statement-banner-renderer,
        ytd-in-feed-ad-layout-renderer,
        ytd-banner-promo-renderer,
        .ytd-ad-slot-renderer,
        #player-ads, #masthead-ad, #panels.ytd-watch-flexy #ad-slot,
        .ytp-ad-progress-list, .ytp-ad-overlay-container,
        .ytp-ad-message-container, .ytp-ad-player-overlay,
        .ytp-ad-image-overlay, .video-ads, .ytp-ad-module,
        
        /* YouTube "Ad" labels */
        [aria-label="Advertisement"], 
        .ytd-badge-supported-renderers > .ytd-badge-supported-renderers[aria-label="Ad"],
        yt-icon-button.ytd-ad-slot-renderer,
        
        /* Generic iframe hiding for ad-system sources */
        iframe[src*="doubleclick.net"], iframe[src*="googlesyndication"],
        iframe[src*="googleadservices"], iframe[src*="ads.google"],
        iframe[src*="amazon-adsystem"], iframe[src*="taboola.com"],
        iframe[src*="outbrain.com"], iframe[src*="adnxs.com"] {
          display: none !important;
          visibility: hidden !important;
          width: 0 !important; height: 0 !important;
          min-width: 0 !important; min-height: 0 !important;
          margin: 0 !important; padding: 0 !important;
          border: 0 !important; overflow: hidden !important;
          pointer-events: none !important;
          opacity: 0 !important;
        }

        /* Collapse empty containers that might have ad-like classes */
        [class*="ad-"]:empty, [class*="ads-"]:empty, [id*="ad-"]:empty {
          display: none !important;
        }
      `;
      const parent = document.head || document.documentElement;
      parent.appendChild(style);
    } catch (error) {}
  }

  getStatus() {
    return {
      initialized: this.initialized,
      enabled: this.adblockEnabled,
      native: AdblockService.isNative,
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