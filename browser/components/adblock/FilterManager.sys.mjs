/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. */

"use strict";

import { PREFS } from "resource:///modules/AdblockConfig.sys.mjs";

// YouTube & Google video CDN domains — never block for media/document types
const MEDIA_ALLOWLIST_DOMAINS = new Set([
  "googlevideo.com",
  "youtube.com",
  "youtu.be",
  "ytimg.com",
  "yt3.ggpht.com",
  "yt3.googleusercontent.com",
  "googleapis.com",
  "gvt1.com",
  "gvt2.com",
  "gvt3.com",
]);

// URL substrings that are always YouTube video stream markers — never block
const MEDIA_STREAM_PATTERNS = [
  "videoplayback",
  "mime=video",
  "mime=audio",
  "itag=",
  "yt_live_broadcast",
  "/api/timedtext",
  "googlevideo.com",
  "live_chat",
  "live_chat_replay",
];

// Resource types that carry actual video/audio — never block on allowlisted domains
const SAFE_MEDIA_TYPES = new Set([
  "media",
  "object",
  "xmlhttprequest",
  "subdocument",
  "document",
]);

export class FilterManager {
  constructor() {
    this.initialized = false;
    this._domainBlocks = new Set();
    this._substringBlocks = [];
    this._regexBlocks = [];
    this._allowlist = [];
    this.customFilters = new Map();
  }

  async init() {
    try {
      await new Promise(resolve => {
        ChromeUtils.idleDispatch(async () => {
          await this._loadBuiltinLists();
          resolve();
        }, { timeout: 5000 });
      });
      await this._loadCustomFilters();
      this.initialized = true;
      console.log(`[FilterManager] Ready: ${this._domainBlocks.size} domains, ${this._substringBlocks.length} substrings`);
    } catch (error) {
      console.error("[FilterManager] Failed to initialize:", error);
    }
  }

  async _loadBuiltinLists() {
    const lists = [
      "resource:///modules/easylist.txt",
      "resource:///modules/easyprivacy.txt",
    ];
    for (const url of lists) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const text = await response.text();
          this._parseFilterList(text);
        }
      } catch (e) {
        console.warn(`[FilterManager] Could not load ${url}:`, e);
      }
    }
  }

  _parseOptions(optStr) {
    if (!optStr) return null;
    const types = new Set();
    for (const opt of optStr.split(",")) {
      const o = opt.trim().toLowerCase();
      if (o.startsWith("domain=") || o === "third-party" || o === "first-party" ||
          o === "~third-party" || o === "~first-party" || o === "important" ||
          o === "popup" || o === "generichide" || o === "genericblock") {
        continue;
      }
      if (o.startsWith("~")) continue;
      const typeMap = {
        script: "script", stylesheet: "stylesheet", image: "image",
        media: "media", object: "object", xmlhttprequest: "xmlhttprequest",
        font: "font", subdocument: "subdocument", document: "document",
        xhr: "xmlhttprequest", ping: "other", other: "other",
      };
      if (typeMap[o]) types.add(typeMap[o]);
    }
    return types.size > 0 ? types : null;
  }

  _parseFilterList(text) {
    for (let line of text.split("\n")) {
      line = line.trim();

      if (!line || line.startsWith("!") || line.startsWith("[") ||
          line.includes("##") || line.includes("#@#") ||
          line.includes("#?#") || line.includes("#$#")) {
        continue;
      }

      const isAllowlist = line.startsWith("@@");
      if (isAllowlist) line = line.slice(2);

      let types = null;
      const dollarIdx = line.lastIndexOf("$");
      if (dollarIdx !== -1 && !line.includes("$/")) {
        const optStr = line.slice(dollarIdx + 1);
        types = this._parseOptions(optStr);
        line = line.slice(0, dollarIdx);
      }
      if (!line) continue;

      if (line.startsWith("||") && line.endsWith("^") && !line.includes("*")) {
        const domain = line.slice(2, -1);
        if (isAllowlist) {
          this._allowlist.push({ pattern: domain, types, isDomain: true });
        } else {
          if (!types || !this._isMediaOnlyRule(types)) {
            this._domainBlocks.add(domain);
          } else {
            this._substringBlocks.push({ pattern: domain, types, isDomain: true });
          }
        }
        continue;
      }

      if (line.startsWith("/") && line.endsWith("/")) {
        const pattern = line.slice(1, -1);
        try {
          if (!pattern.includes("(") && !pattern.includes("?") && !pattern.includes("[")) {
            if (!isAllowlist && pattern.length > 3) {
              this._substringBlocks.push({ pattern, types });
            }
          }
        } catch (e) {}
        continue;
      }

      const cleaned = line.replace(/^\|+/, "").replace(/\^/g, "").replace(/\*/g, "");
      if (cleaned.length > 4) {
        if (isAllowlist) {
          this._allowlist.push({ pattern: cleaned, types });
        } else {
          this._substringBlocks.push({ pattern: cleaned, types });
        }
      }
    }
  }

  _isMediaOnlyRule(types) {
    if (!types) return false;
    for (const t of types) {
      if (!SAFE_MEDIA_TYPES.has(t)) return false;
    }
    return true;
  }

  _isYouTubeMediaRequest(hostname, url, resourceType) {
    for (const domain of MEDIA_ALLOWLIST_DOMAINS) {
      if (hostname === domain || hostname.endsWith("." + domain)) {
        return true;
      }
    }
    for (const pattern of MEDIA_STREAM_PATTERNS) {
      if (url.includes(pattern)) return true;
    }
    return false;
  }

  matches(url, originUrl, resourceType) {
    if (!this.initialized || !url) return false;
    try {
      let hostname = "";
      try {
        hostname = new URL(url).hostname || "";
      } catch (e) {
        const match = url.match(/(?:https?:\/\/)?([^\/\?#]+)/);
        if (match) hostname = match[1];
        else return false;
      }

      // Hard bypass: never block live chat
      if (url.includes("live_chat") || url.includes("live_chat_replay")) return false;

      // YouTube / Google video CDN hard bypass
      if (SAFE_MEDIA_TYPES.has(resourceType) && this._isYouTubeMediaRequest(hostname, url, resourceType)) {
        return false;
      }
      for (const pattern of MEDIA_STREAM_PATTERNS) {
        if (url.includes(pattern)) return false;
      }

      // Allowlist check
      for (const rule of this._allowlist) {
        if (this._ruleMatchesType(rule.types, resourceType)) {
          if (rule.isDomain) {
            if (hostname === rule.pattern || hostname.endsWith("." + rule.pattern)) return false;
          } else if (url.includes(rule.pattern)) {
            return false;
          }
        }
      }

      // Fast domain block check
      const parts = hostname.split(".");
      for (let i = 0; i < parts.length - 1; i++) {
        if (this._domainBlocks.has(parts.slice(i).join("."))) return true;
      }

      // Substring check
      for (let i = 0; i < this._substringBlocks.length; i++) {
        const rule = this._substringBlocks[i];
        if (!this._ruleMatchesType(rule.types, resourceType)) continue;
        if (rule.isDomain) {
          if (hostname === rule.pattern || hostname.endsWith("." + rule.pattern)) return true;
        } else if (url.includes(rule.pattern)) {
          return true;
        }
      }

      return false;
    } catch (e) {
      return false;
    }
  }

  _ruleMatchesType(ruleTypes, resourceType) {
    if (!ruleTypes) return true;
    if (!resourceType) return true;
    return ruleTypes.has(resourceType);
  }

  async _loadCustomFilters() {
    try {
      const str = Services.prefs.getStringPref(PREFS.CUSTOM_FILTERS, "");
      if (str) {
        const filters = JSON.parse(str);
        for (const [name, rules] of Object.entries(filters)) {
          this.customFilters.set(name, { name, rules, enabled: true });
          this._parseFilterList(rules);
        }
      }
    } catch (e) {}
  }

  _saveCustomFilters() {
    const filters = {};
    for (const [name, data] of this.customFilters.entries()) {
      filters[name] = data.rules;
    }
    Services.prefs.setStringPref(PREFS.CUSTOM_FILTERS, JSON.stringify(filters));
  }

  async addList(name, rules) {
    this.customFilters.set(name, { name, rules, enabled: true });
    this._parseFilterList(rules);
    this._saveCustomFilters();
  }

  getFilters() {
    return Array.from(this.customFilters.values());
  }
}

export const filterManager = new FilterManager();
export default filterManager;