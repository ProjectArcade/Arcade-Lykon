/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. */

"use strict";

import {
  PREFS,
  MEDIA_ALLOWLIST_DOMAINS,
  MEDIA_STREAM_PATTERNS,
  SAFE_MEDIA_TYPES,
} from "resource:///modules/AdblockConfig.sys.mjs";

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
        ChromeUtils.idleDispatch(
          async () => {
            await this._loadBuiltinLists();
            resolve();
          },
          { timeout: 5000 }
        );
      });
      await this._loadCustomFilters();
      this.initialized = true;
      console.log(
        `[FilterManager] Ready: ${this._domainBlocks.size} domains, ${this._substringBlocks.length} substrings`
      );
    } catch (error) {
      console.error("[FilterManager] Failed to initialize:", error);
    }
  }

  async _loadBuiltinLists() {
    const lists = [
      "resource:///modules/easylist.txt",
      "resource:///modules/easyprivacy.txt",
      "resource:///modules/ublock-filters.txt",
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
    const opts = { types: null, thirdParty: null, domains: null };
    const types = new Set();
    for (const opt of optStr.split(",")) {
      const o = opt.trim().toLowerCase();
      if (o === "third-party" || o === "~first-party") {
        opts.thirdParty = true;
      } else if (o === "first-party" || o === "~third-party") {
        opts.thirdParty = false;
      } else if (o.startsWith("domain=")) {
        const domainStr = o.slice(7);
        const include = new Set();
        const exclude = new Set();
        for (const d of domainStr.split("|")) {
          const dt = d.trim();
          if (!dt) continue;
          if (dt.startsWith("~")) {
            exclude.add(dt.slice(1));
          } else {
            include.add(dt);
          }
        }
        if (include.size > 0 || exclude.size > 0) {
          opts.domains = { include, exclude };
        }
      } else if (
        o === "important" ||
        o === "popup" ||
        o === "generichide" ||
        o === "genericblock"
      ) {
        continue;
      } else if (o.startsWith("~")) {
        continue;
      } else {
        const typeMap = {
          script: "script",
          stylesheet: "stylesheet",
          image: "image",
          media: "media",
          object: "object",
          xmlhttprequest: "xmlhttprequest",
          font: "font",
          subdocument: "subdocument",
          document: "document",
          xhr: "xmlhttprequest",
          ping: "other",
          other: "other",
        };
        if (typeMap[o]) types.add(typeMap[o]);
      }
    }
    opts.types = types.size > 0 ? types : null;
    return opts;
  }

  _parseFilterList(text) {
    for (let line of text.split("\n")) {
      line = line.trim();

      if (
        !line ||
        line.startsWith("!") ||
        line.startsWith("[") ||
        line.includes("##") ||
        line.includes("#@#") ||
        line.includes("#?#") ||
        line.includes("#$#")
      ) {
        continue;
      }

      const isAllowlist = line.startsWith("@@");
      if (isAllowlist) line = line.slice(2);

      let opts = null;
      const dollarIdx = line.lastIndexOf("$");
      if (dollarIdx !== -1 && !line.includes("$/")) {
        const optStr = line.slice(dollarIdx + 1);
        opts = this._parseOptions(optStr);
        line = line.slice(0, dollarIdx);
      }
      if (!line) continue;

      if (line.startsWith("||") && line.endsWith("^") && !line.includes("*")) {
        const domain = line.slice(2, -1);
        if (isAllowlist) {
          this._allowlist.push({
            pattern: domain,
            types: opts?.types || null,
            thirdParty: opts?.thirdParty ?? null,
            domains: opts?.domains || null,
            isDomain: true,
          });
        } else {
          if (!opts?.types && !opts?.thirdParty && !opts?.domains) {
            this._domainBlocks.add(domain);
          } else if (
            opts?.types &&
            this._isMediaOnlyRule(opts.types) &&
            !opts?.thirdParty &&
            !opts?.domains
          ) {
            this._substringBlocks.push({
              pattern: domain,
              types: opts.types,
              thirdParty: null,
              domains: null,
              isDomain: true,
            });
          } else {
            this._substringBlocks.push({
              pattern: domain,
              types: opts?.types || null,
              thirdParty: opts?.thirdParty ?? null,
              domains: opts?.domains || null,
              isDomain: true,
            });
          }
        }
        continue;
      }

      if (line.startsWith("/") && line.endsWith("/")) {
        const pattern = line.slice(1, -1);
        try {
          const re = new RegExp(pattern);
          if (!isAllowlist && pattern.length > 3) {
            this._regexBlocks.push({
              regex: re,
              types: opts?.types || null,
              thirdParty: opts?.thirdParty ?? null,
              domains: opts?.domains || null,
            });
          } else if (isAllowlist) {
            this._allowlist.push({
              regex: re,
              types: opts?.types || null,
              thirdParty: opts?.thirdParty ?? null,
              domains: opts?.domains || null,
            });
          }
        } catch (e) {}
        continue;
      }

      const cleaned = line
        .replace(/^\|+/, "")
        .replace(/\^/g, "")
        .replace(/\*/g, "");
      if (cleaned.length > 4) {
        if (isAllowlist) {
          this._allowlist.push({
            pattern: cleaned,
            types: opts?.types || null,
            thirdParty: opts?.thirdParty ?? null,
            domains: opts?.domains || null,
          });
        } else {
          this._substringBlocks.push({
            pattern: cleaned,
            types: opts?.types || null,
            thirdParty: opts?.thirdParty ?? null,
            domains: opts?.domains || null,
          });
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

  _isThirdParty(urlHostname, originHostname) {
    if (!urlHostname || !originHostname) return true;
    try {
      const urlBase = Services.eTLD.getBaseDomainFromHost(urlHostname);
      const originBase = Services.eTLD.getBaseDomainFromHost(originHostname);
      return urlBase !== originBase;
    } catch (e) {
      return urlHostname !== originHostname;
    }
  }

  _matchesDomainOption(domains, originHostname) {
    if (!domains) return true;
    if (!originHostname) return false;
    if (domains.include.size > 0) {
      let matched = false;
      for (const d of domains.include) {
        if (originHostname === d || originHostname.endsWith("." + d)) {
          matched = true;
          break;
        }
      }
      if (!matched) return false;
    }
    for (const d of domains.exclude) {
      if (originHostname === d || originHostname.endsWith("." + d)) {
        return false;
      }
    }
    return true;
  }

  _matchesThirdParty(ruleThirdParty, urlHostname, originHostname) {
    if (ruleThirdParty === null || ruleThirdParty === undefined) return true;
    const isTP = this._isThirdParty(urlHostname, originHostname);
    return ruleThirdParty ? isTP : !isTP;
  }

  _ruleMatches(rule, url, hostname, originHostname, resourceType) {
    if (!this._ruleMatchesType(rule.types, resourceType)) return false;
    if (!this._matchesThirdParty(rule.thirdParty, hostname, originHostname))
      return false;
    if (!this._matchesDomainOption(rule.domains, originHostname)) return false;

    if (rule.regex) {
      return rule.regex.test(url);
    }
    if (rule.isDomain) {
      return hostname === rule.pattern || hostname.endsWith("." + rule.pattern);
    }
    return url.includes(rule.pattern);
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

      if (url.includes("live_chat") || url.includes("live_chat_replay"))
        return false;

      if (
        SAFE_MEDIA_TYPES.has(resourceType) &&
        this._isYouTubeMediaRequest(hostname, url, resourceType)
      ) {
        return false;
      }
      for (const pattern of MEDIA_STREAM_PATTERNS) {
        if (url.includes(pattern)) return false;
      }

      let originHostname = "";
      if (originUrl) {
        try {
          originHostname = new URL(originUrl).hostname || "";
        } catch (e) {
          const match = originUrl.match(/(?:https?:\/\/)?([^\/\?#]+)/);
          if (match) originHostname = match[1];
        }
      }

      for (const rule of this._allowlist) {
        if (
          this._ruleMatches(rule, url, hostname, originHostname, resourceType)
        ) {
          return false;
        }
      }

      const parts = hostname.split(".");
      for (let i = 0; i < parts.length - 1; i++) {
        if (this._domainBlocks.has(parts.slice(i).join("."))) return true;
      }

      for (const rule of this._substringBlocks) {
        if (
          this._ruleMatches(rule, url, hostname, originHostname, resourceType)
        ) {
          return true;
        }
      }

      for (const rule of this._regexBlocks) {
        if (
          this._ruleMatches(rule, url, hostname, originHostname, resourceType)
        ) {
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
