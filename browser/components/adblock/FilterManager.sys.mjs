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
];

// Resource types that carry actual video/audio — never block on allowlisted domains
const SAFE_MEDIA_TYPES = new Set([
  "media",
  "object",
  "xmlhttprequest",
]);

export class FilterManager {
  constructor() {
    this.initialized = false;
    this._domainBlocks = new Set();    // ||domain^ style — fast Set lookup
    this._substringBlocks = [];        // [{pattern, types: Set|null}]
    this._regexBlocks = [];            // regex rules (minimized)
    this._allowlist = [];              // [{pattern, types: Set|null}]
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

  // Parse a $options string into a Set of resource types (or null = apply to all)
  _parseOptions(optStr) {
    if (!optStr) return null;
    const types = new Set();
    for (const opt of optStr.split(",")) {
      const o = opt.trim().toLowerCase();
      // Skip non-type options
      if (o.startsWith("domain=") || o === "third-party" || o === "first-party" ||
          o === "~third-party" || o === "~first-party" || o === "important" ||
          o === "popup" || o === "generichide" || o === "genericblock") {
        continue;
      }
      // Negated type — means "all types except this", treat as no type restriction
      if (o.startsWith("~")) continue;
      // Map known types
      const typeMap = {
        script: "script", stylesheet: "stylesheet", image: "image",
        media: "media", object: "object", xmlhttprequest: "xmlhttprequest",
        font: "font", subdocument: "document", document: "document",
        xhr: "xmlhttprequest", ping: "other", other: "other",
      };
      if (typeMap[o]) types.add(typeMap[o]);
    }
    return types.size > 0 ? types : null;
  }

  _parseFilterList(text) {
    for (let line of text.split("\n")) {
      line = line.trim();

      // Skip comments, empty, element hiding, cosmetic rules
      if (!line || line.startsWith("!") || line.startsWith("[") ||
          line.includes("##") || line.includes("#@#") ||
          line.includes("#?#") || line.includes("#$#")) {
        continue;
      }

      const isAllowlist = line.startsWith("@@");
      if (isAllowlist) line = line.slice(2);

      // Extract and parse options BEFORE stripping them
      let types = null;
      const dollarIdx = line.lastIndexOf("$");
      if (dollarIdx !== -1 && !line.includes("$/")) {
        const optStr = line.slice(dollarIdx + 1);
        types = this._parseOptions(optStr);
        line = line.slice(0, dollarIdx);
      }
      if (!line) continue;

      // Fast path: pure domain anchor ||domain^ with no wildcards
      if (line.startsWith("||") && line.endsWith("^") && !line.includes("*")) {
        const domain = line.slice(2, -1);
        if (isAllowlist) {
          this._allowlist.push({ pattern: domain, types, isDomain: true });
        } else {
          // Only add to domainBlocks if rule applies to ALL types or non-media types
          // Media-only rules go to substringBlocks so type check can be applied
          if (!types || !this._isMediaOnlyRule(types)) {
            this._domainBlocks.add(domain);
          } else {
            this._substringBlocks.push({ pattern: domain, types, isDomain: true });
          }
        }
        continue;
      }

      // Regex rules
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

      // Plain substring
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
    // Check if hostname belongs to YouTube/Google video CDN
    for (const domain of MEDIA_ALLOWLIST_DOMAINS) {
      if (hostname === domain || hostname.endsWith("." + domain)) {
        return true;
      }
    }
    // Check for YouTube video stream URL patterns
    for (const pattern of MEDIA_STREAM_PATTERNS) {
      if (url.includes(pattern)) return true;
    }
    return false;
  }

  matches(url, originUrl, resourceType) {
    if (!this.initialized || !url) return false;
    try {
      // Extract hostname
      let hostname = "";
      try {
        hostname = new URL(url).hostname || "";
      } catch (e) {
        const match = url.match(/(?:https?:\/\/)?([^\/\?#]+)/);
        if (match) hostname = match[1];
        else return false;
      }

      // ── YouTube / Google video CDN hard bypass ──────────────────────────────
      // Never block media, XHR, or object requests to YouTube/Google video CDN
      if (SAFE_MEDIA_TYPES.has(resourceType) && this._isYouTubeMediaRequest(hostname, url, resourceType)) {
        return false;
      }
      // Also never block video stream URL patterns regardless of reported type
      for (const pattern of MEDIA_STREAM_PATTERNS) {
        if (url.includes(pattern)) return false;
      }
      // ────────────────────────────────────────────────────────────────────────

      // Allowlist check — respects type
      for (const rule of this._allowlist) {
        if (this._ruleMatchesType(rule.types, resourceType)) {
          if (rule.isDomain) {
            if (hostname === rule.pattern || hostname.endsWith("." + rule.pattern)) return false;
          } else if (url.includes(rule.pattern)) {
            return false;
          }
        }
      }

      // Fast domain block check (these are type-unrestricted rules)
      const parts = hostname.split(".");
      for (let i = 0; i < parts.length - 1; i++) {
        if (this._domainBlocks.has(parts.slice(i).join("."))) return true;
      }

      // Substring check — now type-aware
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

  // Returns true if a rule with given types applies to the request's resourceType
  _ruleMatchesType(ruleTypes, resourceType) {
    if (!ruleTypes) return true;           // no type restriction = applies to all
    if (!resourceType) return true;        // unknown request type = apply rule
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
