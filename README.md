# SatX Tracker

Desktop satellite tracker built with **Tauri 2**, React, TypeScript, Three.js, and `satellite.js`. It loads active TLEs, propagates orbits in a Web Worker, and renders objects on a 3D globe with a searchable sidebar.

**Supported platform:** Windows, macOS, and Linux desktop (Tauri shell).

**Not supported yet:** iOS/Android native apps, phone/tablet as a primary target, and Starlink dish fetch in browser-only dev. Responsive mobile UI code exists but is disabled (`MOBILE_UI_ENABLED` in `src/lib/features.ts`). Android/iOS scripts and scaffolding may remain in the repo for future work.

This project targets **Tauri 2.0+ only** (npm `>=2.0.0 <3.0.0`, Rust `>=2.0.0, <3`). Tauri 1 is not supported. `npm run ensure:tauri2` checks dependency pins before desktop builds.

## Features

- Live orbital propagation (4 Hz worker ticks, smoothed globe motion) with pause/resume and calc/render FPS metrics
- **Object type** filter (stations, navigation, debris, Starlink, and more)
- **Globe set** mode:
  - **Optimized (globe cap)** — propagates and prioritizes up to **16,000** objects (default; best performance on large catalogs)
  - **Full catalog** — propagates every object matching the current type filter (globe still draws at most 16,000 instances at once)
- Nearest-objects list (**50** entries) sorted by slant range when location is available
- Browser geolocation as a red ground marker
- Click or list-select for details; **non-Starlink** selections reframe the globe on that object
- **Starlink** (desktop app only, Starlink filter):
  - Fetch dish boresight from `http://192.168.100.1:9201`
  - Match to a servicing satellite; pin it at the top of the list (red outline)
  - Orange rod from your location to that satellite on the globe

## Running the app

Platform-specific install, dev, build, and troubleshooting:

- **[Windows](docs/running/windows.md)**
- **[macOS](docs/running/macos.md)**
- **[Linux](docs/running/linux.md)**
- [Overview](docs/running/README.md)

**Quick start:** `npm install`, then:

| Platform | Development | Production build |
|----------|-------------|------------------|
| Windows | `npm run tauri:dev` | `npm run tauri:build` |
| macOS / Linux | `npm run tauri -- dev` | `npm run tauri -- build` |

Windows uses `scripts/tauri-dev.cmd` to load MSVC before Rust compiles. The app opens as a native window with the Vite dev server on `http://localhost:1420`. Installers and binaries are under `src-tauri/target/release/bundle/`.

Prerequisites: [Node.js](https://nodejs.org/) LTS, [Rust](https://www.rust-lang.org/tools/install), and [Tauri 2 system deps](https://v2.tauri.app/start/prerequisites/) for your OS.

## Browser-only dev (limited)

```bash
npm run dev
```

Runs the frontend at `http://localhost:1420` without Tauri. Useful for UI and globe work, but **Starlink dish fetch does not work** in the browser (no native HTTP to `192.168.100.1`). TLE loading uses the browser fallback where configured.

LAN preview (layout/testing only):

```bash
npm run dev:host
```

Open `http://<your-pc-ip>:1420` from another device on the network.

## Starlink dish alignment (desktop)

Dish telemetry is read over plain HTTP from the Starlink terminal at `http://192.168.100.1:9201`. The PC running SatX should be on the **Starlink Wi‑Fi** (or otherwise able to reach that address).

1. Run the desktop app: `npm run tauri:dev` or an installed build.
2. Allow **location** when prompted (boresight matching and the red ground marker).
3. Set **Object type** to **Starlink**.
4. In the Starlink strip, click **Fetch** (or **Refresh**).
5. The servicing satellite appears at the top of the list with a red outline; an orange rod links your location to that satellite on the globe.

If fetch fails, confirm you are in the native app (not browser-only dev) and connected to the dish network.

## npm scripts

| Script | Purpose |
|--------|---------|
| `npm run tauri:dev` | Desktop dev (recommended) |
| `npm run tauri:build` | Desktop release build |
| `npm run dev` | Vite only (no Tauri) |
| `npm run dev:host` | Vite on LAN (`:1420`) |
| `npm run build` | Typecheck + production frontend bundle |
| `npm run ensure:tauri2` | Verify Tauri 2.x pins |
| `npm run tauri:android:dev` | Experimental; not a supported product path |

## Project layout

| Path | Role |
|------|------|
| `src/` | React UI, globe (`GlobeVisualizer`), hooks, workers |
| `src/lib/globeCatalog.ts` | Type filter, globe cap vs full catalog, display throttling |
| `src/lib/features.ts` | Feature flags (e.g. mobile UI) |
| `src/workers/orbitCalc.worker.ts` | SGP4 propagation off the main thread |
| `src-tauri/` | Rust: TLE catalog, Starlink HTTP (`get_dish_alignment`) |
| `docs/running/` | Windows, macOS, and Linux run guides |
| `scripts/tauri-dev.cmd` | Windows desktop dev/build wrapper |
| `scripts/ensure-tauri2.mjs` | Enforces Tauri 2.x dependency range |

## Not supported (yet)

- **iOS / Android** as installable apps (`tauri:android:*` is experimental)
- Starlink alignment in browser-only `npm run dev`
- Mobile bottom sheet and mobile globe budgets (code present, flag off)
