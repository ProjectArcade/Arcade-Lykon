#ifndef ADBLOCK_ENGINE_H
#define ADBLOCK_ENGINE_H

#include <string>
#include <memory>
#include "libadblock.h"

/**
 * C++ wrapper for the adblock engine FFI
 */
class AdblockFilterEngine {
public:
    /**
     * Create a new adblock engine
     */
    AdblockFilterEngine();

    /**
     * Destructor - cleans up the engine
     */
    ~AdblockFilterEngine();

    // Prevent copying
    AdblockFilterEngine(const AdblockFilterEngine&) = delete;
    AdblockFilterEngine& operator=(const AdblockFilterEngine&) = delete;

    /**
     * Add filter rules to the engine
     * @param rules Filter rules as a string (supports multiple formats: EasyList, EasyPrivacy, etc.)
     * @return true if successful, false otherwise
     */
    bool addFilterList(const std::string& rules);

    /**
     * Check if a URL should be blocked
     * @param url The URL to check
     * @param sourceUrl The source/referrer URL (optional)
     * @param resourceType The resource type (e.g., "script", "image", "document", "xmlhttprequest")
     * @return true if the URL should be blocked, false if it should be allowed
     */
    bool shouldBlock(const std::string& url, const std::string& sourceUrl = "",
                     const std::string& resourceType = "other") const;

    /**
     * Check if engine is valid
     */
    bool isValid() const { return engine_ != nullptr; }

private:
    AdblockEngine engine_;
};

#endif // ADBLOCK_ENGINE_H
