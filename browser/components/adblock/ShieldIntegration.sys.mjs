/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { AdblockService } from "resource:///modules/AdblockService.sys.mjs";
import { PREFS } from "resource:///modules/AdblockConfig.sys.mjs";
import { statsMonitor } from "resource:///modules/StatsMonitor.sys.mjs";
import { siteShieldSettings } from "resource:///modules/SiteShieldSettings.sys.mjs";

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
    Services.obs.addObserver(this, "http-on-modify-request", false);
    Services.obs.addObserver(this, "document-element-inserted", false);
  }

  observe(subject, topic, data) {
    switch (topic) {
      case "http-on-modify-request":
        this._onHttpRequest(subject);
        break;
      case "document-element-inserted":
        this._onDocumentInserted(subject);
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
      const document = subject?.defaultView
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
          Services.obs.notifyObservers(null, "adblock-page-navigated", pageUrl);
        }
      } catch (e) {}
    } catch (error) {}
  }

  _getTopLevelUrl(channel) {
    try {
      const loadInfo = channel.loadInfo;
      if (loadInfo) {
        const bc = loadInfo.browsingContext;
        if (bc?.top?.currentURI) {
          return bc.top.currentURI.spec;
        }
        if (bc?.top?.topWindowContext?.documentURI) {
          return bc.top.topWindowContext.documentURI.spec;
        }
        if (bc?.topWindowContext?.documentURI) {
          return bc.topWindowContext.documentURI.spec;
        }
      }
    } catch (e) {}

    try {
      const referrer =
        channel.referrerInfo?.originalReferrer?.spec || channel.referrer?.spec;
      if (referrer && referrer.startsWith("http")) {
        return referrer;
      }
    } catch (e) {}

    try {
      const principal = channel.loadInfo?.loadingPrincipal;
      if (principal && !principal.isSystemPrincipal) {
        const origin = principal.originNoSuffix || principal.origin;
        if (origin && origin.startsWith("http")) {
          return origin;
        }
      }
    } catch (e) {}

    try {
      if (this._getResourceType(channel) === "document") {
        return channel.URI.spec;
      }
    } catch (e) {}

    return "";
  }

  _getTopLevelHost(channel) {
    const url = this._getTopLevelUrl(channel);
    if (!url) return "";
    try {
      return new URL(url).hostname || "";
    } catch (e) {
      return "";
    }
  }

  _onHttpRequest(subject) {
    if (!this.adblockEnabled || !this.initialized) return;

    try {
      const channel = subject.QueryInterface(Ci.nsIHttpChannel);
      const uri = channel.URI;
      const url = uri.spec;

      if (url.includes("live_chat") || url.includes("live_chat_replay")) return;

      const contentType = this._getResourceType(channel);
      let checkHost = this._getTopLevelHost(channel);
      let checkUrl = this._getTopLevelUrl(channel);

      if (!checkHost && contentType === "document") {
        try {
          checkHost = new URL(url).hostname;
        } catch (e) {}
      }

      if (!checkUrl && contentType === "document") {
        checkUrl = url;
      }

      if (checkUrl && !siteShieldSettings.isEnabledForUrl(checkUrl)) {
        return;
      }

      if (!checkUrl && checkHost && !siteShieldSettings.isEnabledForSite(checkHost)) {
        return;
      }

      let referrer = "";
      try {
        referrer = channel.referrerInfo?.originalReferrer?.spec || "";
      } catch (e) {}
      if (!referrer) {
        try {
          referrer = channel.referrer?.spec || "";
        } catch (e) {}
      }

      const blocked = AdblockService.shouldBlock(url, referrer, contentType);

      if (blocked) {
        const shortUrl = url.split("?")[0].substring(0, 80);
        console.log(`[Shield] BLOCKED: ${shortUrl}`);
        channel.cancel(Cr.NS_BINDING_ABORTED);
        const topLevelUrl = this._getTopLevelUrl(channel) || referrer;
        try {
          Services.obs.notifyObservers(
            null,
            "adblock-request-blocked",
            `${url}|${contentType}|0|${referrer}|${topLevelUrl}`
          );
        } catch (e) {}
      }
    } catch (error) {
      console.error("[ShieldIntegration] _onHttpRequest error:", error);
    }
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
