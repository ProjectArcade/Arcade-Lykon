# Lykon Browser – Advanced Privacy & Ad-Blocking Web Browser

![Lykon Shield Badge](docs/readme/readme-banner.svg)

**Lykon** is a custom Firefox-based web browser engineered for privacy, performance, and user control. Built on the Mozilla Firefox codebase, Lykon integrates native ad-blocking, tracker protection, privacy controls, and an intuitive **Lykon Shield** interface to give users complete visibility and control over their browsing experience.

## 🎯 Key Features

### 🛡️ Lykon Shield – Integrated Privacy & Ad-Blocking
- **Built-in Ad Blocker** – Native blocking engine (no extensions needed)
- **Tracker Blocking** – Filters tracking pixels, analytics, and profiling scripts
- **Cosmetic Filtering** – Hides ad containers and sponsored content
- **Real-time Statistics** – Live count of blocked ads and trackers per page
- **One-Click Control** – Enable/disable protection instantly from the toolbar
- **OTT Site Bypass** – Smart bypass for popular streaming services (Netflix, Hotstar, Jio, Disney+, etc.)

### 🔒 Privacy-First Architecture
- **HTTPS Enforcement** – Upgrade insecure connections where possible
- **Cookie Management** – Fine-grained control over first-party and third-party cookies
- **Fingerprinting Protection** – Prevent websites from building tracking profiles
- **Forget on Exit** – Auto-clear cookies and browsing data on session close
- **Referrer Policy** – Strict-origin-when-cross-origin by default

### ⚡ Performance Optimized
- **Native Rust Engine** – High-performance ad-filtering via libadblock
- **C++ Wrapper** – Efficient browser integration with zero overhead
- **Smart Lazy-Loading** – Detects and blocks dynamically-injected ads
- **Per-Page Stats** – Track blocking metrics per tab independently
- **Debounced Updates** – 120ms mutation observer throttling prevents UI lag

### 👥 Developer-Friendly
- **Modular Architecture** – Cleanly separated layers (Rust, C++, JavaScript)
- **Open Source** – Licensed under Mozilla Public License 2.0 (MPL-2.0)
- **Comprehensive Logging** – Debug-friendly console messages for troubleshooting
- **Easy Extension** – Well-documented APIs for adding custom filters

---

## 📁 Project Structure

```
lykon/
├── browser/                          # Browser UI and chrome code
│   ├── base/content/
│   │   ├── navigator-toolbox.inc.xhtml   # Toolbar UI (includes Lykon Shield button)
│   │   └── lykon-shield-panel.js         # Shield panel controller & cosmetic filter engine
│   ├── components/adblock/          # Ad-blocking component
│   │   ├── libadblock.so            # Compiled Rust ad-blocker library (Brave project)
│   │   ├── libadblock.h             # C FFI declarations
│   │   ├── AdblockEngine.h/cpp      # C++ wrapper for FFI
│   │   ├── AdblockService.sys.mjs   # JS service module for browser integration
│   │   ├── ShieldIntegration.sys.mjs # Network observer & DOM sanitizer
│   │   ├── FilterManager.sys.mjs    # Filter parsing and matching logic
│   │   ├── AdblockConfig.sys.mjs    # Configuration & preferences
│   │   ├── easylist.txt             # Default filter list (ads)
│   │   ├── easyprivacy.txt          # Default filter list (trackers)
│   │   └── moz.build                # Build configuration
│   ├── themes/                      # Browser theming
│   └── locales/                     # Internationalization (l10n)
├── build/                           # Build system and configuration
├── config/                          # Build configuration
├── devtools/                        # Developer tools
├── dom/                             # DOM implementation
├── extensions/                      # Browser extensions
├── gfx/                             # Graphics layer
├── js/                              # SpiderMonkey JS engine
├── layout/                          # Layout engine
├── media/                           # Media handling
├── modules/                         # Shared modules
├── netwerk/                         # Networking layer
├── storage/                         # Database storage
├── third_party/                     # Third-party dependencies
├── toolkit/                         # Toolkit shared code
├── widget/                          # Desktop widget/window management
├── xpcom/                           # Cross-platform component object model
├── mach                             # Build system entry point
├── configure                        # Build configuration script
├── package.json                     # Node.js dependencies
├── Makefile.in                      # Build makefile
└── README.md                        # Original Firefox README
```

---

## 🏗️ Architecture Overview

### 3-Layer Ad-Blocking System

```
┌─────────────────────────────────────────────┐
│     Layer 3: JavaScript Service             │
│  (AdblockService.sys.mjs)                   │
│  - Filter list management                  │
│  - Enable/disable control                  │
│  - Statistics tracking                     │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│     Layer 2: C++ Wrapper                    │
│  (AdblockEngine.h/cpp)                      │
│  - RAII resource management                │
│  - Type-safe API                           │
│  - FFI marshalling                         │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│     Layer 1: Rust Library                   │
│  (libadblock.so – Brave project)            │
│  - Ultra-fast rule matching                │
│  - Network request filtering               │
│  - Compiled performance                    │
└─────────────────────────────────────────────┘
```

### Browser Integration Flow

```
HTTP Request
    ↓
[ShieldIntegration._onHttpRequest]
    ↓
[AdblockService.shouldBlock]
    ↓
[FilterManager.matches]
    ↓
Decision: BLOCK or ALLOW
    ↓
└─→ if BLOCKED: channel.cancel(NS_BINDING_ABORTED)
└─→ if ALLOWED: request continues
```

### Cosmetic Filtering (DOM-Level)

The **LykonCosmeticFilter** engine operates in 9 layers:

1. **Layer 0** – Global agent stylesheet (instant, browser-wide)
2. **Layer 1** – Per-document style injection (high priority)
3. **Layer 2** – JavaScript selector sweep (bulk hiding)
4. **Layer 3** – Heuristic scoring engine (AI-driven detection)
5. **Layer 4** – MutationObserver (debounced @ 120ms)
6. **Layer 5** – IntersectionObserver (lazy collapse on scroll)
7. **Layer 6** – Iframe src patrol (dynamic ad detection)
8. **Layer 7** – Shadow-DOM piercing (web components support)
9. **Layer 8** – Sticky ad eviction (overlay removal)

---

## 🚀 Building & Installation

### Prerequisites

- **Linux** (x86_64), **macOS**, or **Windows**
- **Python 3.8+** – Build system
- **Rust 1.x** – For libadblock compilation
- **C++17 compiler** – GCC or Clang
- **Git** – For version control
- **~15 GB** disk space – Full build
- **8 GB+ RAM** – Faster compilation

### Quick Build

```bash
# Clone repository (if not already done)
git clone https://github.com/lykon-browser/lykon.git
cd lykon

# Configure build
./mach configure

# Build Lykon (will take 20–60 minutes on first build)
./mach build

# Run development build
./mach run
```

### Incremental Builds

After making code changes:

```bash
# Rebuild only changed artifacts
./mach build

# Run with latest changes
./mach run
```

### Build Configuration

Edit `.mozconfig` to customize:

```bash
# Use optimized build
ac_add_options --enable-optimize

# Disable debug symbols (smaller binary)
ac_add_options --disable-debug

# Enable LTO (slower compile, smaller binary)
ac_add_options --enable-lto=cross
```

---

## 🔧 Ad-Blocking Component Usage

### JavaScript API

```javascript
// Import the ad-blocking service
import { AdblockService } from "resource:///modules/AdblockService.sys.mjs";
import { shieldIntegration } from "resource:///modules/ShieldIntegration.sys.mjs";

// Initialize
await AdblockService.init();

// Check if URL should be blocked
const shouldBlock = AdblockService.shouldBlock(
  "https://ads.example.com/banner.js",
  "https://example.com",  // origin/referrer
  "script"                // resource type
);

// Get statistics
const stats = AdblockService.getStats();
console.log(`Blocked: ${stats.blocked}, Session: ${stats.startTime}`);

// Enable/disable blocking
AdblockService.setEnabled(true);

// Get per-page stats
const pageStats = AdblockService.getPageStats("https://example.com");
console.log(`Page blocks: ${pageStats.blocked}`);
```

### C++ API

```cpp
#include "AdblockEngine.h"

// Create engine
AdblockFilterEngine engine;

// Load filter list
engine.addFilterList(easyListRules);

// Check URL
if (engine.shouldBlock(
    "https://ads.example.com/banner.js",
    "https://example.com",
    "script")) {
  // Block request
}
```

### Filter List Format

Lykon uses **AdBlock Plus (ABP)** syntax:

```
! Comment
||ads.example.com^   # Domain anchor
||banner.js$script   # Domain + resource type
/ads/banner*.js      # Regex pattern
example.com##.ad-box # Cosmetic rule
@@||trusted.com^     # Allowlist rule
```

---

## 🛡️ Lykon Shield UI

### Toolbar Button
Located in the navigation bar, the **Lykon Shield** button shows:
- Current blocking status (icon state)
- Quick access to shield settings
- Real-time block count

### Shield Panel Components

#### Status Card
- **Hero section** – Live protection status
- **Big number** – Ads blocked this session
- **Status badge** – "Blocking ads" / "Shield is Down"

#### Statistics Row
- **Total Blocked** – Lifetime ads blocked
- **Trackers Blocked** – Tracking pixels stopped
- **Bandwidth Saved** – Estimated data saved

#### Toggle & Modes
- **Main toggle** – Enable/disable protection
- **Tracker mode** – Standard, Strict, or Off
- **HTTPS mode** – Soft upgrade or strict
- **Cookie mode** – All, First-party only, or Off
- **Fingerprinting** – Toggle protection
- **Forget on Exit** – Auto-clear on close

### Per-Page Statistics
Each tab tracks independent block counts to show which sites have the most ads/trackers.

---

## 🔐 Privacy Shield Features

### OTT (Over-the-Top) Bypass
To prevent ad-blocker detection on streaming services, Lykon automatically disables blocking for:
- `hotstar.com`, `hotstar.in`
- `disneyplus.com`, `disneyplus.in`
- `netflix.com`
- `jiocinema.com`, `jio.com`
- `primevideo.com`
- `hulu.com`, `hbomax.com`
- And 10+ others...

Bypass can be customized in [FilterManager.sys.mjs](browser/components/adblock/FilterManager.sys.mjs#L8).

### Tracker Detection
Scans for known tracking domains:
- Google Analytics, DoubleClick, AdSense
- Facebook Conversion Pixel
- Twitter Analytics
- LinkedIn Insight Tag
- TikTok Analytics
- Microsoft Clarity
- And 50+ ad/tracker networks

---

## 📊 Statistics & Monitoring

### Real-Time Updates
The Shield panel refreshes every 500ms with live data:
- Session block count (current page)
- Global total blocked count
- Tracker counts
- Estimated bandwidth saved

### Per-Page Tracking
Each tab's origin gets its own stats counter:

```javascript
// Stats keyed by page origin
_pageStats.get("https://example.com") → { blocked: 42, allowed: 5 }
```

### Reset on Navigation
When navigating to a new page, the per-page counter is reset.

---

## 🐛 Debugging & Development

### Enable Debug Logging

Set environment variable before running:

```bash
RUST_LOG=debug ./mach run
```

Or modify [AdblockConfig.sys.mjs](browser/components/adblock/AdblockConfig.sys.mjs):

```javascript
const DEBUG = true;  // Enable verbose logging
```

### Common Log Messages

```
[AdblockService] Init failed: ...
[FilterManager] Ready: 12345 domains, 54321 substrings
[ShieldIntegration] Blocking: https://ads.example.com/banner.js
[LykonCosmetic] JS pass hid 15 elements
[LykonShield] Shield toggled: true
```

### Test Filter Lists

Create custom filter lists in [browser/components/adblock/](browser/components/adblock/):

```bash
# Add your test rules to a new file
echo "||test-ads.example.com^" >> test-filters.txt

# Load in code (temporary)
const customRules = "||test-ads.example.com^";
await AdblockService.addFilterList("test", customRules);
```

---

## 🎨 UI Customization

### Shield Panel Styling

Edit [navigator-toolbox.inc.xhtml](browser/base/content/navigator-toolbox.inc.xhtml) for layout changes.

Add CSS in `lykon-shield-panel.js`:

```javascript
// Add to _cssRule
.lks-hero { background: #your-color; }
.lks-stat-val { font-size: 32px; }
```

### Theme Support
Lykon integrates with Firefox's standard theming system:

```bash
# Themes location
browser/themes/shared/
browser/themes/linux/
browser/themes/windows/
browser/themes/osx/
```

---

## 📚 Key Files Reference

| File | Purpose |
|------|---------|
| `AdblockService.sys.mjs` | Main service API for ad-blocking |
| `FilterManager.sys.mjs` | Filter parsing, matching, and OTT bypass |
| `ShieldIntegration.sys.mjs` | Network observer and DOM sanitizer |
| `lykon-shield-panel.js` | UI controller and cosmetic filter engine |
| `AdblockConfig.sys.mjs` | Preferences and configuration defaults |
| `AdblockEngine.h/cpp` | C++ FFI wrapper to Rust library |
| `easylist.txt` / `easyprivacy.txt` | Default filter lists |

---

## 🔄 Request/Response Lifecycle

### Network Request Blocking

```
1. HTTP Request Intercepted
   └─→ ShieldIntegration._onHttpRequest(channel)
       ├─→ Extract URL, referrer, content-type
       ├─→ Get hostname from origin
       ├─→ Check OTT bypass (if origin is streaming service, allow all)
       └─→ Call AdblockService.shouldBlock()
           ├─→ FilterManager.matches()
           │   ├─→ Check YouTube CDN allowlist
           │   ├─→ Check custom allowlist
           │   ├─→ Check domain blocks (fast Set lookup)
           │   ├─→ Check substring patterns
           │   └─→ Return true/false
           └─→ If blocked: channel.cancel(NS_BINDING_ABORTED)
```

### Cosmetic Filtering (DOM Cleanup)

```
1. Document Inserted
   └─→ ShieldIntegration._onDocumentInserted(doc)
       ├─→ LykonCosmeticFilter.run(doc)
       │   ├─→ _injectStylesheet()     // Layer 1: CSS rules
       │   ├─→ _jsHidePass()           // Layer 2 & 3: Selectors + scoring
       │   ├─→ _iframeSrcPatrol()      // Layer 6: Dynamic iframes
       │   ├─→ _shadowDomPierce()      // Layer 7: Web components
       │   ├─→ _stickyAdEviction()     // Layer 8: Overlay removal
       │   └─→ _attachIntersection()   // Layer 5: Lazy collapse
       ├─→ MutationObserver attach (Layer 4)
       └─→ Periodic sweep × 10 (Layer 9)
```

---

## 🧪 Testing

### Test Websites

Use these sites to test ad-blocking:

- **Heavy ads site** – https://blockadblock.com/ (use with caution)
- **Cosmetic filters** – Any news/blog site with ad containers
- **Tracking pixels** – Check DevTools Network tab for blocked requests
- **OTT bypass** – https://hotstar.com/, https://netflix.com/ (verify no blocks)

### Manual Test Filter

```javascript
// Add test filter to check matching
const testRule = "||test-ads.example.com^";
await AdblockService.addFilterList("test", testRule);

// Visit a page that loads from test-ads.example.com
// Watch console for: "[ShieldIntegration] Blocking: https://test-ads.example.com/..."
```

---

## 🤝 Contributing

### Report Issues
- **Bug reports** – [GitHub Issues](https://github.com/lykon-browser/lykon/issues)
- **Security issues** – [SECURITY.md](SECURITY.md)

### Code Contributions

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/my-feature`)
3. **Make** your changes
4. **Test** locally (`./mach run`)
5. **Commit** with clear messages
6. **Push** to your fork
7. **Open** a Pull Request with description

### Areas for Contribution

- **Filter lists** – Add/improve ad-blocking rules
- **UI/UX** – Enhance the Shield panel design
- **Performance** – Optimize filtering engine
- **Localization** – Translate UI to new languages
- **Documentation** – Improve guides and comments

---

## 📦 Dependencies

### Major Components

| Component | Source | License |
|-----------|--------|---------|
| Firefox Core | Mozilla | MPL-2.0 |
| libadblock | Brave | GPLv2 |
| SpiderMonkey JS | Mozilla | MPL-2.0 |
| Xpcom | Mozilla | MPL-2.0 |

### Build Tools

- Python 3.8+
- Rust 1.x
- Cargo
- LLVM/Clang or GCC
- Make / Ninja

---

## 📄 License

Lykon is licensed under the **Mozilla Public License 2.0 (MPL-2.0)** with the following exceptions:

- **Ad-blocking component** (`browser/components/adblock/`) – GPL-2.0 (from Brave project)
- **Third-party libraries** – Licensed per their respective licenses (see [LICENSE](LICENSE))

---

## 📞 Support & Resources

- **Official Docs** – [Lykon Documentation](https://wiki.lykon-browser.org)
- **Build Issues** – [Build Documentation](./docs/building/)
- **Security Issues** – [SECURITY.md](SECURITY.md)
- **Code of Conduct** – [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

---

## 🎯 Roadmap

### Planned Features
- [ ] Advanced fingerprinting detection
- [ ] Per-domain filter management UI
- [ ] Sync protection settings across devices
- [ ] Custom filter list import/export
- [ ] WebRTC leak detection
- [ ] DNS-over-HTTPS (DoH) configuration panel
- [ ] Performance analytics dashboard
- [ ] Cloud backup of settings

### Known Limitations
- OTT sites may occasionally detect ad-blockers (mitigation in progress)
- Shadow DOM pierce may fail on some web components
- Some dynamic ads load after page render (caught by MutationObserver)

---

## 💡 Tips & Tricks

### Disable Blocking on a Specific Site

Click the Shield button → Toggle off.

### Add Custom Filter

```javascript
// DevTools Console
const { AdblockService } = ChromeUtils.importESModule("resource:///modules/AdblockService.sys.mjs");
await AdblockService.addFilterList("custom", "||my-site.com^");
```

### Check Current Block Stats

```javascript
const { shieldIntegration } = ChromeUtils.importESModule("resource:///modules/ShieldIntegration.sys.mjs");
console.log(shieldIntegration.getStatus());
```

### Force Shield Panel Refresh

```javascript
// In browser console
LykonShield._updateStats();
```

---

## 🙏 Acknowledgments

- **Mozilla Foundation** – Firefox and core technologies
- **Brave Software** – libadblock Rust library
- **The Community** – EasyList maintainers, contributors, and testers

---

## 📝 Change Log

See [CHANGELOG.md](./docs/CHANGELOG.md) for detailed version history and release notes.

---

**Built with ❤️ for privacy, performance, and user control.**

For questions or discussions, open an issue or reach out to the community on [Discussions](https://github.com/lykon-browser/lykon/discussions).
