# Adblock Component

This component provides the Lykon browser adblocker: a custom build and blocker developed by Project Arcade for integrated ad, tracker, and cosmetic filtering.

It is designed to be practical, fast, and easy to maintain while giving the browser its built-in blocking controls.

## License

This component is released under the GNU General Public License v2.0 (GPL-2.0).

## Architecture

The adblock component consists of three layers:

### 1. **C Library** (`libadblock.so`)
- Compiled from the Brave adblock-rust project
- Provides FFI (Foreign Function Interface) for C/C++ code
- Handles all ad filtering logic and rule parsing
- Ultra-high performance in Rust

### 2. **C++ Wrapper** (`AdblockEngine.h/cpp`)
- RAII wrapper around the C FFI interface
- Automatic resource management
- Type-safe C++ API for browser integration
- Bridges C layer with browser components

### 3. **JavaScript Service** (`AdblockService.sys.mjs`)
- XPCOM service module for JavaScript/browser integration
- Manages filter list loading and updates
- Provides convenient API for content scripts and browser chrome
- Handles enable/disable functionality

### 4. **Browser UI Integration**
- Lykon Shield panel controls the main adblock state
- Supports live enable/disable behavior
- Updates browser UI and reloads the active tab when needed
- Exposes tracker, script, fingerprinting, cookie, and forget-on-exit options

## File Structure

```
components/adblock/
├── libadblock.so              # Compiled Rust ad blocker library
├── libadblock.h               # C header with FFI declarations
├── AdblockEngine.h            # C++ wrapper header
├── AdblockEngine.cpp          # C++ wrapper implementation
├── AdblockService.sys.mjs     # JavaScript service module
├── moz.build                  # Build configuration
└── README.md                  # This file
```

## Usage

The blocker is meant to be used as the browser's built-in protection layer. It can:

- block ad requests before they load
- hide cosmetic ad containers in the page
- toggle protection on or off from the browser UI
- persist user preferences across sessions
- track basic blocking statistics for the current session and total use

### From C++

```cpp
#include "AdblockEngine.h"

// Create engine instance
AdblockFilterEngine engine;

// Add filter list
std::string easyListRules = R"(
||ads.example.com^
||analytics.google.com^
)";
engine.addFilterList(easyListRules);

// Check if URL should be blocked
if (engine.shouldBlock("https://ads.example.com/banner.js", 
                       "https://example.com",
                       "script")) {
    // Block the request
}
```

### From JavaScript

```javascript
import adblockService from "resource://gre/modules/AdblockService.sys.mjs";

// Initialize service
await adblockService.init();

// Add filter list
const easyListRules = `
||ads.example.com^
||analytics.google.com^
`;
await adblockService.addFilterList("EasyList", easyListRules);

// Check if URL should be blocked
if (adblockService.shouldBlock("https://ads.example.com/banner.js",
                               "https://example.com",
                               "script")) {
    // Block the request
}

// Get statistics
const stats = adblockService.getStats();
console.log(`Loaded ${stats.totalRules} filter rules`);
```

## Filter Rule Formats

The adblock engine supports multiple filter rule formats:

- **EasyList** - Standard ad blocking rules
- **EasyPrivacy** - Privacy tracking list
- **uBlock Origin** - Extended syntax support
- **Hosts** - Traditional hosts file format
- **Adblock Plus** - ABP syntax
- **Custom domain-based rules**

In addition to network-level filtering, Lykon also applies cosmetic selectors for common ad containers and placeholders.

Example rules:
```
! Comments start with exclamation mark
||ads.example.com^          # Block domain and subdomains
||ads.example.com^$script   # Block only script resources
/banner.js                  # Block path
@@||trusted.com^            # Whitelist exception
```

## Resource Types

When checking URLs, specify the resource type:

- `document` - Main page/document
- `script` - JavaScript
- `stylesheet` - CSS
- `image` - Images
- `font` - Web fonts
- `xmlhttprequest` - XHR/Fetch requests
- `media` - Audio/Video
- `othervector` - Other vector content
- `object` - Plugin content
- `other` - Default for unknown types

## Building

The adblock component requires:

1. **Rust toolchain** - For rebuilding libadblock (optional, precompiled binary included)
2. **C++ compiler** - For AdblockEngine wrapper
3. **Mozilla build tools** - Integrated via moz.build

This is a custom Project Arcade build, so local paths and integration points may differ from upstream browser adblock implementations.

To rebuild the Rust library:
```bash
cd /home/notspidey/Desktop/adblock-rust
cargo build --release
# Copy libadblock.so to browser/components/adblock/
```

## Performance Notes

- **Memory**: The engine is highly optimized and uses minimal memory
- **Initialization**: Filter loading is fast, typically < 100ms for large lists
- **Matching**: URL checking is extremely fast (O(1) in most cases)
- **Compilation**: Uses release optimizations for maximum performance

## Future Enhancements

- [ ] Cosmetic filter support (CSS injection)
- [ ] Dynamic filter list updates
- [ ] Persistent rule caching
- [ ] Debugging/inspection API
- [ ] Filter edit mode for user-created rules

## Project Notes

- Developed by Project Arcade
- Built specifically for the Lykon browser
- Includes both network blocking and cosmetic hiding behavior
- Intended to remain lightweight and easy to extend

## References

- **Brave adblock-rust**: https://github.com/brave/adblock-rust
- **Adblock Plus Filter Syntax**: https://adblockplus.org/filter-cheatsheet
- **Mozilla Documentation**: https://searchfox.org/mozilla-central/source/browser/components
