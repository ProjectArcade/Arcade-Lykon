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
  { id: "lykon.shield.fingerprinting.blocked", type: "string" },
  { id: "lykon.shield.fingerprint.enabled", type: "bool" },
  { id: "lykon.shield.forget.onexit", type: "bool" },
  { id: "lykon.telemetry.crash_report_mode", type: "int" },
  { id: "datareporting.healthreport.uploadEnabled", type: "bool" },
  { id: "browser.discovery.enabled", type: "bool" },
  { id: "app.shield.optoutstudies.enabled", type: "bool" },
  { id: "nimbus.rollouts.enabled", type: "bool" },
  { id: "datareporting.usage.uploadEnabled", type: "bool" },
  { id: "browser.crashReports.unsubmittedCheck.autoSubmit2", type: "bool" },
  { id: "lykon.shield.contact_info.store", type: "bool" },
  { id: "lykon.shield.block_element.private", type: "bool" },
  { id: "lykon.shield.custom_filters.enabled", type: "bool" },
  { id: "lykon.shield.adblock_only_mode", type: "bool" },
  { id: "lykon.shield.social.facebook", type: "bool" },
  { id: "lykon.shield.social.twitter", type: "bool" },
  { id: "lykon.shield.social.linkedin", type: "bool" },
]);

Preferences.addSetting({ id: "lykonShieldGlobalGroup" });
Preferences.addSetting({ id: "lykonShieldSettingsGroup" });
Preferences.addSetting({ id: "lykonShieldPrivacyGroup" });
Preferences.addSetting({ id: "lykonShieldContentGroup" });
Preferences.addSetting({ id: "lykonShieldSocialGroup" });
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
  id: "lykonShieldTrackerMode",
  pref: "lykon.shield.tracker.mode",
  getControlConfig(config) {
    return {
      ...config,
      options: [
        { value: "aggressive", controlAttrs: { label: "Aggressive" } },
        { value: "standard", controlAttrs: { label: "Standard" } },
        { value: "disabled", controlAttrs: { label: "Disabled" } },
      ],
    };
  },
});

Preferences.addSetting({
  id: "lykonShieldHttpsMode",
  pref: "lykon.shield.https.mode",
  getControlConfig(config) {
    return {
      ...config,
      options: [
        { value: "strict", controlAttrs: { label: "Strict" } },
        { value: "soft", controlAttrs: { label: "Standard" } },
        { value: "disabled", controlAttrs: { label: "Disabled" } },
      ],
    };
  },
});

Preferences.addSetting({
  id: "lykonShieldFingerprinting",
  pref: "lykon.shield.fingerprinting.blocked",
  getControlConfig(config) {
    return {
      ...config,
      options: [
        { value: "aggressive", controlAttrs: { label: "Aggressive/Strict" } },
        { value: "standard", controlAttrs: { label: "Standard" } },
        { value: "disabled", controlAttrs: { label: "Disabled" } },
      ],
    };
  },
});

Preferences.addSetting({
  id: "lykonShieldCookieMode",
  pref: "lykon.shield.cookie.mode",
  getControlConfig(config) {
    return {
      ...config,
      options: [
        {
          value: "cross-site",
          controlAttrs: { label: "Only cross-site trackers" },
        },
        { value: "all", controlAttrs: { label: "All cookies" } },
        { value: "disabled", controlAttrs: { label: "Disabled" } },
      ],
    };
  },
});

Preferences.addSetting({
  id: "lykonShieldForgetOnExit",
  pref: "lykon.shield.forget.onexit",
});

Preferences.addSetting({
  id: "lykonShieldContactInfoStore",
  pref: "lykon.shield.contact_info.store",
});

Preferences.addSetting({
  id: "lykonShieldBlockElementPrivate",
  pref: "lykon.shield.block_element.private",
});

Preferences.addSetting({
  id: "lykonShieldCustomFiltersEnabled",
  pref: "lykon.shield.custom_filters.enabled",
});

Preferences.addSetting({
  id: "lykonShieldAdblockOnlyMode",
  pref: "lykon.shield.adblock_only_mode",
});

Preferences.addSetting({
  id: "lykonShieldSocialFacebook",
  pref: "lykon.shield.social.facebook",
});

Preferences.addSetting({
  id: "lykonShieldSocialTwitter",
  pref: "lykon.shield.social.twitter",
});

Preferences.addSetting({
  id: "lykonShieldSocialLinkedIn",
  pref: "lykon.shield.social.linkedin",
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
    label: "Default Protection Settings",
    iconSrc: "chrome://global/skin/icons/settings.svg",
    headingLevel: 2,
    items: [
      {
        id: "lykonShieldTrackerMode",
        label: "Trackers & ads blocking",
        control: "moz-select",
      },
      {
        id: "lykonShieldHttpsMode",
        label: "Upgrade connections to HTTPS",
        control: "moz-select",
      },
      {
        id: "lykonShieldFingerprinting",
        label: "Block fingerprinting",
        control: "moz-select",
      },
      {
        id: "lykonShieldCookieMode",
        label: "Block cookies",
        control: "moz-select",
      },
      {
        id: "lykonShieldScripts",
        label: "Block scripts",
        control: "moz-toggle",
      },
      {
        id: "adblockStats",
        label: "Show the number of blocked items on the Shields icon",
        control: "moz-toggle",
      },
    ],
  },
  lykonShieldPrivacyGroup: {
    label: "Privacy & Data Protection",
    iconSrc: "chrome://global/skin/icons/security.svg",
    headingLevel: 2,
    items: [
      {
        id: "lykonShieldForgetOnExit",
        label: "Forget me when I close this site",
        control: "moz-toggle",
      },
      {
        id: "lykonShieldContactInfoStore",
        label: "Store contact information for future broken site reports",
        control: "moz-toggle",
      },
      {
        id: "lykonShieldBlockElementPrivate",
        label: "Allow element blocking in private windows",
        control: "moz-toggle",
      },
    ],
  },
  lykonShieldContentGroup: {
    label: "Content Filtering",
    iconSrc: "chrome://global/skin/icons/info.svg",
    headingLevel: 2,
    items: [
      {
        id: "lykonShieldCustomFiltersEnabled",
        label: "Enable custom filters for regional & language trackers",
        control: "moz-toggle",
      },
      {
        id: "lykonShieldAdblockOnlyMode",
        label: "Use Adblock-Only mode",
        control: "moz-toggle",
      },
    ],
  },
  lykonShieldSocialGroup: {
    label: "Social Media Blocking",
    iconSrc: "chrome://browser/skin/tracking-protection.svg",
    headingLevel: 2,
    items: [
      {
        id: "lykonShieldSocialFacebook",
        label: "Allow Facebook logins and embedded posts",
        control: "moz-toggle",
      },
      {
        id: "lykonShieldSocialTwitter",
        label: "Allow X (previously Twitter) embedded tweets",
        control: "moz-toggle",
      },
      {
        id: "lykonShieldSocialLinkedIn",
        label: "Allow LinkedIn embedded posts",
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
