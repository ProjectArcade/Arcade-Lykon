#include "AdblockEngine.h"
#include <cstring>

AdblockFilterEngine::AdblockFilterEngine() {
    engine_ = adblock_engine_create();
}

AdblockFilterEngine::~AdblockFilterEngine() {
    if (engine_) {
        adblock_engine_destroy(engine_);
        engine_ = nullptr;
    }
}

bool AdblockFilterEngine::addFilterList(const std::string& rules) {
    if (!engine_) {
        return false;
    }
    return adblock_engine_add_filter_list(engine_, rules.c_str());
}

bool AdblockFilterEngine::shouldBlock(const std::string& url,
                                       const std::string& sourceUrl,
                                       const std::string& resourceType) const {
    if (!engine_) {
        return false;
    }
    return adblock_engine_check_network_url(
        engine_,
        url.c_str(),
        sourceUrl.empty() ? nullptr : sourceUrl.c_str(),
        resourceType.c_str()
    );
}
