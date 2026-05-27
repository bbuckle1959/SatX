# SatX Tracker

Desktop satellite tracker built with **Tauri 2**, React, TypeScript, and `satellite.js`. It loads active TLEs, propagates orbits in a Web Worker, and renders thousands of objects on a 3D globe with a searchable sidebar.

**Supported platform:** Windows, macOS, and Linux desktop (Tauri shell). **Mobile (iOS/Android) is not supported yet** — some responsive UI exists in the web layer, but there is no supported mobile build or workflow.

This project targets **Tauri 2.0+ only** (npm `>=2.0.0 <3.0.0`, Rust `>=2.0.0, <3`). Tauri 1 is not supported. `npm run ensure:tauri2` checks dependency pins before desktop builds.

## Features

- Live orbital propagation with pause/resume and FPS metrics
- Object-type filters (stations, navigation, debris, Starlink, and more)
- Nearest-objects list (50 entries) sorted by slant range when location is available
- Browser geolocation shown as a red ground marker
- Click or list-select for object details; non-Starlink selections centre the globe on that object
- **Starlink dish alignment** (desktop app only): fetch boresight from the dish on `http://192.168.100.1:9201`, match to a servicing satellite, orange link from your location, and servicing entry pinned at the top of the list (Starlink filter only)

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)
- [Rust](https://www.rust-lang.org/learn/get-started#installing-rust)
- [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS  
  - Windows: WebView2 and Visual Studio Build Tools (C++ workload)  
  - macOS: Xcode command-line tools  
  - Linux: webkit2gtk and related packages per Tauri docs

## Development (desktop app)

```bash
npm install
npm run tauri:dev
```

On Windows, use `npm run tauri:dev` (not `tauri dev` directly). The `scripts/tauri-dev.cmd` wrapper loads the MSVC environment before compiling Rust.

The app opens as a native window with the Vite dev server on `http://localhost:1420`.

## Production build

```bash
npm run tauri:build
```

Installers/artifacts are produced under `src-tauri/target/release/` (exact bundles depend on OS and Tauri bundle settings).

## Browser-only dev (limited)

```bash
npm run dev
```

Runs the frontend at `http://localhost:1420` without Tauri. Useful for UI and globe work, but **Starlink dish fetch does not work** in the browser (no native HTTP to `192.168.100.1`). TLE loading still runs via the browser fallback where configured.

To preview the UI from another machine on your LAN:

```bash
npm run dev:host
```

Then open `http://<your-pc-ip>:1420` from another device. This is for layout/testing only, not a supported mobile product.

## Starlink dish alignment (desktop)

Dish telemetry is read over plain HTTP from the Starlink terminal at `http://192.168.100.1:9201`. The PC running SatX should be on the **Starlink Wi‑Fi** (or otherwise able to reach that address).

1. Run the desktop app: `npm run tauri:dev` or an installed build.
2. Allow **location** when prompted (used for boresight matching and the red ground marker).
3. Set **Object type** to **Starlink**.
4. In the Starlink strip, click **Fetch** (or **Refresh**).
5. The servicing satellite appears at the top of the list with a red outline; an orange rod links your location to that satellite on the globe.

If fetch fails, confirm you are in the native app (not browser-only dev) and connected to the dish network.

## Project layout (high level)

| Path | Role |
|------|------|
| `src/` | React UI, globe, propagation hooks |
| `src-tauri/` | Rust commands (TLE catalog, Starlink HTTP) |
| `scripts/tauri-dev.cmd` | Windows desktop dev entry |
| `scripts/ensure-tauri2.mjs` | Enforces Tauri 2.x dependency range |

## Not supported (yet)

- **iOS / Android** native apps and `npm run tauri:android:*` workflows
- Starlink alignment in browser-only `npm run dev`
- Phone/tablet as a primary target (no tested install path or store builds)

Experimental Android/iOS scaffolding may remain in the repo for future work; treat it as inactive until documented otherwise.
