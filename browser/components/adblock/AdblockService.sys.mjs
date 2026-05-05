/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. */

"use strict";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  filterManager: "resource:///modules/FilterManager.sys.mjs",
});

class _AdblockService {
  constructor() {
    this.enabled = true;
    this._initialized = false;
    this._stats = {
      blocked: 0,
      allowed: 0,
      startTime: Date.now(),
    };
  }

  async init() {
    if (this._initialized) return;
    try {
      await lazy.filterManager.init();
      this._initialized = true;
    } catch (e) {
      console.error("[AdblockService] Init failed:", e);
      throw e;
    }
  }

  shouldBlock(url, originUrl, resourceType) {
    if (!this.enabled || !this._initialized) return false;
    try {
      return lazy.filterManager.matches(url, originUrl, resourceType);
    } catch (e) {
      return false;
    }
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }

  getStats() {
    return { ...this._stats };
  }

  incrementBlocked() {
    this._stats.blocked++;
  }

  incrementAllowed() {
    this._stats.allowed++;
  }

  async addFilterList(name, rules) {
    await lazy.filterManager.addList(name, rules);
  }
}

export const AdblockService = new _AdblockService();