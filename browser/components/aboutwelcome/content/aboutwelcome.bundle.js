/* Breathtaking Lykon Cosmic Sentinel Onboarding Controller */
document.addEventListener("DOMContentLoaded", () => {
  const steps = {
    welcome: document.getElementById("step-welcome"),
    shield: document.getElementById("step-shield"),
    theme: document.getElementById("step-theme"),
    migration: document.getElementById("step-migration"),
  };

  const ringOuter = document.querySelector(".ring-outer");
  const ringMiddle = document.querySelector(".ring-middle");
  const ringInner = document.querySelector(".ring-inner");
  const sentinelGlow = document.querySelector(".sentinel-glow");

  // Speed mapping for active nodes
  const updateSentinelSpeed = () => {
    const activeNodes = document.querySelectorAll(".demo-row.active-node").length;
    
    if (activeNodes === 3) {
      if (ringOuter) ringOuter.style.animationDuration = "10s";
      if (ringMiddle) ringMiddle.style.animationDuration = "8s";
      if (ringInner) ringInner.style.animationDuration = "5s";
      if (sentinelGlow) sentinelGlow.style.background = "radial-gradient(circle, var(--accent-glow) 0%, rgba(139, 92, 246, 0.25) 60%, transparent 100%)";
    } else if (activeNodes === 2) {
      if (ringOuter) ringOuter.style.animationDuration = "18s";
      if (ringMiddle) ringMiddle.style.animationDuration = "14s";
      if (ringInner) ringInner.style.animationDuration = "9s";
      if (sentinelGlow) sentinelGlow.style.background = "radial-gradient(circle, rgba(59, 130, 246, 0.2) 0%, rgba(139, 92, 246, 0.15) 60%, transparent 100%)";
    } else if (activeNodes === 1) {
      if (ringOuter) ringOuter.style.animationDuration = "30s";
      if (ringMiddle) ringMiddle.style.animationDuration = "24s";
      if (ringInner) ringInner.style.animationDuration = "15s";
      if (sentinelGlow) sentinelGlow.style.background = "radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 100%)";
    } else {
      if (ringOuter) ringOuter.style.animationDuration = "0s";
      if (ringMiddle) ringMiddle.style.animationDuration = "0s";
      if (ringInner) ringInner.style.animationDuration = "0s";
      if (sentinelGlow) sentinelGlow.style.background = "none";
    }
  };

  // Wire up toggles to nodes
  const toggles = ["toggle-adblock", "toggle-trackers", "toggle-fingerprint"];
  toggles.forEach(id => {
    const toggleEl = document.getElementById(id);
    if (toggleEl) {
      toggleEl.addEventListener("change", (e) => {
        const row = toggleEl.closest(".demo-row");
        if (e.target.checked) {
          row.classList.add("active-node");
        } else {
          row.classList.remove("active-node");
        }
        updateSentinelSpeed();
      });
    }
  });

  // Animated system diagnostics counters
  const animateStats = () => {
    const latencyVal = document.querySelector(".stat-box .stat-number");
    if (!latencyVal) return;

    let latency = 8.5;
    const interval = setInterval(() => {
      latency = Math.max(1.2, latency - (Math.random() * 1.5));
      latencyVal.textContent = `${latency.toFixed(1)}ms`;
      if (latency <= 1.2) {
        latencyVal.textContent = "1.2ms";
        clearInterval(interval);
      }
    }, 80);
  };

  const showStep = stepName => {
    Object.keys(steps).forEach(key => {
      if (steps[key]) {
        steps[key].classList.remove("active");
      }
    });
    if (steps[stepName]) {
      steps[stepName].classList.add("active");
    }
    
    if (stepName === "welcome") {
      animateStats();
    }
  };

  // Click handler attachments
  document.getElementById("btn-to-shield")?.addEventListener("click", () => showStep("shield"));
  document.getElementById("btn-back-to-welcome")?.addEventListener("click", () => showStep("welcome"));
  document.getElementById("btn-to-theme")?.addEventListener("click", () => showStep("theme"));
  document.getElementById("btn-back-to-shield")?.addEventListener("click", () => showStep("shield"));

  const finishOnboarding = () => {
    if (typeof window.AWFinish === "function") {
      window.AWFinish();
    } else {
      window.location.href = "about:home";
    }
  };

  document.getElementById("btn-skip-1")?.addEventListener("click", finishOnboarding);
  document.getElementById("btn-finish")?.addEventListener("click", finishOnboarding);

  // Themes switching mechanics
  const themeOptions = document.querySelectorAll(".theme-option");
  themeOptions.forEach(opt => {
    opt.addEventListener("click", () => {
      themeOptions.forEach(o => o.classList.remove("active"));
      opt.classList.add("active");

      const themeValue = opt.getAttribute("data-theme");

      if (themeValue === "light") {
        document.body.classList.add("light-mode");
      } else {
        document.body.classList.remove("light-mode");
      }

      if (typeof window.AWSelectTheme === "function") {
        window.AWSelectTheme(themeValue);
      }
    });
  });

  // Import mechanics
  const btnImport = document.getElementById("btn-import");
  const migrationContainer = document.getElementById("migration-wizard-container");

  btnImport?.addEventListener("click", () => {
    if (!migrationContainer) {
      return;
    }

    migrationContainer.textContent = "";

    const wizard = document.createElement("migration-wizard");

    const handleClose = () => {
      showStep("theme");
      wizard.remove();
    };

    wizard.addEventListener("MigrationWizard:Close", handleClose);
    wizard.addEventListener("MigrationWizard:Destroyed", handleClose);

    migrationContainer.appendChild(wizard);
    showStep("migration");
  });

  // Initialize animations on load
  animateStats();
  updateSentinelSpeed();
});