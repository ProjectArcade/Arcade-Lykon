import { AdblockService } from "resource:///modules/AdblockService.sys.mjs";

export class LykonShieldParent extends JSWindowActorParent {
  receiveMessage(message) {
    switch (message.name) {
      case "getCosmeticResources":
        return AdblockService.getCosmeticResources(message.data.url);
      case "getHiddenClassIdSelectors":
        return AdblockService.getHiddenClassIdSelectors(
          message.data.classes,
          message.data.ids,
          message.data.exceptions
        );
    }
    return null;
  }
}
