# Lykon Shield - UI & Toggle Integration Guide

## Overview

The Lykon Shield now has complete UI integration with:
- ✅ **Toggle Switch** with auto-refresh
- ✅ **Real-time Stats Display**
- ✅ **Filter Management Interface**
- ✅ **Custom Filter Support**
- ✅ **Session Statistics Tracking**

## Components

### 1. **ShieldToggle.sys.mjs** - Toggle Switch Handler
Manages the enable/disable toggle with auto-page-refresh on state change.

```javascript
import shieldToggle from "resource://gre/modules/ShieldToggle.sys.mjs";

// When user clicks toggle in UI:
await shieldToggle.handleToggleClick(true);  // Shield ON
await shieldToggle.handleToggleClick(false); // Shield OFF

// Gets auto-refreshed via _autoRefreshPage()
```

**Features:**
- Listens for toggle clicks
- Auto-refreshes current page
- Broadcasts state changes to UI
- Syncs with browser preferences

---

### 2. **ShieldUIController.sys.mjs** - Controller
Central hub for UI interaction with the shield.

```javascript
import shieldUIController from "resource://gre/modules/ShieldUIController.sys.mjs";

// Get shield status
const status = shieldUIController.getStatus();
// Returns: { enabled, stats }

// Update stats display
const stats = shieldUIController.updateStats();

// Add custom filter
await shieldUIController.addCustomFilter("my-filter", "||ads.com^");

// Get sample filters for UI dropdown
const samples = shieldUIController.getSampleFilters();
```

---

### 3. **FilterManager.sys.mjs** - Filter Management
Add, remove, update, and manage filter lists.

```javascript
import filterManager from "resource://gre/modules/FilterManager.sys.mjs";

// Add custom filter
await filterManager.addFilter("Block YouTube Ads", `
||youtube.com/ads/*
||googlevideo.com/videoplayback?*ad_type
`);

// Get all filters
const filters = filterManager.getFilters();

// Update existing filter
await filterManager.updateFilter("Block YouTube Ads", newRules);

// Remove filter
await filterManager.removeFilter("Block YouTube Ads");

// Import from paste/file
await filterManager.importFilters("My List", filterText);

// Export all filters
const exported = filterManager.exportFilters();
```

---

### 4. **StatsMonitor.sys.mjs** - Live Statistics
Track and display real-time blocking statistics.

```javascript
import statsMonitor from "resource://gre/modules/StatsMonitor.sys.mjs";

// Get current session stats
const stats = statsMonitor.getSessionStats();
// Returns:
// {
//   blockedThisSession: 42,
//   blockedThisPage: 5,
//   bandwidthSaved: 2097152,  // bytes
//   bandwidthSavedMB: "2.00",
//   sessionUptime: "342s",
//   totalRules: 60,
//   shieldEnabled: true
// }

// Format for display
const formatted = statsMonitor.getFormattedStats();
// Returns:
// {
//   blockedLabel: "42 ads",
//   bandwidthLabel: "2.00 MB",
//   uptime: "342s",
//   enabled: "ON"
// }

// Listen for stats updates
statsMonitor.addListener((event) => {
  console.log("Stats updated:", event.stats);
});

// Record a blocked request (called by ShieldIntegration)
statsMonitor.recordBlockedRequest(url, "script", 45000);

// Reset stats
statsMonitor.resetStats();
```

---

## UI Usage Examples

### Example 1: Simple Toggle Button

```javascript
// Get UI element
const toggleButton = document.getElementById("shield-toggle");
const statusLabel = document.getElementById("shield-status");

import shieldToggle from "resource://gre/modules/ShieldToggle.sys.mjs";

toggleButton.addEventListener("click", async () => {
  const newState = !shieldToggle.getState().enabled;
  const success = await shieldToggle.handleToggleClick(newState);
  
  if (success) {
    statusLabel.textContent = newState ? "Shield ON" : "Shield OFF";
  }
});
```

### Example 2: Stats Display Widget

```javascript
import statsMonitor from "resource://gre/modules/StatsMonitor.sys.mjs";

function updateStatsDisplay() {
    const formatted = statsMonitor.getFormattedStats();
    
    document.getElementById("blocked-count").textContent = formatted.blockedLabel;
    document.getElementById("bandwidth-saved").textContent = formatted.bandwidthLabel;
    document.getElementById("shield-status").textContent = formatted.enabled;
}

// Update on stats change
statsMonitor.addListener(() => {
    updateStatsDisplay();
});

// Initial update
updateStatsDisplay();
```

### Example 3: Filter Management Panel

```javascript
import filterManager from "resource://gre/modules/FilterManager.sys.mjs";
import shieldUIController from "resource://gre/modules/ShieldUIController.sys.mjs";

// Populate sample filters dropdown
const samples = shieldUIController.getSampleFilters();
for (const [key, filter] of Object.entries(samples)) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = filter.name;
    samplesSelect.appendChild(option);
}

// Add selected sample to custom filters
document.getElementById("apply-sample").addEventListener("click", async () => {
    const samples = shieldUIController.getSampleFilters();
    const selected = samplesSelect.value;
    const sample = samples[selected];
    
    const success = await filterManager.addFilter(sample.name, sample.rules);
    if (success) {
        console.log(`Added: ${sample.name}`);
        refreshFilterList();
    }
});

// Refresh custom filters display
async function refreshFilterList() {
    const filters = filterManager.getFilters();
    const list = document.getElementById("filter-list");
    list.innerHTML = "";
    
    for (const filter of filters) {
        const item = document.createElement("li");
        item.innerHTML = `
            <span>${filter.name} (${filter.ruleCount} rules)</span>
            <button onclick="removeFilter('${filter.name}')">Remove</button>
        `;
        list.appendChild(item);
    }
}

// Remove filter
async function removeFilter(name) {
    await filterManager.removeFilter(name);
    refreshFilterList();
}
```

### Example 4: Import Custom Filters

```javascript
import filterManager from "resource://gre/modules/FilterManager.sys.mjs";

document.getElementById("import-filters").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    const text = await file.text();
    
    const name = prompt("Filter list name:");
    if (name) {
        const success = await filterManager.importFilters(name, text);
        if (success) {
            alert("Imported successfully!");
        }
    }
});

// Export filters
document.getElementById("export-filters").addEventListener("click", () => {
    const exported = filterManager.exportFilters();
    const blob = new Blob([exported], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "adblock-filters.txt";
    a.click();
});
```

---

## Observer Events

### Available Events

**Shield Events:**
```javascript
Services.obs.addObserver((subject, topic, data) => {
    // topic = "adblock-shield-status-changed"
    // data = JSON with { type, enabled, timestamp }
}, "adblock-shield-status-changed");

Services.obs.addObserver((subject, topic, data) => {
    // topic = "adblock-stats-updated"
    // data = JSON with stats object
}, "adblock-stats-updated");
```

**Page Navigation:**
```javascript
Services.obs.addObserver((subject, topic, data) => {
    // topic = "adblock-page-changed"
    // data = page URL
    console.log("Page changed to:", data);
}, "adblock-page-changed");
```

---

## Auto-Refresh on Toggle

When user clicks the toggle switch, the following happens:

1. **Toggle Clicked** → `ShieldToggle.handleToggleClick(newState)`
2. **State Updated** → Preference updated, service notified
3. **Page Reloaded** → Browser auto-refreshes current page
4. **Stats Reset** → Per-page stats counter reset
5. **Events Fired** → UI listeners notified of change

```javascript
// The auto-refresh happens automatically in ShieldUIController._autoRefreshPage()
// It uses: Services.wm.getMostRecentWindow("navigator:browser").gBrowser.selectedBrowser.reload()
```

---

## Real-Time Statistics

### What's Tracked:

- **Blocked This Session** - Total ads blocked since browser start
- **Blocked This Page** - Ads blocked on current page
- **Bandwidth Saved** - Total size of blocked requests (bytes)
- **Session Uptime** - Time shield has been active
- **Total Rules** - Active filter rules loaded
- **Shield Status** - ON/OFF indicator

### How to Display:

```javascript
import statsMonitor from "resource://gre/modules/StatsMonitor.sys.mjs";

setInterval(() => {
    const stats = statsMonitor.getSessionStats();
    
    // Update UI
    document.getElementById("blocked-count").textContent = stats.blockedThisSession;
    document.getElementById("bandwidth").textContent = 
        statsMonitor.formatBandwidth(stats.bandwidthSaved);
    document.getElementById("uptime").textContent = stats.sessionUptime;
}, 1000); // Update every second
```

---

## Filter Syntax Support

### Basic Patterns

```
! Comments
||domain.com^              # Block domain
||domain.com$script        # Block only scripts
/path/to/ad               # Block by path
example.com/ads/*         # Block ads folder
```

### Sample Filters Available

```javascript
const samples = shieldUIController.getSampleFilters();
// Returns:
// {
//   easylist: { name, rules, description },
//   privacy: { name, rules, description },
//   social: { name, rules, description }
// }
```

---

## Preferences

All UI state synced with browser preferences:

```
browser.adblock.enabled       = true/false     (toggle state)
browser.adblock.customfilters = "{}"           (JSON filters)
browser.adblock.debug         = true/false     (debug logging)
```

---

## Testing in Browser Console

```javascript
// Import modules
import shieldToggle from "resource://gre/modules/ShieldToggle.sys.mjs";
import statsMonitor from "resource://gre/modules/StatsMonitor.sys.mjs";
import filterManager from "resource://gre/modules/FilterManager.sys.mjs";

// Test toggle
await shieldToggle.handleToggleClick(false); // Turn off
await shieldToggle.handleToggleClick(true);  // Turn on (auto-refreshes page)

// View stats
console.log(statsMonitor.getSessionStats());

// Add filter
await filterManager.addFilter("test", "||test.com^");

// View filters
console.log(filterManager.getFilters());
```

---

## Troubleshooting

### Toggle not refreshing page
- Check if `Services.wm.getMostRecentWindow` is accessible in context
- Ensure you're in a browser window context
- Check browser console for errors

### Stats not updating
- Verify `StatsMonitor` is initialized: `statsMonitor.initialized === true`
- Check that requests are being blocked: Enable debug logging
- Verify observers are firing: Check console for log messages

### Filters not working
- Verify filter syntax is correct
- Check that `FilterManager` is initialized
- Ensure filters are added to `AdblockService`

---

## Performance Tips

- **Don't refresh UI too often** - Update stats max 1-2x per second
- **Cache formatted stats** - Don't recalculate display strings constantly
- **Lazy-load filter editor** - Only show when user clicks "manage filters"
- **Debounce stats updates** - Batch multiple updates together

---

**Status**: 🟢 **READY FOR UI INTEGRATION**

Location: `browser/components/adblock/`
