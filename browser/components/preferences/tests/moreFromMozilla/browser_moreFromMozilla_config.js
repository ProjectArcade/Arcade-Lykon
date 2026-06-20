/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

let mockFxA, unmockFxA;

add_setup(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.settings-redesign.enabled", true]],
  });
  let { mock, unmock } = await mockDefaultFxAInstance();
  mockFxA = mock;
  unmockFxA = unmock;
});

add_task(async function test_config_renders_with_expected_cards() {
  await clearPolicies();
  let {
    grid,
    mobilePromo,
    monitorPromoCard,
    vpnPromoCard,
    relayPromoCard,
    mdnCard,
    soloCard,
    thunderbirdCard,
    newProductsCard,
  } = await getPromoCardsSRD();

  ok(grid, "The products-grid container exists");

  ok(mobilePromo, "Firefox Mobile moz-promo is present");
  ok(
    mobilePromo.imageSrc.includes("more-from-mozilla-qr-code"),
    "QR code image src is set on the moz-promo"
  );

  ok(monitorPromoCard, "Mozilla Monitor card is present");
  is(
    monitorPromoCard.localName,
    "moz-card",
    "Monitor card is a moz-card element"
  );
  ok(
    monitorPromoCard.querySelector("moz-box-link"),
    "Monitor card contains a moz-box-link"
  );

  ok(vpnPromoCard, "VPN card is present");
  ok(relayPromoCard, "Relay card is present");
  ok(mdnCard, "MDN card is present");
  ok(soloCard, "Solo card is present");
  ok(thunderbirdCard, "Thunderbird card is present");
  ok(newProductsCard, "Mozilla New Products card is present");

  BrowserTestUtils.removeTab(gBrowser.selectedTab);
});

add_task(async function test_vpn_hidden_when_disabled() {
  await clearPolicies();
  await SpecialPowers.pushPrefEnv({
    set: [["browser.vpn_promo.enabled", false]],
  });

  let { vpnPromoCard, monitorPromoCard } = await getPromoCardsSRD();
  ok(!vpnPromoCard, "The VPN promo card is not visible");
  ok(monitorPromoCard, "The Monitor card is visible");

  Services.prefs.clearUserPref("browser.vpn_promo.enabled");
  BrowserTestUtils.removeTab(gBrowser.selectedTab);
});

add_task(async function test_vpn_hidden_in_disallowed_region() {
  await clearPolicies();
  setupRegions("SY");

  await SpecialPowers.pushPrefEnv({
    set: [["browser.vpn_promo.enabled", true]],
  });

  let { vpnPromoCard, monitorPromoCard } = await getPromoCardsSRD();
  ok(!vpnPromoCard, "VPN promo is hidden in disallowed region");
  ok(monitorPromoCard, "The Monitor card is visible");

  setupRegions(initialHomeRegion, initialCurrentRegion);
  BrowserTestUtils.removeTab(gBrowser.selectedTab);
});

add_task(async function test_relay_hidden_with_custom_fxa() {
  await clearPolicies();
  unmockFxA();

  let { relayPromoCard } = await getPromoCardsSRD();
  ok(!relayPromoCard, "The Relay promo card is not visible");

  BrowserTestUtils.removeTab(gBrowser.selectedTab);
  mockFxA();
});

add_task(async function test_box_link_has_correct_utm_params() {
  await clearPolicies();
  let { monitorPromoCard } = await getPromoCardsSRD();

  let boxLink = monitorPromoCard.querySelector("moz-box-link");
  ok(boxLink, "Monitor card has a moz-box-link");

  let href = boxLink.href;
  ok(href, "Box link has an href");
  let url = new URL(href);
  Assert.ok(
    url.href.startsWith("https://monitor.mozilla.org/"),
    "Correct base URL"
  );
  Assert.equal(
    url.searchParams.get("utm_source"),
    "about-prefs",
    "utm_source is set"
  );
  Assert.equal(
    url.searchParams.get("utm_campaign"),
    "morefrommozilla",
    "utm_campaign is set"
  );
  Assert.equal(
    url.searchParams.get("utm_medium"),
    "firefox-desktop",
    "utm_medium is set"
  );

  BrowserTestUtils.removeTab(gBrowser.selectedTab);
});
