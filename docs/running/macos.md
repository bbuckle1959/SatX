# Running SatX on macOS

## Requirements

- **macOS 10.15 (Catalina)** or later (Apple Silicon or Intel)
- **[Node.js](https://nodejs.org/)** LTS (includes npm)
- **[Rust](https://www.rust-lang.org/tools/install)** via [rustup](https://rustup.rs/)
- **Xcode Command Line Tools** (desktop builds only; full Xcode not required unless you target iOS)

SatX targets **Tauri 2.x only**. The repo runs `npm run ensure:tauri2` before Tauri commands.

## Install system dependencies

### Xcode Command Line Tools

```bash
xcode-select --install
```

Accept the dialog and wait for installation to finish.

### Rust

```bash
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh
source "$HOME/.cargo/env"
rustc -V
cargo -V
```

On Apple Silicon, rustup usually installs `aarch64-apple-darwin`. On Intel Macs, `x86_64-apple-darwin`.

### Node.js

Install LTS from [nodejs.org](https://nodejs.org/) or Homebrew:

```bash
brew install node
node -v
npm -v
```

## Clone and install the project

```bash
cd ~/path/to/SatX
npm install
```

## Development

On macOS, use the Tauri CLI via npm (the `tauri:dev` script in `package.json` is a Windows-only `.cmd` wrapper):

```bash
npm run ensure:tauri2
npm run tauri -- dev
```

The first run compiles Rust crates and may take several minutes. A native window opens when ready; the UI loads from `http://localhost:1420`.

Shortcut (runs `ensure:tauri2` via npm lifecycle if configured):

```bash
npm run pretauri:dev && npm run tauri -- dev
```

## Production build

```bash
npm run ensure:tauri2
npm run tauri -- build
```

Typical output locations:

```text
src-tauri/target/release/satx          # binary name may match crate/product name
src-tauri/target/release/bundle/
  macos/                               # .app bundle
  dmg/                                 # disk image (if DMG target is enabled)
```

Open the `.app` from Finder or run the binary from `target/release/`.

### Gatekeeper / unsigned builds

Locally built apps are often unsigned. If macOS blocks launch:

- Right-click the app → **Open**, or
- System Settings → **Privacy & Security** → allow the app.

For distribution outside your machine, you need Apple code signing and notarization (not covered here).

## Browser-only dev (limited)

```bash
npm run dev
```

Runs Vite in the browser at `http://localhost:1420`. **Starlink dish fetch does not work** without the Tauri shell.

LAN preview:

```bash
npm run dev:host
```

## Starlink dish alignment

1. Connect the Mac to **Starlink Wi‑Fi** (or a LAN that routes to `192.168.100.1`).
2. Run the **desktop** app (`npm run tauri -- dev` or a built `.app`).
3. Allow **location** when prompted.
4. Set **Object type** to **Starlink** and click **Fetch**.

Optional: **Ground infrastructure** toggles (gateways / PoPs). Servicing match uses satellites **≥25°** elevation at the dish. See the [User guide](../user-guide.md).

Check dish API reachability:

```bash
nc -zv 192.168.100.1 9201
```

Or:

```bash
curl -v --max-time 5 http://192.168.100.1:9201/
```

A connection (even an HTTP error response) suggests the dish is reachable.

## Troubleshooting

| Symptom | What to try |
|---------|-------------|
| `xcrun: error: invalid active developer path` | Run `xcode-select --install` |
| Rust / linker errors after OS upgrade | `xcode-select --reset` and reinstall CLT |
| `command not found: tauri` | Use `npm run tauri -- dev`, not global `tauri` |
| `ensure:tauri2` fails | Ensure `@tauri-apps/*` packages are 2.x |
| Starlink fetch fails | Dish Wi‑Fi, no VPN, test port 9201 |
| Rosetta / arch mismatch | Reinstall Rust toolchain for your CPU (`rustup show`) |

## npm scripts (macOS)

| Script | Purpose |
|--------|---------|
| `npm run tauri -- dev` | Desktop dev (**primary**) |
| `npm run tauri -- build` | Release build |
| `npm run dev` | Vite only (browser) |
| `npm run build` | Frontend typecheck + bundle only |
| `npm run ensure:tauri2` | Verify Tauri 2 pins |

[← All platforms](README.md)
