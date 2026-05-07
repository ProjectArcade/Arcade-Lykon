# TOR Window Feature

## Overview
This feature adds TOR (The Onion Router) window support to the Firefox browser, allowing users to open dedicated TOR windows that prompt them to connect to the TOR network.

## Files Created/Modified

### New Files Created

#### 1. **TorWindow.sys.mjs** (`/browser/modules/`)
- **Purpose**: Core TOR window management module
- **Key Functions**:
  - `handleTorWindowOptions()`: Processes TOR window creation options
  - `isTorWindow()`: Checks if a window is a TOR window
  - `showTorConnectionDialog()`: Displays the connection prompt
  - `initializeTorWindow()`: Initializes a new TOR window
  - `connectToTor()`: Handles TOR network connection
  - `disconnectFromTor()`: Handles TOR disconnection
  - `getStatus()`: Returns current TOR connection status
  - `setEnabled()`: Enables/disables TOR functionality
  - `cleanupTorWindow()`: Cleans up resources when TOR window closes

#### 2. **Dialog Files** (`/browser/base/content/tor/`)

##### torConnectionDialog.html
- Modern, responsive HTML-based dialog UI
- Shows connection status with visual indicators
- Displays TOR benefits and warnings
- Features "Remember my choice" checkbox
- Progress indicator during connection
- Styled with gradient header and modern design

##### torConnectionDialog.xul
- XUL version of the dialog for compatibility
- Similar functionality to HTML version
- Follows Firefox XUL conventions

##### torConnectionDialog.js
- JavaScript handler for both HTML and XUL dialogs
- Manages user interactions (connect/cancel buttons)
- Handles TOR module interaction
- Updates UI based on connection status
- Graceful fallback for different contexts

##### torConnectionDialog.css
- Styling for XUL dialog version
- Purple gradient theme
- Status indicators (connected/disconnected/connecting)
- Responsive layout

#### 3. **Localization** (`/browser/locales/en-US/browser/tor/`)

##### torConnectionDialog.dtd
- English localization strings
- Includes dialog title, descriptions, benefits, and warnings
- Strings for all UI elements

### Modified Files

#### 1. **BrowserWindowTracker.sys.mjs** (`/browser/modules/`)
- Added TorWindow to lazy module getters
- Extended `openWindow()` method to accept `tor` parameter
- Added TOR window feature flag: `"tor"`
- Added TOR window initialization on DOMContentLoaded
- Added TOR window cleanup on unload

#### 2. **browser-sets.js** (`/browser/base/content/`)
- Updated the `Tools:TorWindow` command handler
- Changed from opening private window to opening TOR window: `OpenBrowserWindow({ tor: true })`

## Usage

### Opening a TOR Window
Users can open a TOR window in multiple ways:

1. **File Menu**: File → New TOR Window
2. **Keyboard Shortcut**: (if configured)
3. **Programmatically**: `OpenBrowserWindow({ tor: true })`

### Connection Flow
1. User opens a TOR window via menu or keyboard shortcut
2. Window loads and displays the TOR Connection Dialog
3. User can choose to:
   - Click "Connect" to establish TOR connection
   - Click "Cancel" to close the dialog without connecting
4. Optionally check "Remember my choice" to auto-connect in future TOR windows
5. Connection progress is shown with visual indicators
6. Dialog closes automatically upon successful connection

## API Reference

### TorWindow Module

#### `handleTorWindowOptions(options)`
Processes options for TOR window creation.
```javascript
TorWindow.handleTorWindowOptions({ tor: true, args: null })
```

#### `initializeTorWindow(window)`
Initializes a TOR window and shows connection dialog.
```javascript
TorWindow.initializeTorWindow(browserWindow)
```

#### `connectToTor(window)`
Connects to the TOR network.
```javascript
const success = await TorWindow.connectToTor(browserWindow)
```

#### `getStatus()`
Returns current TOR connection status.
```javascript
const status = TorWindow.getStatus()
// Returns: { enabled: bool, connected: bool, connecting: bool }
```

#### `isTorWindow(window)`
Checks if a window is a TOR window.
```javascript
const isTor = TorWindow.isTorWindow(browserWindow)
```

### Preferences

The following preferences are used:

- `browser.tor.enabled`: Boolean - TOR feature is enabled
- `browser.tor.connected`: Boolean - Currently connected to TOR
- `browser.tor.connecting`: Boolean - Currently connecting to TOR
- `browser.tor.autoConnect`: Boolean - Auto-connect in future TOR windows

## Localization

Localized strings are defined in DTD files:
- `torConnection.title`: Dialog window title
- `torConnection.header`: Dialog header
- `torConnection.description`: Main description text
- `torConnection.statusLabel`: Status label
- `torConnection.benefits`: Benefits of using TOR
- `torConnection.warning`: Important warnings
- `torConnection.rememberChoice`: Checkbox label

To add support for other languages, create:
`/browser/locales/[LANG]/browser/tor/torConnectionDialog.dtd`

## Technical Details

### Dialog Architecture
- **HTML Version** (Primary): Works with modern Firefox
- **XUL Version** (Fallback): For compatibility with older systems
- **JavaScript**: Unified handler for both versions

### State Management
- Uses Firefox Services.prefs for persistent state
- Tracks connection status in real-time
- Cleans up timers on window unload

### Error Handling
- Graceful fallbacks if TOR module unavailable
- Safe navigation for DOM element access
- Try-catch blocks for preference access
- Simulation mode for testing

## Future Enhancements

Potential improvements:

1. **Integration with Tor Daemon**
   - Real TCP socket connection to Tor daemon
   - Actual SOCKS5 proxy configuration
   - Proper circuit building

2. **Circuit Information**
   - Display current exit node
   - Show connection path visualization
   - Provide circuit renewal options

3. **Security Features**
   - Clear website identity in TOR mode
   - Warn about JavaScript
   - Disable tracking cookies in TOR windows
   - Isolate cookies per TOR window

4. **Additional Options**
   - Exit node country selection
   - Custom bootstrap configuration
   - Bridge support

5. **UI Enhancements**
   - System tray indicator for TOR status
   - Real-time bandwidth monitor
   - Connection quality indicator

## Security Considerations

### Current Implementation
- Shows educational information about TOR
- Warns users about potential privacy implications
- Marks TOR windows with visual indicator
- Doesn't collect browsing data

### Recommendations
- Verify TOR connection actually works
- Implement proper SOCKS5 proxy configuration
- Test with TOR network routes
- Consider integration with system Tor daemon
- Implement circuit isolation per window

## Testing

### Basic Testing
1. Open TOR window from menu
2. Verify dialog appears
3. Test "Connect" button flow
4. Test "Cancel" button
5. Check "Remember my choice" functionality
6. Verify dialog auto-closes on success

### Advanced Testing
1. Test multiple concurrent TOR windows
2. Test window closing during connection
3. Test preference persistence
4. Test auto-connect functionality
5. Test with network unavailable

## Troubleshooting

### Dialog doesn't appear
- Check browser console for errors
- Verify browser.tor.enabled = true
- Check that torConnectionDialog.html/xul exists

### Connection fails
- Verify TOR daemon is running (if using real TOR)
- Check network connectivity
- Review browser console for error messages

### Remember choice not working
- Check browser.tor.autoConnect preference
- Verify Services.prefs is accessible
- Check for permission issues

## Notes

- This is an initial implementation focused on UI and basic functionality
- Real TOR network integration requires additional configuration
- The connection simulation mode is suitable for development/testing
- Production deployment should include actual Tor daemon integration
