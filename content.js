// Loopify – A→B Loop for Spotify Web Player

(function () {
  "use strict";

  // --- State ---
  let pointA = null; // ms
  let pointB = null; // ms
  let loopActive = false;
  let lastTrackDuration = null;
  let pollInterval = null;

  // --- DOM references (resolved lazily) ---
  let rangeInput = null;
  let progressBarEl = null;
  let controlsEl = null;

  // UI element references
  let ui = {};

  // --- Helpers ---

  function formatTime(ms) {
    if (ms == null) return "--:--";
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, "0")}`;
  }

  function parseTime(str) {
    if (!str) return null;
    const parts = str.split(":");
    if (parts.length !== 2) return null;
    const min = parseInt(parts[0], 10);
    const sec = parseInt(parts[1], 10);
    if (isNaN(min) || isNaN(sec)) return null;
    return (min * 60 + sec) * 1000;
  }

  function getRange() {
    if (rangeInput && rangeInput.isConnected) return rangeInput;
    const bar = document.querySelector(
      '[data-testid="playback-progressbar"]'
    );
    rangeInput = bar ? bar.querySelector('input[type="range"]') : null;
    return rangeInput;
  }

  function getProgressBar() {
    if (progressBarEl && progressBarEl.isConnected) return progressBarEl;
    progressBarEl = document.querySelector('[data-testid="progress-bar"]');
    return progressBarEl;
  }

  function getCurrentPosition() {
    // Read from the displayed time element for accurate (1s resolution) position.
    // The range input's .value is quantized to step=5000ms and jumps ahead of
    // actual playback, causing the loop to trigger early.
    const posEl = document.querySelector('[data-testid="playback-position"]');
    if (posEl) {
      const ms = parseTime(posEl.textContent);
      if (ms != null) return ms;
    }
    // Fallback to range input
    const r = getRange();
    return r ? Number(r.value) : null;
  }

  function getTrackDuration() {
    // Prefer the displayed duration for consistency, fall back to range max
    const durEl = document.querySelector('[data-testid="playback-duration"]');
    if (durEl) {
      const ms = parseTime(durEl.textContent);
      if (ms != null) return ms;
    }
    const r = getRange();
    return r ? Number(r.max) : null;
  }

  function seekTo(ms) {
    const r = getRange();
    if (!r) return;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    ).set;
    setter.call(r, ms);
    r.dispatchEvent(new Event("input", { bubbles: true }));
    r.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // --- UI ---

  function createControls() {
    const container = document.createElement("div");
    container.className = "loopify-controls";
    container.id = "loopify-controls";

    const btnA = createButton("Set A", "set-a", () => setA());
    const timeA = createTimeDisplay("a-time");
    const sep = document.createElement("span");
    sep.className = "loopify-separator";
    sep.textContent = "→";
    const timeB = createTimeDisplay("b-time");
    const btnB = createButton("Set B", "set-b", () => setB());
    const btnLoop = createButton("A→B Loop", "loop-toggle", () =>
      toggleLoop()
    );
    btnLoop.classList.add("loop-toggle");
    const btnClear = createButton("Clear", "clear", () => clearPoints());

    container.append(btnA, timeA, sep, timeB, btnB, btnLoop, btnClear);

    ui.btnA = btnA;
    ui.btnB = btnB;
    ui.btnLoop = btnLoop;
    ui.btnClear = btnClear;
    ui.timeA = timeA;
    ui.timeB = timeB;

    return container;
  }

  function createButton(label, id, onClick) {
    const btn = document.createElement("button");
    btn.className = "loopify-btn";
    btn.dataset.loopifyId = id;
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    return btn;
  }

  function createTimeDisplay(id) {
    const span = document.createElement("span");
    span.className = "loopify-time";
    span.dataset.loopifyId = id;
    span.textContent = "--:--";
    return span;
  }

  function updateUI() {
    if (ui.timeA) ui.timeA.textContent = formatTime(pointA);
    if (ui.timeB) ui.timeB.textContent = formatTime(pointB);
    if (ui.btnA) ui.btnA.classList.toggle("active", pointA != null);
    if (ui.btnB) ui.btnB.classList.toggle("active", pointB != null);
    if (ui.btnLoop) ui.btnLoop.classList.toggle("active", loopActive);
    if (ui.btnLoop)
      ui.btnLoop.textContent = loopActive ? "A→B Loop: ON" : "A→B Loop";
    updateMarkers();
  }

  // --- Markers on progress bar ---

  function ensureMarkers() {
    const bar = getProgressBar();
    if (!bar) return;

    // Make sure the progress bar is positioned for absolute children
    if (getComputedStyle(bar).position === "static") {
      bar.style.position = "relative";
    }

    if (!ui.markerA) {
      ui.markerA = document.createElement("div");
      ui.markerA.className = "loopify-marker loopify-marker-a";
      bar.appendChild(ui.markerA);
    }
    if (!ui.markerB) {
      ui.markerB = document.createElement("div");
      ui.markerB.className = "loopify-marker loopify-marker-b";
      bar.appendChild(ui.markerB);
    }
    if (!ui.region) {
      ui.region = document.createElement("div");
      ui.region.className = "loopify-region";
      bar.appendChild(ui.region);
    }
  }

  function updateMarkers() {
    ensureMarkers();
    const duration = getTrackDuration();
    if (!duration) return;

    if (ui.markerA) {
      if (pointA != null) {
        ui.markerA.style.display = "block";
        ui.markerA.style.left = `${(pointA / duration) * 100}%`;
      } else {
        ui.markerA.style.display = "none";
      }
    }
    if (ui.markerB) {
      if (pointB != null) {
        ui.markerB.style.display = "block";
        ui.markerB.style.left = `${(pointB / duration) * 100}%`;
      } else {
        ui.markerB.style.display = "none";
      }
    }
    if (ui.region) {
      if (pointA != null && pointB != null) {
        const leftPct = (pointA / duration) * 100;
        const widthPct = ((pointB - pointA) / duration) * 100;
        ui.region.style.display = "block";
        ui.region.style.left = `${leftPct}%`;
        ui.region.style.width = `${widthPct}%`;
      } else {
        ui.region.style.display = "none";
      }
    }
  }

  // --- Actions ---

  function setA() {
    const pos = getCurrentPosition();
    if (pos == null) return;
    pointA = pos;
    // If B is set and A >= B, clear B
    if (pointB != null && pointA >= pointB) {
      pointB = null;
    }
    updateUI();
  }

  function setB() {
    const pos = getCurrentPosition();
    if (pos == null) return;
    pointB = pos;
    // If A is set and B <= A, clear A
    if (pointA != null && pointB <= pointA) {
      pointA = null;
    }
    updateUI();
  }

  function toggleLoop() {
    if (pointA == null || pointB == null) return;
    loopActive = !loopActive;
    if (loopActive) {
      // If current position is outside the loop, seek to A
      const pos = getCurrentPosition();
      if (pos != null && (pos < pointA || pos >= pointB)) {
        seekTo(pointA);
      }
    }
    updateUI();
  }

  function clearPoints() {
    pointA = null;
    pointB = null;
    loopActive = false;
    updateUI();
  }

  // --- Loop monitoring ---

  function pollLoop() {
    const duration = getTrackDuration();

    // Track change detection
    if (lastTrackDuration != null && duration != null && duration !== lastTrackDuration) {
      clearPoints();
    }
    lastTrackDuration = duration;

    if (!loopActive || pointA == null || pointB == null) return;

    const pos = getCurrentPosition();
    if (pos == null) return;

    // Position is now in 1-second resolution from the displayed time.
    // Trigger loop when we reach or pass B.
    if (pos >= pointB || pos < pointA - 1000) {
      seekTo(pointA);
    }
  }

  // --- Keyboard shortcuts ---

  function handleKeydown(e) {
    // Don't interfere with input fields
    if (
      e.target.tagName === "INPUT" ||
      e.target.tagName === "TEXTAREA" ||
      e.target.isContentEditable
    ) {
      return;
    }

    switch (e.key) {
      case "[":
        e.preventDefault();
        setA();
        break;
      case "]":
        e.preventDefault();
        setB();
        break;
      case "\\":
        e.preventDefault();
        toggleLoop();
        break;
      case "Backspace":
        e.preventDefault();
        clearPoints();
        break;
    }
  }

  // --- Injection ---

  function inject() {
    // Already injected?
    if (document.getElementById("loopify-controls")) return true;

    // Find the player controls container
    const playerControls = document.querySelector(
      '[data-testid="player-controls"]'
    );
    if (!playerControls) return false;

    const controls = createControls();

    // Insert after the player controls (between buttons and progress bar)
    // The player controls div typically contains the button row and then the progress bar row
    // We insert our controls as the last child of the player-controls container
    playerControls.appendChild(controls);

    return true;
  }

  // --- Initialization ---

  function init() {
    // Wait for Spotify player to load, then inject
    const observer = new MutationObserver(() => {
      if (inject()) {
        observer.disconnect();
        start();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Also try immediately in case it's already loaded
    if (inject()) {
      observer.disconnect();
      start();
    }
  }

  function start() {
    // Begin polling
    pollInterval = setInterval(pollLoop, 200);

    // Keyboard shortcuts
    document.addEventListener("keydown", handleKeydown);

    // Re-inject if controls get removed (Spotify SPA navigation)
    const reInjectObserver = new MutationObserver(() => {
      if (!document.getElementById("loopify-controls")) {
        // Controls were removed, try to re-inject
        if (inject()) {
          updateUI();
        }
      }

      // Also re-attach markers if progress bar was re-rendered
      if (ui.markerA && !ui.markerA.isConnected) {
        ui.markerA = null;
        ui.markerB = null;
        ui.region = null;
        updateMarkers();
      }
    });

    reInjectObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  // Kick it off
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
