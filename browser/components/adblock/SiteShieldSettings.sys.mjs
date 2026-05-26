/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. */

"use strict";

const PREF_KEY = "lykon.shield.site.settings";

class _SiteShieldSettings {
  constructor() {
    this._disabledSites = new Set();
    this._loaded = false;
    Services.prefs.addObserver(PREF_KEY, () => {
      this._loaded = false;
    });
  }

  _ensureLoaded() {
    if (this._loaded) return;
    try {
      const json = Services.prefs.getStringPref(PREF_KEY, "[]");
      const arr = JSON.parse(json);
      this._disabledSites = new Set(arr);
    } catch (e) {
      this._disabledSites = new Set();
    }
    this._loaded = true;
  }

  _persist() {
    try {
      const arr = Array.from(this._disabledSites);
      Services.prefs.setStringPref(PREF_KEY, JSON.stringify(arr));
    } catch (e) {
      console.error("[SiteShieldSettings] persist error:", e);
    }
  }

  _getETLD1(hostname) {
    if (!hostname) return null;
    try {
      return Services.eTLD.getBaseDomainFromHost(hostname);
    } catch (e) {
      return hostname;
    }
  }

  _normalizeUrlRule(url) {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return null;
      }
      return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${
        parsed.pathname || "/"
      }${parsed.search || ""}`;
    } catch (e) {
      return null;
    }
  }

  _normalizeUrlRuleNoScheme(url) {
    const normalized = this._normalizeUrlRule(url);
    if (!normalized) return null;
    try {
      const parsed = new URL(normalized);
      return `${parsed.hostname}${parsed.pathname || "/"}${parsed.search || ""}`;
    } catch (e) {
      return null;
    }
  }

  _isUrlRule(value) {
    return /^https?:\/\//i.test(value);
  }

  isEnabledForSite(hostname) {
    this._ensureLoaded();
    if (!hostname) return true;

    // Check exact hostname match
    if (this._disabledSites.has(hostname)) {
      return false;
    }

    // Check base domain match
    const site = this._getETLD1(hostname);
    if (site && this._disabledSites.has(site)) {
      return false;
    }

    // Check wildcard matches (e.g. *.indiatimes.com matches timesofindia.indiatimes.com)
    for (const pattern of this._disabledSites) {
      if (pattern.startsWith("*.")) {
        const suffix = pattern.substring(2);
        if (hostname === suffix || hostname.endsWith("." + suffix)) {
          return false;
        }
      }
    }

    return true;
  }

  isEnabledForUrl(url) {
    this._ensureLoaded();

    const normalizedNoScheme = this._normalizeUrlRuleNoScheme(url);
    if (normalizedNoScheme) {
      for (const rule of this._disabledSites) {
        if (!this._isUrlRule(rule)) {
          continue;
        }
        if (this._normalizeUrlRuleNoScheme(rule) === normalizedNoScheme) {
          return false;
        }
      }
    }

    try {
      const host = new URL(url).hostname;
      return this.isEnabledForSite(host);
    } catch (e) {
      return true;
    }
  }

  setEnabledForSite(hostname, enabled) {
    this._ensureLoaded();
    if (!hostname) return;

    // URL-specific exception entry, e.g. https://example.com/path
    const normalizedUrlRule = this._normalizeUrlRule(hostname);
    if (normalizedUrlRule) {
      if (enabled) {
        this._disabledSites.delete(normalizedUrlRule);
      } else {
        this._disabledSites.add(normalizedUrlRule);
      }
      this._persist();
      return;
    }

    if (enabled) {
      this._disabledSites.delete(hostname);
      // Clean up both exact and possible base/wildcard matches
      const site = this._getETLD1(hostname);
      if (site) {
        this._disabledSites.delete(site);
        this._disabledSites.delete("*." + site);
      }
    } else {
      this._disabledSites.add(hostname);
    }
    this._persist();
  }

  getDisabledSites() {
    this._ensureLoaded();
    return Array.from(this._disabledSites);
  }

  resetSite(hostname) {
    this.setEnabledForSite(hostname, true);
  }

  resetAll() {
    this._disabledSites.clear();
    this._persist();
  }
}

export const siteShieldSettings = new _SiteShieldSettings();
export default siteShieldSettings;
