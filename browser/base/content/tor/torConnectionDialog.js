/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * TOR Connection Dialog Handler
 * Manages the TOR connection prompt shown when a TOR window opens
 */

var BrowserTorConnectionDialog = {
  /**
   * Initialize the dialog
   */
  init() {
    const connectBtn = document.getElementById("connectBtn");
    const cancelBtn = document.getElementById("cancelBtn");

    if (connectBtn) {
      connectBtn.addEventListener("click", () => this.onConnect());
    }
    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => this.onCancel());
    }

    this.updateConnectionStatus();
  },

  /**
   * Handle connect button click
   */
  async onConnect() {
    const rememberCheckbox = 
      document.getElementById("torRememberChoice") || 
      document.getElementById("rememberChoice");
    
    if (rememberCheckbox && rememberCheckbox.checked) {
      // Store user's choice
      try {
        Services.prefs.setBoolPref("browser.tor.autoConnect", true);
      } catch (e) {
        console.log("Note: Cannot set browser preferences in this context");
      }
    }

    // Show progress
    this.showProgress(true);

    // Disable button during connection
    const connectBtn = document.getElementById("connectBtn") || 
                      this.findButtonByLabel("Connect");
    if (connectBtn) {
      connectBtn.disabled = true;
    }

    // Connect to TOR
    await this.connectToTOR();
  },

  /**
   * Handle cancel button click
   */
  onCancel() {
    // User declined to connect
    window.close();
  },

  /**
   * Connect to TOR network
   */
  async connectToTOR() {
    try {
      const openerWindow = window.opener || top;
      const TorModule = ChromeUtils.importESModule(
        "resource:///modules/TorWindow.sys.mjs"
      );

      // Connect to TOR
      const success = await TorModule.TorWindow.connectToTor(openerWindow);

      if (success) {
        this.updateConnectionStatus();
        this.showMessage("Connected to TOR network");

        // Close dialog after a short delay
        setTimeout(() => {
          window.close();
        }, 1500);
      } else {
        this.showMessage("Could not connect to TOR network");
        this.showProgress(false);
      }
    } catch (e) {
      console.error("Error connecting to TOR:", e);
      this.showMessage("An error occurred while connecting to TOR");
      this.showProgress(false);
    }
  },

  /**
   * Update the connection status display
   */
  updateConnectionStatus() {
    const statusText =
      document.getElementById("statusText") ||
      document.getElementById("connectionStatusText");
    const statusIcon =
      document.getElementById("statusIcon") ||
      document.getElementById("connectionStatusIcon");

    if (!statusText || !statusIcon) {
      return;
    }

    try {
      const TorModule = ChromeUtils.importESModule(
        "resource:///modules/TorWindow.sys.mjs"
      );
      const status = TorModule.TorWindow.getStatus();

      statusIcon.classList.remove("connecting", "connected", "disconnected");

      if (status.connecting) {
        if (statusText.setAttribute) {
          statusText.setAttribute("value", "Connecting...");
        }
        statusText.textContent = "Connecting...";
        statusIcon.classList.add("connecting");
      } else if (status.connected) {
        if (statusText.setAttribute) {
          statusText.setAttribute("value", "Connected");
        }
        statusText.textContent = "Connected";
        statusIcon.classList.add("connected");
      } else {
        if (statusText.setAttribute) {
          statusText.setAttribute("value", "Not connected");
        }
        statusText.textContent = "Not connected";
        statusIcon.classList.add("disconnected");
      }
    } catch (e) {
      console.error("Error updating status:", e);
      if (statusText.setAttribute) {
        statusText.setAttribute("value", "Status unavailable");
      }
      statusText.textContent = "Status unavailable";
    }
  },

  /**
   * Show/hide progress indicator
   */
  showProgress(show) {
    const progressSection = document.getElementById("progressSection");
    if (progressSection) {
      if ("hidden" in progressSection) {
        progressSection.hidden = !show;
      }
      progressSection.classList.toggle("show", show);
    }
  },

  /**
   * Show a message to the user
   */
  showMessage(message) {
    const statusText =
      document.getElementById("statusText") ||
      document.getElementById("connectionStatusText");
    if (statusText) {
      if (statusText.setAttribute) {
        statusText.setAttribute("value", message);
      }
      statusText.textContent = message;
    }
  },
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () =>
    BrowserTorConnectionDialog.init()
  );
} else {
  BrowserTorConnectionDialog.init();
}
