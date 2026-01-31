<p align="center">
  <img src="assets/logo.jpg" alt="Loopify" width="500">
</p>

<p align="center">
  A Chrome extension that adds A→B loop controls to Spotify Web Player — perfect for practicing instruments, studying music, or learning lyrics.
</p>

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-34A853)
![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- **A→B looping** — set two points and loop between them continuously
- **Visual markers** — green (A) and red (B) markers on the progress bar with a shaded loop region
- **Keyboard shortcuts** — `[` set A, `]` set B, `\` toggle loop, `Backspace` clear
- **Auto-clear on track change** — loop points reset when the song changes
- **Zero dependencies** — pure vanilla JS, no build step

## Install

1. Clone or download this repo
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the `loopify` folder
5. Navigate to [open.spotify.com](https://open.spotify.com) and play a song

## Usage

Controls appear below the playback buttons in Spotify's player bar:

1. Play a song and navigate to the start of the section you want to loop
2. Click **Set A** (or press `[`)
3. Navigate to the end of the section
4. Click **Set B** (or press `]`)
5. Click **A→B Loop** (or press `\`) to start looping

Click **Clear** (or press `Backspace`) to remove the loop points.

## How it works

Loopify injects a content script into Spotify Web Player that:

- Reads playback position from Spotify's displayed time element (the progress bar's range input is quantized to 5-second steps and can't be used for accurate timing)
- Seeks by programmatically setting the range input value and dispatching native events, bypassing React's controlled input layer
- Polls every 200ms to detect when playback reaches point B and snaps back to A
- Uses MutationObservers to handle Spotify's SPA navigation, re-injecting controls when the DOM is rebuilt

## License

MIT
