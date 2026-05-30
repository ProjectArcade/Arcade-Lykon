const LykonReportProblemDialog = {
  init() {
    this._typeList = document.getElementById("lykonReportProblemType");
    this._details = document.getElementById("lykonReportProblemDetails");
    this._diagnosticsBox = document.getElementById("lykonDiagnosticsBox");

    this._form = document.getElementById("lykonReportForm");
    this._status = document.getElementById("lykonReportStatus");
    this._statusIndicator = document.getElementById("lykonStatusIndicator");
    this._statusText = document.getElementById("lykonStatusText");
    this._dialog = document.getElementById("LykonReportProblemDialog");

    this._typeList.value = "browser-crash";

    document.addEventListener("dialogaccept", event => this.onAccept(event));
    this.populateDiagnostics();
  },

  async populateDiagnostics() {
    let diagnostics = await this.gatherDiagnostics();
    this._diagnosticsData = diagnostics;

    this._diagnosticsBox.textContent = "";
    for (let [key, val] of Object.entries(diagnostics)) {
      let row = document.createElement("div");
      row.className = "lykon-diagnostic-row";

      let labelSpan = document.createElement("span");
      labelSpan.className = "lykon-diagnostic-key";
      labelSpan.textContent = key;

      let valSpan = document.createElement("span");
      valSpan.className = "lykon-diagnostic-val";
      valSpan.textContent = val;

      row.appendChild(labelSpan);
      row.appendChild(valSpan);
      this._diagnosticsBox.appendChild(row);
    }
  },

  async gatherDiagnostics() {
    let info = {};
    try {
      info["OS"] =
        Services.appinfo.OS + " (" + Services.sysinfo.get("arch") + ")";
    } catch (e) {
      info["OS"] = "Unknown";
    }

    try {
      info["CPU Cores"] = Services.sysinfo.getProperty("cpucount");
    } catch (e) {}

    try {
      let bytes = Services.sysinfo.getProperty("memsize");
      if (bytes) {
        info["Memory (RAM)"] =
          (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
      }
    } catch (e) {}

    try {
      let startupTime = Services.startup.getStartupInfo().process.getTime();
      let uptimeSec = Math.round((Date.now() - startupTime) / 1000);
      if (uptimeSec < 60) {
        info["Uptime"] = uptimeSec + "s";
      } else if (uptimeSec < 3600) {
        info["Uptime"] =
          Math.floor(uptimeSec / 60) + "m " + (uptimeSec % 60) + "s";
      } else {
        info["Uptime"] =
          Math.floor(uptimeSec / 3600) +
          "h " +
          Math.floor((uptimeSec % 3600) / 60) +
          "m";
      }
    } catch (e) {}

    try {
      let windowCount = 0;
      let tabCount = 0;
      for (let win of Services.wm.getEnumerator("navigator:browser")) {
        windowCount++;
        if (win.gBrowser) {
          tabCount += win.gBrowser.tabs.length;
        }
      }
      info["Open Tabs"] = tabCount + " (" + windowCount + " windows)";
    } catch (e) {}

    try {
      const { AddonManager } = ChromeUtils.importESModule(
        "resource://gre/modules/AddonManager.sys.mjs"
      );
      let addons = await AddonManager.getActiveAddons();
      info["Active Extensions"] = addons.filter(
        a => a.type === "extension"
      ).length;
    } catch (e) {}

    return info;
  },

  onAccept(event) {
    event.preventDefault();
    event.stopPropagation();

    this._dialog.getButton("accept").disabled = true;
    this._dialog.getButton("cancel").disabled = true;

    this._form.hidden = true;
    this._status.hidden = false;
    this._statusIndicator.className = "lykon-status-spinner";
    document.l10n.setAttributes(
      this._statusText,
      "lykon-report-status-sending"
    );

    this._dialog.setAttribute("buttons", "");

    this.submitReport();
  },

  async submitReport() {
    let success = false;
    try {
      let reportData = {
        problemType: this._typeList.value,
        details: this._details.value.trim(),
        diagnostics: this._diagnosticsData || {},
      };

      if (
        window.arguments &&
        window.arguments[0] &&
        window.arguments[0].sendReport
      ) {
        success = await window.arguments[0].sendReport(reportData);
      }
    } catch (e) {
      console.error(e);
    }

    if (success) {
      this._statusIndicator.className = "lykon-status-success";
      this._statusIndicator.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" class="checkmark">
          <circle class="checkmark__circle" cx="26" cy="26" r="25" fill="none"/>
          <path class="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
        </svg>
      `;

      this._statusText.textContent = "";

      if (window.arguments && window.arguments[0]) {
        window.arguments[0].accepted = true;
        window.arguments[0].reportData = {
          problemType: this._typeList.value,
        };
      }

      setTimeout(() => {
        document.l10n.setAttributes(
          this._statusText,
          "lykon-report-status-success"
        );
        this._dialog.setAttribute("buttons", "cancel");
        let cancelBtn = this._dialog.getButton("cancel");
        if (cancelBtn) {
          cancelBtn.disabled = false;
          cancelBtn.setAttribute("label", "Close");
        }
      }, 1200);

      setTimeout(() => {
        this._dialog.acceptDialog();
      }, 5200);
    } else {
      this._statusIndicator.className = "lykon-status-error";
      this._statusIndicator.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" class="errormark">
          <circle class="errormark__circle" cx="26" cy="26" r="25" fill="none"/>
          <path class="errormark__line1" fill="none" d="M16 16l20 20"/>
          <path class="errormark__line2" fill="none" d="M36 16L16 36"/>
        </svg>
      `;

      this._statusText.textContent = "";

      this._dialog.setAttribute("buttons", "accept,cancel");
      this._dialog.getButton("accept").disabled = false;
      this._dialog.getButton("cancel").disabled = false;
      document.l10n.setAttributes(
        this._dialog.getButton("accept"),
        "lykon-report-button-retry"
      );

      setTimeout(() => {
        document.l10n.setAttributes(
          this._statusText,
          "lykon-report-status-error"
        );
      }, 1200);
    }
  },
};

document.addEventListener("DOMContentLoaded", () => {
  document.mozSubdialogReady = LykonReportProblemDialog.init();
});
