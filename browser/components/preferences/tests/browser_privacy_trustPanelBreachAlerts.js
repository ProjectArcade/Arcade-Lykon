/* Any copyright is dedicated to the Public Domain.
 * https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const FEATURE_GATE_PREF = "browser.urlbar.trustPanel.featureGate";
const BREACH_ALERTS_PREF = "browser.urlbar.trustPanel.breachAlerts";

const GROUP_SELECTOR = 'setting-group[groupid="privacyPanel"]';
const CHECKBOX_ID = "trustPanelBreachAlertsMain";

add_task(async function test_pref_mapping() {
  await BrowserTestUtils.withNewTab(
    { gBrowser, url: "about:preferences#privacy-connectionSecurity" },
    async function (browser) {
      let doc = browser.contentDocument;
      let win = browser.contentWindow;
      let checkbox = doc.getElementById(CHECKBOX_ID);
      info("CHECKBOX_ID element info:");
      if (checkbox) {
        info("  Name: " + checkbox.localName);
        info("  ID: " + checkbox.id);
        info("  OuterHTML: " + checkbox.outerHTML.substring(0, 500));
      } else {
        info("  NOT FOUND");
      }
      let setting = win.Preferences.getSetting(CHECKBOX_ID);
      ok(setting, "Setting should exist");
      if (setting) {
        is(
          setting.pref.id,
          BREACH_ALERTS_PREF,
          "Pref mapping should be correct"
        );
      }
    }
  );
});

// Test the section is hidden when the feature gate is disabled.
add_task(async function test_section_hidden_when_feature_gate_disabled() {
  await SpecialPowers.pushPrefEnv({
    set: [[FEATURE_GATE_PREF, false]],
  });

  await BrowserTestUtils.withNewTab(
    { gBrowser, url: "about:preferences#privacy-connectionSecurity" },
    async function (browser) {
      let doc = browser.contentDocument;
      await BrowserTestUtils.waitForCondition(
        () => doc.querySelector(GROUP_SELECTOR),
        "Wait for setting group"
      );
      let settingGroup = doc.querySelector(GROUP_SELECTOR);

      // The visibility logic is asynchronous for Lit-based setting groups.
      await BrowserTestUtils.waitForCondition(
        () => BrowserTestUtils.isHidden(settingGroup),
        "Wait for setting group to be hidden"
      );

      let checkbox = doc.getElementById(CHECKBOX_ID);
      ok(checkbox, "The checkbox should still exist in the DOM");
      is_element_hidden(
        checkbox,
        "The checkbox should be hidden when featureGate is false"
      );
    }
  );

  await SpecialPowers.popPrefEnv();
});

// Test the section is shown when the feature gate is enabled.
add_task(async function test_section_shown_when_feature_gate_enabled() {
  await SpecialPowers.pushPrefEnv({
    set: [[FEATURE_GATE_PREF, true]],
  });

  await BrowserTestUtils.withNewTab(
    { gBrowser, url: "about:preferences#privacy-connectionSecurity" },
    async function (browser) {
      let doc = browser.contentDocument;
      await BrowserTestUtils.waitForCondition(
        () => doc.querySelector(GROUP_SELECTOR),
        "Wait for setting group"
      );
      let settingGroup = doc.querySelector(GROUP_SELECTOR);

      await BrowserTestUtils.waitForCondition(
        () => BrowserTestUtils.isVisible(settingGroup),
        "Wait for setting group to be visible"
      );
      is_element_visible(
        settingGroup,
        "Privacy panel setting group is visible when featureGate is true"
      );

      let checkbox = doc.getElementById(CHECKBOX_ID);
      is_element_visible(
        checkbox,
        "The checkbox should be visible when featureGate is true"
      );
    }
  );

  await SpecialPowers.popPrefEnv();
});

// Test that toggling the checkbox updates the preference.
add_task(async function test_checkbox_toggle_updates_pref() {
  await SpecialPowers.pushPrefEnv({
    set: [
      [FEATURE_GATE_PREF, true],
      [BREACH_ALERTS_PREF, true],
    ],
  });

  await BrowserTestUtils.withNewTab(
    { gBrowser, url: "about:preferences#privacy-connectionSecurity" },
    async function (browser) {
      await SpecialPowers.spawn(
        browser,
        [CHECKBOX_ID, BREACH_ALERTS_PREF],
        async (checkboxId, breachAlertsPref) => {
          let checkbox = content.document.getElementById(checkboxId);
          ok(checkbox, "Checkbox should exist");
          ok(checkbox.checked, "The checkbox should be checked initially");

          checkbox.click();

          await ContentTaskUtils.waitForCondition(
            () => !checkbox.checked,
            "The checkbox should be unchecked after click"
          );
          is(
            Services.prefs.getBoolPref(breachAlertsPref),
            false,
            "Preference should be updated to false"
          );

          checkbox.click();

          await ContentTaskUtils.waitForCondition(
            () => checkbox.checked,
            "The checkbox should be checked after second click"
          );
          is(
            Services.prefs.getBoolPref(breachAlertsPref),
            true,
            "Preference should be updated back to true"
          );
        }
      );
    }
  );

  await SpecialPowers.popPrefEnv();
});

// Test that the checkbox reflects the preference state on load.
add_task(async function test_checkbox_reflects_pref() {
  for (let state of [true, false]) {
    await SpecialPowers.pushPrefEnv({
      set: [
        [FEATURE_GATE_PREF, true],
        [BREACH_ALERTS_PREF, state],
      ],
    });

    await BrowserTestUtils.withNewTab(
      { gBrowser, url: "about:preferences#privacy-connectionSecurity" },
      async function (browser) {
        let doc = browser.contentDocument;
        await BrowserTestUtils.waitForCondition(
          () => doc.getElementById(CHECKBOX_ID),
          "Wait for checkbox"
        );
        let checkbox = doc.getElementById(CHECKBOX_ID);
        is(
          checkbox.checked,
          state,
          `The checkbox state should reflect the preference: ${state}`
        );
      }
    );

    await SpecialPowers.popPrefEnv();
  }
});
