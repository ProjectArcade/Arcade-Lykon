/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_net_UrlClassifierCommon_h
#define mozilla_net_UrlClassifierCommon_h

#include "mozilla/Logging.h"
#include "nsString.h"

#include <vector>

class nsIChannel;
class nsIURI;

#define UC_LOG(args) MOZ_LOG(UrlClassifierCommon::sLog, LogLevel::Info, args)
#define UC_LOG_DEBUG(args) \
  MOZ_LOG(UrlClassifierCommon::sLog, LogLevel::Debug, args)
#define UC_LOG_WARN(args) \
  MOZ_LOG(UrlClassifierCommon::sLog, LogLevel::Warning, args)
#define UC_LOG_LEAK(args) \
  MOZ_LOG(UrlClassifierCommon::sLogLeak, LogLevel::Info, args)

#define UC_LOG_ENABLED()                                     \
  MOZ_LOG_TEST(UrlClassifierCommon::sLog, LogLevel::Info) || \
      MOZ_LOG_TEST(UrlClassifierCommon::sLogLeak, LogLevel::Info)

namespace mozilla {
namespace net {

enum class ChannelBlockDecision;

class UrlClassifierCommon final {
 public:
  static const nsCString::size_type sMaxSpecLength;

  static LazyLogModule sLog;
  static LazyLogModule sLogLeak;

  static bool AddonMayLoad(nsIChannel* aChannel, nsIURI* aURI);

  static bool ShouldEnableProtectionForChannel(nsIChannel* aChannel);

  static nsresult SetBlockedContent(nsIChannel* channel, nsresult aErrorCode,
                                    const nsACString& aList,
                                    const nsACString& aProvider,
                                    const nsACString& aFullHash);

  static bool IsClassifierBlockingErrorCode(nsresult aError);

  static bool IsClassifierBlockingEventCode(uint32_t aEventCode);

  static uint32_t GetClassifierBlockingEventCode(nsresult aErrorCode);

  static const char* ClassifierBlockingErrorCodeToConsoleMessage(
      nsresult aError, nsACString& aCategory);

  static nsresult MaybeBlockChannel(
      nsIChannel* aChannel, const nsACString& aFeatureName,
      const nsACString& aList, nsresult aErrorCode, uint32_t aReplacedEvent,
      uint32_t aAllowedEvent, ChannelBlockDecision* aOutDecision);

  static nsresult SetTrackingInfo(nsIChannel* channel,
                                  const nsTArray<nsCString>& aLists,
                                  const nsTArray<nsCString>& aFullHashes);

  // Use this function only when you are looking for a pairwise entitylist uri
  // with the format: http://toplevel.page/?resource=channel.uri.domain
  static nsresult CreatePairwiseEntityListURI(nsIChannel* aChannel,
                                              nsIURI** aURI);

  static void AnnotateChannel(nsIChannel* aChannel,
                              uint32_t aClassificationFlags,
                              uint32_t aLoadingState);

  static void AnnotateChannelWithoutNotifying(nsIChannel* aChannel,
                                              uint32_t aClassificationFlags);

  static bool IsAllowListed(nsIChannel* aChannel);

  static bool IsTrackingClassificationFlag(uint32_t aFlag, bool aIsPrivate);

  static bool IsSocialTrackingClassificationFlag(uint32_t aFlag);

  static bool IsCryptominingClassificationFlag(uint32_t aFlag, bool aIsPrivate);

  // Join the table names in 1 single string.
  static void TablesToString(const nsTArray<nsCString>& aList,
                             nsACString& aString);

  struct ClassificationData {
    nsCString mPrefix;
    uint32_t mFlag;
  };

  // Checks if the entries in aList are part of the ClassificationData vector
  // and it returns the corresponding flags. If none of them is found, the
  // default flag is returned.
  static uint32_t TablesToClassificationFlags(
      const nsTArray<nsCString>& aList,
      const std::vector<ClassificationData>& aData, uint32_t aDefaultFlag);

  static bool IsPassiveContent(nsIChannel* aChannel);

  static void SetClassificationFlagsHelper(nsIChannel* aChannel,
                                           uint32_t aClassificationFlags,
                                           bool aIsThirdParty);
  static nsresult GetTopWindowURI(nsIChannel* aChannel, nsIURI** aURI);

  static bool ShouldProcessWithProtectionFeature(nsIChannel* aChannel);

 private:
  static uint32_t TableToClassificationFlag(
      const nsACString& aTable, const std::vector<ClassificationData>& aData);
};

}  // namespace net
}  // namespace mozilla

#endif  // mozilla_net_UrlClassifierCommon_h
