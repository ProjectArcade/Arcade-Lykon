/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { Preferences } from "chrome://global/content/preferences/Preferences.mjs";
import { SettingGroupManager } from "chrome://browser/content/preferences/config/SettingGroupManager.mjs";

const Services = globalThis.Services;

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
  { id: "datareporting.healthreport.uploadEnabled", type: "bool" },
  { id: "browser.discovery.enabled", type: "bool" },
  { id: "app.shield.optoutstudies.enabled", type: "bool" },
  { id: "nimbus.rollouts.enabled", type: "bool" },
  { id: "datareporting.usage.uploadEnabled", type: "bool" },
  { id: "browser.crashReports.unsubmittedCheck.autoSubmit2", type: "bool" },
]);

Preferences.addSetting({ id: "lykonShieldGlobalGroup" });
Preferences.addSetting({ id: "lykonShieldSettingsGroup" });
Preferences.addSetting({ id: "lykonTelemetryGroup" });
Preferences.addSetting({ id: "lykonDataCollectionGroup" });

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

Preferences.addSetting({
  id: "lykonDataCollectionLink",
  visible: () => {
    const url = Services.urlFormatter.formatURLPref(
      "toolkit.datacollection.infoURL"
    );
    return !!url;
  },
  getControlConfig(config) {
    const url = Services.urlFormatter.formatURLPref(
      "toolkit.datacollection.infoURL"
    );
    return {
      ...config,
      controlAttrs: {
        ...config.controlAttrs,
        href: url,
      },
    };
  },
});

Preferences.addSetting({
  id: "lykonSubmitHealthReport",
  pref: "datareporting.healthreport.uploadEnabled",
  getControlConfig(config, _, setting) {
    if (!setting.value) {
      return {
        ...config,
        l10nId: "lykon-data-collection-health-report-disabled",
      };
    }
    return {
      ...config,
      l10nId: "lykon-data-collection-health-report",
    };
  },
});

Preferences.addSetting({
  id: "lykonAddonRecommendation",
  pref: "browser.discovery.enabled",
  deps: ["lykonSubmitHealthReport"],
  get: (value, deps) => {
    return value && deps.lykonSubmitHealthReport.value;
  },
});

Preferences.addSetting({
  id: "lykonOptOutStudies",
  pref: "app.shield.optoutstudies.enabled",
  deps: ["lykonSubmitHealthReport"],
  disabled: ({ lykonSubmitHealthReport }) => {
    const allowedByPolicy = Services.policies.isAllowed("Shield");
    return !allowedByPolicy || !lykonSubmitHealthReport.value;
  },
  get: (value, { lykonSubmitHealthReport }) => {
    const allowedByPolicy = Services.policies.isAllowed("Shield");
    if (!allowedByPolicy || !lykonSubmitHealthReport.value) {
      return false;
    }
    return value;
  },
});

Preferences.addSetting({
  id: "lykonViewStudiesLink",
});

Preferences.addSetting({
  id: "lykonViewCrashesLink",
});

Preferences.addSetting({
  id: "lykonNimbusRollouts",
  pref: "nimbus.rollouts.enabled",
  disabled: () => !Services.policies.isAllowed("NimbusRollouts"),
  get: value => {
    if (!Services.policies.isAllowed("NimbusRollouts")) {
      return false;
    }
    return value;
  },
});

Preferences.addSetting({
  id: "lykonSubmitUsagePing",
  pref: "datareporting.usage.uploadEnabled",
});

Preferences.addSetting({
  id: "lykonAutomaticallySubmitCrashes",
  pref: "browser.crashReports.unsubmittedCheck.autoSubmit2",
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
        id: "lykonTelemetryCrashMode",
        control: "moz-radio-group",
        options: [
          { id: "telemetryAutoSend", value: 2, l10nId: "lykon-telemetry-option-auto" },
          { id: "telemetryAskEachTime", value: 1, l10nId: "lykon-telemetry-option-ask" },
          { id: "telemetryNoSend", value: 0, l10nId: "lykon-telemetry-option-none" },
        ],
      },
      {
        id: "lykonSubmitHealthReport",
        l10nId: "lykon-data-collection-health-report",
        control: "moz-toggle",
      },
    ],
  },
  lykonDataCollectionGroup: {
    l10nId: "lykon-data-collection-heading",
    iconSrc: "chrome://global/skin/icons/info.svg",
    headingLevel: 2,
    items: [
      {
        id: "lykonDataCollectionLink",
        control: "a",
        l10nId: "lykon-data-collection-link",
        slot: "support-link",
        controlAttrs: {
          id: "lykonDataCollectionPrivacyNoticeLink",
          target: "_blank",
        },
      },
      {
        id: "lykonAddonRecommendation",
        l10nId: "lykon-addon-recommendations",
        control: "moz-toggle",
      },
      {
        id: "lykonOptOutStudies",
        l10nId: "lykon-data-collection-run-studies",
        control: "moz-toggle",
        items: [
          {
            id: "lykonViewStudiesLink",
            control: "moz-box-link",
            l10nId: "lykon-data-collection-studies-link",
            controlAttrs: {
              href: "about:studies",
            },
          },
        ],
      },
      {
        id: "lykonNimbusRollouts",
        l10nId: "lykon-nimbus-rollouts",
        control: "moz-toggle",
      },
      {
        id: "lykonSubmitUsagePing",
        l10nId: "lykon-data-collection-usage-ping",
        control: "moz-toggle",
      },
      {
        id: "lykonAutomaticallySubmitCrashes",
        l10nId: "lykon-data-collection-backlogged-crash-reports",
        control: "moz-toggle",
        items: [
          {
            id: "lykonViewCrashesLink",
            control: "moz-box-link",
            l10nId: "lykon-data-collection-crashes-link",
            controlAttrs: {
              href: "about:crashes",
            },
          },
        ],
      },
    ],
  },
});
