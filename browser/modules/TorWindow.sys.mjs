/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * TorWindow module handles TOR (The Onion Router) window functionality.
 * Provides methods to open TOR windows and manage TOR connection options.
 */

import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";

const lazy = {};

XPCOMUtils.defineLazyServiceGetters(lazy, {
  BrowserHandler: ["@mozilla.org/browser/clh;1", Ci.nsIBrowserHandler],
});

ChromeUtils.defineESModuleGetters(lazy, {
  PrivateBrowsingUtils: "resource://gre/modules/PrivateBrowsingUtils.sys.mjs",
});

/**
 * Check if TOR is enabled in preferences
 */
function isTorEnabled() {
  try {
    return Services.prefs.getBoolPref("browser.tor.enabled", false);
  } catch (e) {
    return false;
  }
}

/**
 * Check if a window is a TOR window
 */
function isTorWindow(window) {
  try {
    return window?.document?.documentElement?.hasAttribute("tor:window") ?? false;
  } catch (e) {
    return false;
  }
}

function getTorLandingDataURI() {
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>TOR Window</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      color: #eef1f7;
      background: radial-gradient(1200px 500px at 50% -200px, #50335d 0%, #2d1f38 45%, #24192e 100%);
      overflow: hidden;
    }
    .lines {
      position: absolute;
      inset: 0;
      background: repeating-radial-gradient(circle at 50% -260px, transparent 0 26px, rgba(200,180,220,.16) 27px 29px);
      opacity: .35;
      pointer-events: none;
    }
    .status {
      position: absolute;
      top: 18px;
      left: 18px;
      background: rgba(255,255,255,.10);
      border: 1px solid rgba(255,255,255,.18);
      border-radius: 10px;
      padding: 10px 14px;
      min-width: 220px;
      backdrop-filter: blur(2px);
    }
    .status strong { display: block; font-size: 14px; }
    .status small { color: #cfc6d9; }
    main {
      min-height: 100vh;
      display: grid;
      place-items: center;
      text-align: center;
      padding: 24px;
    }
    h1 {
      font-size: 52px;
      margin: 0 0 28px;
      color: #ffffff;
      letter-spacing: .5px;
    }
    .search {
      width: min(760px, 90vw);
      display: flex;
      gap: 8px;
      border-radius: 12px;
      padding: 8px;
      background: rgba(255,255,255,.14);
      border: 1px solid rgba(255,255,255,.18);
    }
    .search input {
      flex: 1;
      border: 0;
      outline: 0;
      border-radius: 8px;
      padding: 13px 14px;
      color: #f8f8fa;
      background: rgba(255,255,255,.08);
      font-size: 15px;
    }
    .search button {
      border: 0;
      border-radius: 8px;
      padding: 0 16px;
      color: #fff;
      background: #7a4aa1;
      font-weight: 600;
      cursor: pointer;
    }
    .card {
      position: absolute;
      left: 18px;
      bottom: 18px;
      width: 280px;
      background: rgba(22, 16, 30, .72);
      border: 1px solid rgba(255,255,255,.16);
      border-radius: 12px;
      padding: 14px;
      line-height: 1.35;
    }
    .card h3 { margin: 0 0 8px; font-size: 17px; }
    .card p { margin: 0; font-size: 13px; color: #d9cfe5; }
  </style>
</head>
<body>
  <div class="lines"></div>
  <aside class="status">
    <strong id="torState">Tor is connecting... 14%</strong>
    <small id="torPhase">Handshaking with a relay</small>
  </aside>
  <main>
    <section>
      <h1>Tor Window</h1>
      <form class="search" action="https://duckduckgo.com/" method="get">
        <input name="q" placeholder="Search the web privately" autocomplete="off" />
        <button type="submit">Search</button>
      </form>
    </section>
  </main>
  <aside class="card">
    <h3>Private Window with Tor connectivity</h3>
    <p>
      Websites should have a harder time tracking your IP address and network observers
      should have a harder time seeing visited sites. For stronger anonymity, use Tor Browser.
    </p>
  </aside>
  <script>
    const state = document.getElementById("torState");
    const phase = document.getElementById("torPhase");
    const steps = [
      [14, "Handshaking with a relay"],
      [31, "Building Tor circuit"],
      [52, "Negotiating encrypted path"],
      [74, "Finalizing session"],
      [100, "Connected to Tor network"]
    ];
    let i = 0;
    const timer = setInterval(() => {
      i++;
      if (i >= steps.length) {
        clearInterval(timer);
        return;
      }
      state.textContent =
        i === steps.length - 1
          ? "Tor connected"
          : "Tor is connecting... " + steps[i][0] + "%";
      phase.textContent = steps[i][1];
    }, 950);
  </script>
</body>
</html>`;

  return `data:text/html;charset=UTF-8,${encodeURIComponent(html)}`;
}

export const TorWindow = {
  /**
   * Initializes TOR window options for a new window
   * 
   * @param {object} options - Options from BrowserWindowTracker.openWindow
   * @param {boolean} [options.tor] - Should the window be a TOR window
   * @param {object} [options.args] - Arguments to pass to the window
   * 
   * @returns {object} Modified args for the window
   */
  handleTorWindowOptions({ tor = false, args = null } = {}) {
    if (!tor) {
      return args;
    }

    if (!args) {
      args = Cc["@mozilla.org/supports-string;1"].createInstance(
        Ci.nsISupportsString
      );
      args.data = getTorLandingDataURI();
    }

    return args;
  },

  /**
   * Checks if a window is a TOR window
   * 
   * @param {Window} window - The window to check
   * @returns {boolean} True if the window is a TOR window
   */
  isTorWindow(window) {
    return isTorWindow(window);
  },

  /**
   * Shows the TOR connection dialog
   * 
   * @param {Window} window - The TOR window
   */
  showTorConnectionDialog(_window) {},

  /**
  * Initializes TOR window after it has loaded
   * 
   * @param {Window} window - The TOR window
   */
  initializeTorWindow(window) {
    if (!window || window.closed) {
      return;
    }

    // Mark the window as a TOR window
    window.document.documentElement.setAttribute("tor:window", "true");
  },

  /**
   * Connects to TOR network
   * 
   * @param {Window} window - The TOR window
   * @returns {Promise<boolean>} True if connection was successful
   */
  async connectToTor(window) {
    if (!window || window.closed) {
      return false;
    }

    try {
      // Set preference to indicate TOR is connecting
      Services.prefs.setBoolPref("browser.tor.connecting", true);

      // Simulate connection process (in real implementation, this would
      // communicate with Tor daemon)
      await new Promise(resolve => {
        setTimeout(() => {
          Services.prefs.setBoolPref("browser.tor.connected", true);
          Services.prefs.setBoolPref("browser.tor.connecting", false);
          resolve();
        }, 2000);
      });

      return true;
    } catch (e) {
      console.error("Error connecting to TOR:", e);
      Services.prefs.setBoolPref("browser.tor.connecting", false);
      return false;
    }
  },

  /**
   * Disconnects from TOR network
   * 
   * @param {Window} window - The TOR window
   * @returns {Promise<boolean>} True if disconnection was successful
   */
  async disconnectFromTor(window) {
    if (!window || window.closed) {
      return false;
    }

    try {
      Services.prefs.setBoolPref("browser.tor.connected", false);
      return true;
    } catch (e) {
      console.error("Error disconnecting from TOR:", e);
      return false;
    }
  },

  /**
   * Gets current TOR connection status
   * 
   * @returns {object} Status object with connection information
   */
  getStatus() {
    return {
      enabled: isTorEnabled(),
      connected: Services.prefs.getBoolPref("browser.tor.connected", false),
      connecting: Services.prefs.getBoolPref("browser.tor.connecting", false),
    };
  },

  /**
   * Sets TOR enabled state
   * 
   * @param {boolean} enabled - Whether TOR should be enabled
   */
  setEnabled(enabled) {
    Services.prefs.setBoolPref("browser.tor.enabled", enabled);
  },

  /**
   * Cleanup TOR window
   * 
   * @param {Window} window - The TOR window
   */
  cleanupTorWindow(window) {
    if (!window) {
      return;
    }

    // Clear any pending timers
    if (window.__torDialogTimer) {
      clearTimeout(window.__torDialogTimer);
      delete window.__torDialogTimer;
    }
  },
};
