import { AdblockService } from "resource:///modules/AdblockService.sys.mjs";

export class LykonShieldParent extends JSWindowActorParent {
  receiveMessage(message) {
    switch (message.name) {
      case "isSystemDarkTheme":
        try {
          const contentOverride = Services.prefs.getIntPref(
            "layout.css.prefers-color-scheme.content-override",
            2
          );
          if (contentOverride === 0) {
            return true;
          }
          if (contentOverride === 1) {
            return false;
          }
          return Services.appinfo.contentThemeDerivedColorSchemeIsDark;
        } catch (e) {
          return false;
        }
      case "getCosmeticResources":
        return AdblockService.getCosmeticResources(message.data.url);
      case "getHiddenClassIdSelectors":
        return AdblockService.getHiddenClassIdSelectors(
          message.data.classes,
          message.data.ids,
          message.data.exceptions
        );
      case "isShieldEnabled":
        try {
          const { siteShieldSettings } = ChromeUtils.importESModule(
            "resource:///modules/SiteShieldSettings.sys.mjs"
          );
          let host = null;
          try {
            host = this.browsingContext.top.currentURI?.host;
          } catch (e) {}
          if (!host) {
            try {
              host =
                this.browsingContext.top.topWindowContext?.documentURI?.host;
            } catch (e) {}
          }
          if (!host) {
            try {
              host = new URL(message.data.url).hostname;
            } catch (e) {}
          }
          return siteShieldSettings.isEnabledForSite(host);
        } catch (e) {
          return true;
        }
    }
    return null;
  }
}
