#ifndef ADBLOCK_ENGINE_H
#define ADBLOCK_ENGINE_H

#include <string>

#ifdef __cplusplus
extern "C" {
#endif

__attribute__((visibility("default"))) void* adblock_engine_create();
__attribute__((visibility("default"))) void  adblock_engine_destroy(void* engine);
__attribute__((visibility("default"))) bool  adblock_engine_add_filter_list(void* engine, const char* rules);
__attribute__((visibility("default"))) bool  adblock_engine_check_network_url(void* engine, const char* url, const char* source, const char* type);

#ifdef __cplusplus
}
#endif

class AdblockFilterEngine {
public:
    AdblockFilterEngine();
    ~AdblockFilterEngine();
    bool addFilterList(const std::string& rules);
    bool shouldBlock(const std::string& url, const std::string& source, const std::string& type) const;
private:
    void* engine_;
};

#endif // ADBLOCK_ENGINE_H
