# Running SatX on Windows

## Requirements

- **Windows 10 or 11** (64-bit)
- **[Node.js](https://nodejs.org/)** LTS (includes npm)
- **[Rust](https://www.rust-lang.org/tools/install)** via [rustup](https://rustup.rs/) (default `x86_64-pc-windows-msvc` toolchain)
- **Microsoft C++ Build Tools** with the **Desktop development with C++** workload  
  - [Download Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) or install via Visual Studio 2022 Community with the same workload
- **[WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)** (Evergreen Bootstrapper) — usually already present on Windows 11

SatX targets **Tauri 2.x only**. The repo runs `npm run ensure:tauri2` before Tauri commands to verify dependency versions.

### Optional (MSI builds)

If `npm run tauri:build` fails when creating an MSI with errors mentioning `light.exe`, enable the **VBSCRIPT** optional Windows feature (Settings → Apps → Optional features → More Windows features).

## Install dependencies

1. Install Node.js LTS and restart PowerShell or Terminal.
2. Install Rust:

   ```powershell
   winget install Rustlang.Rustup
   ```

   Or use the installer from [rustup.rs](https://rustup.rs/). Open a **new** terminal after install.

3. Install C++ Build Tools (Desktop development with C++).
4. Confirm tools:

   ```powershell
   node -v
   npm -v
   rustc -V
   cargo -V
   ```

## Clone and install the project

```powershell
cd C:\path\to\SatX
npm install
```

## Development (recommended)

Use the npm script so MSVC is on `PATH` before Rust compiles:

```powershell
npm run tauri:dev
```

This runs `scripts\tauri-dev.cmd`, which:

1. Calls `vcvars64.bat` (Visual Studio 2022 Build Tools or Community)
2. Runs `npm run tauri -- dev`

The SatX window opens when the first Rust build finishes. The UI is served from `http://localhost:1420` inside WebView2.

**Do not** run bare `npx tauri dev` in a fresh shell unless you have already loaded the MSVC environment; linking errors (`link.exe` not found) are common otherwise.

### Alternative (manual MSVC environment)

```powershell
# Adjust path if you use Community vs Build Tools
& "${env:ProgramFiles(x86)}\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
cd C:\path\to\SatX
npm run tauri -- dev
```

## Production build

```powershell
npm run tauri:build
```

Artifacts are typically under:

```text
src-tauri\target\release\
src-tauri\target\release\bundle\
  msi\          # Windows installer (if bundling succeeded)
  nsis\         # NSIS installer (if enabled in Tauri config)
```

Run the `.exe` from `src-tauri\target\release\` or install via the generated installer.

## Browser-only dev (limited)

```powershell
npm run dev
```

Opens the frontend in your default browser. **Starlink dish fetch does not work** in this mode (no Tauri HTTP to `192.168.100.1`).

## Starlink dish alignment

1. Connect the PC to **Starlink Wi‑Fi** (or a network that can reach `192.168.100.1`).
2. Run the **desktop** app (`npm run tauri:dev` or an installed build).
3. Allow **location** when prompted.
4. Set **Object type** to **Starlink** and click **Fetch**.

Verify dish reachability:

```powershell
Test-NetConnection -ComputerName 192.168.100.1 -Port 9201
```

`TcpTestSucceeded : True` indicates the dish API is reachable.

## Troubleshooting

| Symptom | What to try |
|---------|-------------|
| `link.exe` / MSVC not found | Use `npm run tauri:dev`, or run `vcvars64.bat` first |
| WebView2 missing | Install [WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) |
| `ensure:tauri2` fails | Upgrade `@tauri-apps/cli` and `@tauri-apps/api` to 2.x in `package.json` |
| Starlink fetch timeout | Confirm dish Wi‑Fi, disable VPN, test port 9201 (above) |
| Port 1420 in use | Stop other Vite processes or change port in `vite.config` / `tauri.conf.json` |

## npm scripts (Windows)

| Script | Purpose |
|--------|---------|
| `npm run tauri:dev` | Dev with MSVC wrapper (**use this**) |
| `npm run tauri:build` | Release build with MSVC wrapper |
| `npm run dev` | Vite only (browser) |
| `npm run ensure:tauri2` | Check Tauri 2 dependency pins |

[← All platforms](README.md)
