import { JSWindowActorChild } from "resource://gre/modules/JSWindowActorChild.sys.mjs";

export class LykonShieldChild extends JSWindowActorChild {
  constructor() {
    super();
    this._initialized = false;
  }

  handleEvent(event) {
    if (event.type === "DOMDocElementInserted") {
      this.init();
    }
  }

  init() {
    if (this._initialized) return;
    this._initialized = true;

    const url = this.document.location.href;

    // 1. YouTube Specific Injections
    if (url.includes("youtube.com")) {
      this.injectYouTubeShield();
    }

    // 2. Global Cosmetic Observer
    this.startCosmeticObserver();
  }

  injectYouTubeShield() {
    // Overwrite JSON.parse to intercept and strip ads from player response
    const script = this.document.createElement("script");
    script.textContent = `
      (function() {
        const originalParse = JSON.parse;
        JSON.parse = function() {
          const result = originalParse.apply(this, arguments);
          if (result && result.adPlacements) {
            delete result.adPlacements;
          }
          if (result && result.playerAds) {
            delete result.playerAds;
          }
          return result;
        };
        console.log("[LykonShield] YouTube Ad-stripping active");
      })();
    `;
    this.document.documentElement.appendChild(script);
    script.remove();
  }

  startCosmeticObserver() {
    const observer = new MutationObserver(() => {
      this.applyCosmeticRules();
    });
    observer.observe(this.document.documentElement, {
      childList: true,
      subtree: true
    });
    this.applyCosmeticRules();
  }

  applyCosmeticRules() {
    // Aggressive News & Ad selectors
    const selectors = [
      ".ad-unit", ".ad-container", ".ad-slot", "[class*='ad-slot']",
      "[id*='ad-container']", ".sponsored-post", ".trc_rbox",
      "#dfp-ad-top", ".video-ads", ".ytp-ad-module",
      ".aljazeera-ad", ".adsbygoogle", ".ad-wrapper",
      ".ads", ".ads__slot", "[class*='adslot']", "[id*='adslot']",
      "[class*='ad_slot']", "[id*='ad_slot']", "[class*='ads__']",
      "iframe[id*='google_ads_iframe']", "iframe[id*='ad-slot']"
    ];

    for (const selector of selectors) {
      const elements = this.document.querySelectorAll(selector);
      for (const el of elements) {
        el.style.setProperty("display", "none", "important");
      }
    }
  }
}
