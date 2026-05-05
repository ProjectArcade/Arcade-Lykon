#ifndef LIBADBLOCK_H
#define LIBADBLOCK_H

#ifdef __cplusplus
extern "C" {
#endif

#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>

/**
 * Opaque pointer to the adblock engine
 */
typedef void* AdblockEngine;

/**
 * Create a new adblock engine instance
 * @return Pointer to the engine, must be freed with adblock_engine_destroy()
 */
AdblockEngine adblock_engine_create(void);

/**
 * Destroy an adblock engine instance
 * @param engine Pointer to the engine created with adblock_engine_create()
 */
void adblock_engine_destroy(AdblockEngine engine);

/**
 * Add a filter list to the engine
 * @param engine Pointer to the engine
 * @param rules Filter rules as a null-terminated UTF-8 string
 * @return true if the operation succeeded, false otherwise
 */
bool adblock_engine_add_filter_list(AdblockEngine engine, const char* rules);

/**
 * Check if a network request should be blocked
 * @param engine Pointer to the engine
 * @param url The URL to check as null-terminated UTF-8 string
 * @param source_url The source/referrer URL as null-terminated UTF-8 string (can be NULL)
 * @param resource_type The resource type (e.g., "script", "image", "document") as null-terminated UTF-8 string
 * @return true if the request should be blocked, false if it should be allowed
 */
bool adblock_engine_check_network_url(AdblockEngine engine, const char* url,
                                       const char* source_url, const char* resource_type);

/**
 * Free a string allocated by the adblock engine
 * @param s Pointer to the string to free
 */
void adblock_free_string(char* s);

#ifdef __cplusplus
}
#endif

#endif // LIBADBLOCK_H
