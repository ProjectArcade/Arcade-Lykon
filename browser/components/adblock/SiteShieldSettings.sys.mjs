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

  isEnabledForSite(hostname) {
    this._ensureLoaded();
    const site = this._getETLD1(hostname);
    if (!site) return true;
    return !this._disabledSites.has(site);
  }

  setEnabledForSite(hostname, enabled) {
    this._ensureLoaded();
    const site = this._getETLD1(hostname);
    if (!site) return;
    if (enabled) {
      this._disabledSites.delete(site);
    } else {
      this._disabledSites.add(site);
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
