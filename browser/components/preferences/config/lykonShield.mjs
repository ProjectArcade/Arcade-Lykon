/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { Preferences } from "chrome://global/content/preferences/Preferences.mjs";
import { SettingGroupManager } from "chrome://browser/content/preferences/config/SettingGroupManager.mjs";

Preferences.addAll([
  { id: "browser.adblock.enabled", type: "bool" },
  { id: "browser.adblock.stats", type: "bool" },
  { id: "browser.adblock.debug", type: "bool" },
  { id: "lykon.shield.tracker.mode", type: "string" },
  { id: "lykon.shield.https.mode", type: "string" },
  { id: "lykon.shield.cookie.mode", type: "string" },
  { id: "lykon.shield.scripts.blocked", type: "bool" },
  { id: "lykon.shield.fingerprinting.blocked", type: "bool" },
  { id: "lykon.shield.forget.onexit", type: "bool" },
  { id: "lykon.telemetry.crash_report_mode", type: "int" },
]);

Preferences.addSetting({ id: "lykonShieldGlobalGroup" });
Preferences.addSetting({ id: "lykonShieldSettingsGroup" });
Preferences.addSetting({ id: "lykonTelemetryGroup" });
Preferences.addSetting({ id: "lykonTelemetryDescription" });

Preferences.addSetting({
  id: "adblockEnabled",
  pref: "browser.adblock.enabled",
});

Preferences.addSetting({
  id: "adblockStats",
  pref: "browser.adblock.stats",
});

Preferences.addSetting({
  id: "lykonShieldScripts",
  pref: "lykon.shield.scripts.blocked",
});

Preferences.addSetting({
  id: "lykonShieldFingerprinting",
  pref: "lykon.shield.fingerprinting.blocked",
});

Preferences.addSetting({
  id: "lykonShieldForgetOnExit",
  pref: "lykon.shield.forget.onexit",
});

Preferences.addSetting({
  id: "lykonTelemetryCrashMode",
  pref: "lykon.telemetry.crash_report_mode",
});

SettingGroupManager.registerGroups({
  lykonShieldSettingsGroup: {
    l10nId: "lykon-shield-features-heading",
    iconSrc: "chrome://browser/skin/preferences/category-privacy-security.svg",
    headingLevel: 2,
    items: [
      {
        id: "adblockEnabled",
        l10nId: "lykon-shield-enable-label",
        control: "moz-toggle",
      },
      {
        id: "adblockStats",
        l10nId: "lykon-shield-stats-label",
        control: "moz-toggle",
      },
      {
        id: "lykonShieldScripts",
        l10nId: "lykon-shield-scripts-label",
        control: "moz-toggle",
      },
      {
        id: "lykonShieldFingerprinting",
        l10nId: "lykon-shield-fingerprinting-label",
        control: "moz-toggle",
      },
      {
        id: "lykonShieldForgetOnExit",
        l10nId: "lykon-shield-forget-label",
        control: "moz-toggle",
      },
    ],
  },
  lykonTelemetryGroup: {
    l10nId: "lykon-telemetry-heading",
    iconSrc: "chrome://global/skin/icons/info.svg",
    headingLevel: 2,
    items: [
      {
        id: "lykonTelemetryDescription",
        control: "moz-fieldset",
        l10nId: "lykon-telemetry-desc",
        items: [
          {
            id: "lykonTelemetryCrashMode",
            control: "moz-radio-group",
            options: [
              {
                id: "telemetryAutoSend",
                value: 2,
                l10nId: "lykon-telemetry-option-auto",
              },
              {
                id: "telemetryAskEachTime",
                value: 1,
                l10nId: "lykon-telemetry-option-ask",
              },
              {
                id: "telemetryNoSend",
                value: 0,
                l10nId: "lykon-telemetry-option-none",
              },
            ],
          },
        ],
      },
    ],
  },
});
