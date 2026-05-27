# Running SatX on Linux

## Requirements

- A recent **64-bit** Linux distribution (glibc-based recommended)
- **[Node.js](https://nodejs.org/)** LTS (includes npm)
- **[Rust](https://www.rust-lang.org/tools/install)** via [rustup](https://rustup.rs/)
- **Tauri system libraries** (WebKitGTK and build tools) — packages vary by distribution

SatX targets **Tauri 2.x only**. The repo runs `npm run ensure:tauri2` before Tauri commands.

Official reference: [Tauri prerequisites — Linux](https://v2.tauri.app/start/prerequisites/).

## Install system dependencies

### Debian / Ubuntu / Linux Mint / Pop!_OS

```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

### Fedora

```bash
sudo dnf install \
  webkit2gtk4.1-devel \
  openssl-devel \
  curl \
  wget \
  file \
  libappindicator-gtk3-devel \
  librsvg2-devel \
  gcc \
  gcc-c++ \
  make
```

Package names may differ slightly on Fedora Rawhide; see [Awesome Tauri](https://github.com/tauri-apps/awesome-tauri) if your distro is not listed.

### Arch Linux

```bash
sudo pacman -S --needed \
  webkit2gtk-4.1 \
  base-devel \
  curl \
  wget \
  file \
  openssl \
  appmenu-gtk-module \
  libappindicator-gtk3 \
  librsvg
```

### openSUSE Tumbleweed / Leap

```bash
sudo zypper in \
  webkit2gtk3-devel \
  libopenssl-devel \
  curl \
  wget \
  file \
  libappindicator3-1 \
  librsvg-devel \
  gcc \
  gcc-c++ \
  make
```

On newer openSUSE versions, prefer **webkit2gtk-4.1** development packages if available (Tauri 2 expects 4.1).

## Install Rust and Node.js

### Rust

```bash
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh
source "$HOME/.cargo/env"
rustc -V
cargo -V
```

### Node.js

Use your distro packages, [nodejs.org](https://nodejs.org/), or [nvm](https://github.com/nvm-sh/nvm):

```bash
node -v
npm -v
```

## Clone and install the project

```bash
cd ~/path/to/SatX
npm install
```

## Development

On Linux, use the Tauri CLI via npm (the `tauri:dev` script in `package.json` is Windows-only):

```bash
npm run ensure:tauri2
npm run tauri -- dev
```

The first compile can take several minutes. A native window opens when ready; the UI is served from `http://localhost:1420`.

### Wayland vs X11

If the window fails to open on Wayland-only sessions, try running under XWayland or set your compositor’s compatibility flags. Issues are environment-specific; see [Tauri troubleshooting](https://v2.tauri.app/develop/debug/).

## Production build

```bash
npm run ensure:tauri2
npm run tauri -- build
```

Typical artifacts:

```text
src-tauri/target/release/<binary>
src-tauri/target/release/bundle/
  deb/          # Debian package (common on Ubuntu/Debian hosts)
  rpm/          # RPM (on Fedora hosts, if enabled)
  appimage/     # AppImage (if enabled)
```

Install the `.deb` / `.rpm` / AppImage from the `bundle` subdirectory, or run the release binary directly.

### Runtime libraries on other machines

Packages built on one distro may not run on another without matching WebKitGTK versions. Prefer building on the oldest target distro you support, or distribute AppImage/Flatpak (not configured in this repo by default).

## Browser-only dev (limited)

```bash
npm run dev
```

Runs Vite in the browser. **Starlink dish fetch does not work** without Tauri.

## Starlink dish alignment

1. Connect the machine to **Starlink Wi‑Fi** (or a network with route to `192.168.100.1`).
2. Run the **desktop** app (`npm run tauri -- dev` or an installed package).
3. Allow **location** when prompted.
4. Set **Object type** to **Starlink** and click **Fetch**.

Check dish API reachability:

```bash
nc -zv 192.168.100.1 9201
```

Or:

```bash
curl -v --max-time 5 http://192.168.100.1:9201/
```

## Troubleshooting

| Symptom | What to try |
|---------|-------------|
| `webkit2gtk` not found | Install `libwebkit2gtk-4.1-dev` (or distro equivalent) |
| `PKG_CONFIG_PATH` / pkg-config errors | Install `-dev` / `-devel` packages for WebKit and GTK |
| Missing `libssl` | Install `libssl-dev` / `openssl-devel` |
| `nproc` / linker OOM | Close other apps; `cargo build` is memory-heavy |
| `ensure:tauri2` fails | Pin `@tauri-apps/cli` and `@tauri-apps/api` to 2.x |
| Starlink fetch fails | Dish network, firewall, test port 9201 |
| Blank window | Update GPU drivers; try X11 session |

## npm scripts (Linux)

| Script | Purpose |
|--------|---------|
| `npm run tauri -- dev` | Desktop dev (**primary**) |
| `npm run tauri -- build` | Release build |
| `npm run dev` | Vite only (browser) |
| `npm run build` | Frontend typecheck + bundle only |
| `npm run ensure:tauri2` | Verify Tauri 2 pins |

[← All platforms](README.md)
