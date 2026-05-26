# SatX Tracker

Satellite and space debris tracker built with **Tauri 2**, React, TypeScript, and `satellite.js`.

This project targets **Tauri 2.0+ only** (npm `>=2.0.0 <3.0.0`, Rust `>=2.0.0, <3`, config schema v2). Tauri 1 is not supported. `npm run ensure:tauri2` verifies dependency pins before desktop builds.

## Prerequisites

- [Node.js](https://nodejs.org/)
- [Rust](https://www.rust-lang.org/learn/get-started#installing-rust)
- [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS (WebView2 on Windows, etc.)

## Development

```bash
npm install
npm run tauri:dev
```

On Windows, use `tauri:dev` (not `tauri dev`) so the MSVC build environment is loaded before compiling Rust.

## Production build

```bash
npm run tauri:build
```

## Web-only dev (no Rust)

```bash
npm run dev
```

Opens the Vite frontend at `http://localhost:1420` without the Tauri shell.
