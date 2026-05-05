/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. */

"use strict";

import { PREFS } from "resource:///modules/AdblockConfig.sys.mjs";

export class ShieldToggle {
  constructor() {
    this.enabled = true;
    this.initialized = false;
  }

  async init() {
    try {
      this.enabled = Services.prefs.getBoolPref(PREFS.ENABLED, true);
      Services.prefs.addObserver(PREFS.ENABLED, this);
      this.initialized = true;
    } catch (error) {
      console.error("[ShieldToggle] Failed to initialize:", error);
    }
  }

  /**
   * Called from UI when user clicks the shield toggle
   */
  async handleToggleClick(newState) {
    try {
      if (this.enabled === newState) return;
      this.enabled = newState;

      // THIS is the critical line — sets the pref that ShieldIntegration observes
      Services.prefs.setBoolPref(PREFS.ENABLED, newState);

      // Notify UI
      Services.obs.notifyObservers(
        null,
        "adblock-shield-status-changed",
        JSON.stringify({ type: "shield-toggle-changed", enabled: newState, timestamp: Date.now() })
      );

      console.log(`[ShieldToggle] Shield ${newState ? "enabled" : "disabled"}`);

      // Auto-refresh all tabs so blocking state takes effect immediately
      try {
        const { BrowserWindowTracker } = ChromeUtils.importESModule(
          "resource:///modules/BrowserWindowTracker.sys.mjs"
        );
        for (const win of BrowserWindowTracker.orderedWindows) {
          if (win.gBrowser) {
            for (const browser of win.gBrowser.browsers) {
              try { browser.reload(); } catch(e) {}
            }
          }
        }
      } catch(e) {}

      return true;
    } catch (error) {
      console.error("[ShieldToggle] Error handling toggle:", error);
      return false;
    }
  }

  observe(subject, topic, data) {
    if (topic === PREFS.ENABLED) {
      this.enabled = Services.prefs.getBoolPref(PREFS.ENABLED, true);
    }
  }

  async toggle() {
    return await this.handleToggleClick(!this.enabled);
  }

  getState() {
    return { enabled: this.enabled, timestamp: Date.now() };
  }

  QueryInterface = ChromeUtils.generateQI(["nsIObserver", "nsISupportsWeakReference"]);
}

export const shieldToggle = new ShieldToggle();
shieldToggle.init().catch(console.error);
export default shieldToggle;
