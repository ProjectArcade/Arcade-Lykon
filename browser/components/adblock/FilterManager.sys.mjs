/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. */

"use strict";

import { PREFS } from "resource:///modules/AdblockConfig.sys.mjs";

export class FilterManager {
  constructor() {
    this.initialized = false;
    this._domainBlocks = new Set();    // ||domain^ style — fast Set lookup
    this._substringBlocks = [];        // plain substring rules
    this._regexBlocks = [];            // regex rules (minimized)
    this._allowlist = [];
    this.customFilters = new Map();
  }

  async init() {
    try {
      // Parse filter lists off the main thread via idle dispatch
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

      // Strip options
      const dollarIdx = line.lastIndexOf("$");
      if (dollarIdx !== -1 && !line.includes("$/")) {
        line = line.slice(0, dollarIdx);
      }
      if (!line) continue;

      // Fast path: pure domain anchor ||domain^ with no wildcards
      if (line.startsWith("||") && line.endsWith("^") && !line.includes("*")) {
        const domain = line.slice(2, -1);
        if (!isAllowlist) {
          this._domainBlocks.add(domain);
        }
        continue;
      }

      // Skip overly complex regex rules to save memory
      if (line.startsWith("/") && line.endsWith("/")) continue;

      // Plain substring (no special chars) — fast indexOf check
      const cleaned = line.replace(/^\|+/, "").replace(/\^/g, "").replace(/\*/g, "");
      if (cleaned.length > 4) {
        if (isAllowlist) {
          this._allowlist.push(cleaned);
        } else {
          this._substringBlocks.push(cleaned);
        }
      }
    }
  }

  matches(url, originUrl, resourceType) {
    if (!this.initialized || !url) return false;
    try {
      // Allowlist check first
      for (const rule of this._allowlist) {
        if (url.includes(rule)) return false;
      }

      // Fast domain check — extract hostname from url
      let hostname = "";
      try {
        hostname = new URL(url).hostname;
      } catch (e) {
        return false;
      }

      // Check domain and all parent domains
      const parts = hostname.split(".");
      for (let i = 0; i < parts.length - 1; i++) {
        if (this._domainBlocks.has(parts.slice(i).join("."))) return true;
      }

      // Substring check (only first 3000 rules to avoid lag on hot path)
      const checkCount = Math.min(this._substringBlocks.length, 3000);
      for (let i = 0; i < checkCount; i++) {
        if (url.includes(this._substringBlocks[i])) return true;
      }

      return false;
    } catch (e) {
      return false;
    }
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
