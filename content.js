(function () {
  "use strict";

  let pointA = null;
  let pointB = null;
  let loopActive = false;
  let lastTrackDuration = null;
  let pollInterval = null;
  let rangeInput = null;
  let progressBarEl = null;
  let ui = {};

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
    const bar = document.querySelector('[data-testid="playback-progressbar"]');
    rangeInput = bar ? bar.querySelector('input[type="range"]') : null;
    return rangeInput;
  }

  function getProgressBar() {
    if (progressBarEl && progressBarEl.isConnected) return progressBarEl;
    progressBarEl = document.querySelector('[data-testid="progress-bar"]');
    return progressBarEl;
  }

  function getCurrentPosition() {
    const posEl = document.querySelector('[data-testid="playback-position"]');
    if (posEl) {
      const ms = parseTime(posEl.textContent);
      if (ms != null) return ms;
    }
    const r = getRange();
    return r ? Number(r.value) : null;
  }

  function getTrackDuration() {
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
    const btnLoop = createButton("A→B Loop", "loop-toggle", () => toggleLoop());
    btnLoop.classList.add("loop-toggle");
    const btnClear = createButton("Clear", "clear", () => clearPoints());

    container.append(btnA, timeA, sep, timeB, btnB, btnLoop, btnClear);

    ui = { btnA, btnB, btnLoop, btnClear, timeA, timeB };
    return container;
  }

  function updateUI() {
    if (!ui.btnA) return;
    ui.timeA.textContent = formatTime(pointA);
    ui.timeB.textContent = formatTime(pointB);
    ui.btnA.classList.toggle("active", pointA != null);
    ui.btnB.classList.toggle("active", pointB != null);
    ui.btnLoop.classList.toggle("active", loopActive);
    ui.btnLoop.textContent = loopActive ? "A→B Loop: ON" : "A→B Loop";
    updateMarkers();
  }

  function ensureMarkers() {
    const bar = getProgressBar();
    if (!bar) return;

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

  function setMarker(el, position, duration) {
    if (!el) return;
    if (position != null) {
      el.style.display = "block";
      el.style.left = `${(position / duration) * 100}%`;
    } else {
      el.style.display = "none";
    }
  }

  function updateMarkers() {
    ensureMarkers();
    const duration = getTrackDuration();
    if (!duration) return;

    setMarker(ui.markerA, pointA, duration);
    setMarker(ui.markerB, pointB, duration);

    if (ui.region) {
      if (pointA != null && pointB != null) {
        ui.region.style.display = "block";
        ui.region.style.left = `${(pointA / duration) * 100}%`;
        ui.region.style.width = `${((pointB - pointA) / duration) * 100}%`;
      } else {
        ui.region.style.display = "none";
      }
    }
  }

  function setA() {
    const pos = getCurrentPosition();
    if (pos == null) return;
    pointA = pos;
    if (pointB != null && pointA >= pointB) pointB = null;
    updateUI();
  }

  function setB() {
    const pos = getCurrentPosition();
    if (pos == null) return;
    pointB = pos;
    if (pointA != null && pointB <= pointA) pointA = null;
    updateUI();
  }

  function toggleLoop() {
    if (pointA == null || pointB == null) return;
    loopActive = !loopActive;
    if (loopActive) {
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

  function pollLoop() {
    const duration = getTrackDuration();

    if (lastTrackDuration != null && duration != null && duration !== lastTrackDuration) {
      clearPoints();
    }
    lastTrackDuration = duration;

    if (!loopActive || pointA == null || pointB == null) return;

    const pos = getCurrentPosition();
    if (pos == null) return;

    if (pos >= pointB || pos < pointA - 1000) {
      seekTo(pointA);
    }
  }

  function handleKeydown(e) {
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

  function inject() {
    if (document.getElementById("loopify-controls")) return true;

    const playerControls = document.querySelector('[data-testid="player-controls"]');
    if (!playerControls) return false;

    playerControls.appendChild(createControls());
    return true;
  }

  function start() {
    pollInterval = setInterval(pollLoop, 200);
    document.addEventListener("keydown", handleKeydown);

    new MutationObserver(() => {
      if (!document.getElementById("loopify-controls")) {
        if (inject()) updateUI();
      }

      if (ui.markerA && !ui.markerA.isConnected) {
        ui.markerA = null;
        ui.markerB = null;
        ui.region = null;
        updateMarkers();
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  function init() {
    const observer = new MutationObserver(() => {
      if (inject()) {
        observer.disconnect();
        start();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    if (inject()) {
      observer.disconnect();
      start();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
