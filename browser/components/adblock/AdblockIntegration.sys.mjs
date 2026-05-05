/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. */

"use strict";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  AdblockService: "resource:///modules/AdblockService.sys.mjs",
});

export class AdblockIntegration {
  constructor() {
    this.enabled = true;
    this.stats = {
      blocked: 0,
      allowed: 0,
      startTime: Date.now(),
    };
  }

  async init() {
    try {
      await lazy.AdblockService.init();
      this.enabled = lazy.AdblockService.enabled;
    } catch (error) {
      console.error("[AdblockIntegration] Failed to initialize:", error);
    }
  }

  shouldBlockRequest(request) {
    if (!this.enabled) return false;
    const { url, originUrl = "", type = "other" } = request;
    const mappedType = this._mapResourceType(type);
    return lazy.AdblockService.shouldBlock(url, originUrl, mappedType);
  }

  _mapResourceType(browserType) {
    const typeMap = {
      main_frame: "document",
      sub_frame: "document",
      stylesheet: "stylesheet",
      script: "script",
      image: "image",
      font: "font",
      xmlhttprequest: "xmlhttprequest",
      media: "media",
      object: "object",
      other: "other",
    };
    return typeMap[browserType] || "other";
  }

  getStats() {
    return lazy.AdblockService.getStats();
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    lazy.AdblockService.setEnabled(enabled);
  }

  async addCustomFilters(rules) {
    try {
      await lazy.AdblockService.addFilterList("User-Custom", rules);
    } catch (error) {
      console.error("[AdblockIntegration] Failed to add custom filters:", error);
    }
  }
}

export const adblockIntegration = new AdblockIntegration();
export default adblockIntegration;