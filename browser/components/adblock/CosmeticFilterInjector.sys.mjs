/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  AdblockService: "resource:///modules/AdblockService.sys.mjs",
  siteShieldSettings: "resource:///modules/SiteShieldSettings.sys.mjs",
});

const MAX_CACHE_SIZE = 200;
const SELECTOR_BATCH_DELAY_MS = 250;

class _CosmeticFilterInjector {
  constructor() {
    this._resourceCache = new Map();
    this._initialized = false;
  }

  init() {
    if (this._initialized) return;
    this._initialized = true;
  }

  getCosmeticSelectorsForUrl(url) {
    if (!url) return null;

    let cacheKey;
    try {
      const parsed = new URL(url);
      cacheKey = parsed.origin + parsed.pathname;
    } catch (e) {
      cacheKey = url;
    }

    if (this._resourceCache.has(cacheKey)) {
      return this._resourceCache.get(cacheKey);
    }

    let raw;
    try {
      raw = lazy.AdblockService.getCosmeticResources(url);
    } catch (e) {
      console.warn("[CosmeticFilterInjector] getCosmeticResources error:", e);
      return null;
    }
    if (!raw) return null;

    const result = {
      hideSelectors: raw.hide_selectors || [],
      styleSelectors: raw.style_selectors || {},
      exceptions: new Set(raw.exceptions || []),
      generichide: !!raw.generichide,
    };

    if (this._resourceCache.size >= MAX_CACHE_SIZE) {
      const oldest = this._resourceCache.keys().next().value;
      this._resourceCache.delete(oldest);
    }
    this._resourceCache.set(cacheKey, result);

    return result;
  }

  getSelectorsForClassesAndIds(classes, ids, exceptions = []) {
    try {
      return lazy.AdblockService.getHiddenClassIdSelectors(
        classes,
        ids,
        exceptions
      );
    } catch (e) {
      console.warn(
        "[CosmeticFilterInjector] getHiddenClassIdSelectors error:",
        e
      );
      return [];
    }
  }

  buildCssFromResources(resources) {
    if (!resources) return "";
    const parts = [];

    const hideSelectors = resources.hideSelectors;
    if (hideSelectors && hideSelectors.length > 0) {
      const filtered = hideSelectors.filter(s => {
        try {
          // Validate the selector won't throw when used
          return s && typeof s === "string" && s.length > 0;
        } catch (e) {
          return false;
        }
      });
      if (filtered.length > 0) {
        parts.push(
          filtered.join(",\n") +
            " {\n  display: none !important;\n  visibility: hidden !important;\n}"
        );
      }
    }

    const styleSelectors = resources.styleSelectors;
    if (styleSelectors && typeof styleSelectors === "object") {
      for (const [selector, styles] of Object.entries(styleSelectors)) {
        if (!selector || !styles) continue;
        const styleStr = Array.isArray(styles)
          ? styles.join("; ")
          : String(styles);
        if (styleStr) {
          parts.push(`${selector} { ${styleStr} }`);
        }
      }
    }

    return parts.join("\n");
  }

  buildCssFromSelectors(selectors) {
    if (!selectors || !Array.isArray(selectors) || selectors.length === 0) {
      return "";
    }
    return (
      selectors.join(",\n") +
      " {\n  display: none !important;\n  visibility: hidden !important;\n}"
    );
  }

  isEnabledForUrl(url) {
    if (!url) return true;
    try {
      return lazy.siteShieldSettings.isEnabledForUrl(url);
    } catch (e) {
      return true;
    }
  }

  clearCache() {
    this._resourceCache.clear();
  }
}

export const CosmeticFilterInjector = new _CosmeticFilterInjector();
export default CosmeticFilterInjector;
