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

## Mobile (iOS / Android) and Starlink dish HTTP

Dish alignment uses native Rust HTTP to `http://192.168.100.1:9201` (not HTTPS). Mobile OS policies must allow cleartext / local network access.

- **iOS:** `src-tauri/Info.ios.plist` (merged via `bundle.iOS.infoPlist` in `tauri.conf.json`). Grants local network usage text and App Transport Security exceptions.
- **Android:** After `npm run tauri android init`, follow `src-tauri/mobile/android/AndroidManifest.patch.md` and run `scripts/sync-android-network-config.ps1` to install `network_security_config.xml`.

See `src-tauri/mobile/android/AndroidManifest.patch.md` for exact `AndroidManifest.xml` edits.

### Android prerequisites (Windows)

`tauri android init` needs a **JDK** on `PATH` / `JAVA_HOME`. If you see `Java not found in PATH`:

1. Install [Android Studio](https://developer.android.com/studio) (recommended; includes JDK under `jbr` and the SDK), **or** JDK 17 only:
   ```powershell
   winget install Microsoft.OpenJDK.17
   ```
2. In the **same** PowerShell session (or set user env vars permanently):
   ```powershell
   .\scripts\setup-android-java.ps1
   npm run tauri android init
   ```
3. To persist `JAVA_HOME` after Android Studio install (adjust path if needed):
   ```powershell
   [Environment]::SetEnvironmentVariable(
     'JAVA_HOME',
     "$env:LOCALAPPDATA\Programs\Android\Android Studio\jbr",
     'User'
   )
   ```
   Restart the terminal, then run `npm run tauri android init` again.

Full checklist: [Tauri Android prerequisites](https://v2.tauri.app/start/prerequisites/#android).

### Full SatX + Starlink on your phone (Android)

The browser (`vite --host`) cannot call the dish API. Use the **native Android app** so Rust can reach `http://192.168.100.1:9201`.

**One-time**

1. Android Studio + JDK (`setup-android-java.ps1`)
2. `npm run tauri android init` (already done if `src-tauri/gen/android` exists)
3. **Windows:** enable **Developer Mode** so Tauri can symlink native libs into `jniLibs`  
   Settings → System → For developers → **Developer Mode** → On, then open a **new** terminal.  
   If the build fails with `Creation symbolic link is not allowed for this system`, run `.\scripts\check-android-symlinks.ps1` (it opens that settings page). The project must live on an **NTFS** drive (not exFAT/USB).
4. Enable **USB debugging** on the phone; install via USB or wireless ADB

**A — Live dev (UI from your PC over Wi‑Fi)**

Phone and PC on the **same Wi‑Fi** (home LAN). Dish alignment still requires the **phone on Starlink Wi‑Fi** (see B).

```powershell
npm run tauri:android:dev
```

This runs `tauri android dev --host`, starts Vite on your LAN IP, and installs a debug build on the device.

**B — Release APK (no PC; best for Starlink-only use)**

Build and install the APK; open SatX while the phone is on **Starlink Wi‑Fi**:

```powershell
npm run tauri:android:build
```

Install the APK from `src-tauri/gen/android/app/build/outputs/apk/`. Allow **location** and **local network** if prompted. Tap **Fetch** in the Starlink strip.

**iOS:** Requires macOS + Xcode: `npm run tauri -- ios dev --host` (same Starlink-on-phone rule for dish).
