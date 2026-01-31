# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Loopify is a Chrome extension (Manifest V3) that injects A→B loop controls into the Spotify Web Player. It targets `https://open.spotify.com/*` via a content script.

## Development

There is no build step, no dependencies, and no test framework. The extension is plain JS/CSS loaded directly by Chrome.

**To test changes:** reload the extension on `chrome://extensions` (click the reload icon on the Loopify card), then reload the Spotify tab.

## Architecture

The entire extension is a single content script (`content.js`) plus styles (`styles.css`), injected at `document_idle`.

**content.js** is wrapped in an IIFE with five key layers:

1. **Position reading** — `getCurrentPosition()` reads from `[data-testid="playback-position"]` text (1-second resolution). The range input's `.value` is quantized to `step=5000` and must NOT be used for timing comparisons — it jumps in 5-second increments ahead of actual playback. The range input is only used for seeking (`seekTo`) and as a fallback.

2. **Seeking** — `seekTo(ms)` uses `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set` to bypass React's controlled input, then dispatches `input` + `change` events.

3. **Loop polling** — A 200ms `setInterval` in `pollLoop()` checks if the displayed position has reached point B, and seeks back to A. Also detects track changes via duration shifts and auto-clears loop points.

4. **UI injection** — `inject()` appends controls to `[data-testid="player-controls"]`. A MutationObserver handles initial load and SPA re-navigation (Spotify removes/recreates DOM on navigation).

5. **Visual markers** — Absolutely-positioned elements on `[data-testid="progress-bar"]`: green line at A, red line at B, semi-transparent green region between them.

## Key Spotify DOM selectors

- `[data-testid="playback-progressbar"]` → contains `input[type="range"]`
- `[data-testid="playback-position"]` / `[data-testid="playback-duration"]` → displayed time text
- `[data-testid="player-controls"]` → injection target for Loopify UI
- `[data-testid="progress-bar"]` → parent for visual markers

## Keyboard shortcuts

`[` Set A, `]` Set B, `\` toggle loop, `Backspace` clear. All skip INPUT/TEXTAREA/contentEditable targets.
