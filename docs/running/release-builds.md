# Release builds (Windows, macOS, Linux)

SatX uses [Tauri 2](https://v2.tauri.app/) bundling. **`bundle.targets` is `"all"`** in `src-tauri/tauri.conf.json`, so a successful release build on each OS produces that platform’s standard installers where Tauri supports them.

## Rule of thumb: build on the target OS

| Target | Build on |
|--------|----------|
| Windows `.exe` / MSI / NSIS | Windows |
| macOS `.app` / `.dmg` | macOS |
| Linux `.deb` / `.rpm` / AppImage | Linux (same family as your users when possible) |

Tauri does not support “one click, all three platforms” from a single Windows PC. Use **three builds** (local machines or CI runners) and ship the artifacts together.

Prerequisites for each OS match the dev guides:

- [Windows](windows.md)
- [macOS](macos.md)
- [Linux](linux.md)

## Before you build

1. **Install dependencies** for the OS you are building on (`npm install` at repo root).
2. **Bump version** (keep these in sync when releasing):
   - `package.json` → `"version"`
   - `src-tauri/tauri.conf.json` → `"version"`
   - `src-tauri/Cargo.toml` → `version`
3. **Verify Tauri 2 pins:**

   ```bash
   npm run ensure:tauri2
   ```

4. **Production frontend** — `tauri build` runs `beforeBuildCommand` (`npm run build`) automatically; you do not need a separate Vite step.

## Windows release

From an elevated or normal **Developer PowerShell / cmd** at the repo root:

```powershell
npm install
npm run tauri:build
```

`tauri:build` runs `scripts\tauri-dev.cmd build`, which loads **MSVC** then `npm run tauri -- build`.

### Output (typical)

```text
src-tauri\target\release\satx.exe          # exact name follows Cargo package name
src-tauri\target\release\bundle\
  msi\                                     # Windows Installer (if build succeeded)
  nsis\                                    # NSIS installer (if enabled)
```

Distribute the `.msi` / NSIS setup exe, or zip the release `.exe` for advanced users.

### Optional: code signing (Windows)

Unsigned builds run on your machine but may trigger SmartScreen for others. Sign the installer or binary with an Authenticode certificate. Tauri documents signing via environment variables and `tauri.conf.json` — see [Tauri — Windows code signing](https://v2.tauri.app/distribute/sign/windows/).

## macOS release

On a **Mac** with Xcode Command Line Tools and Rust installed:

```bash
npm install
npm run ensure:tauri2
npm run tauri -- build
```

### Output (typical)

```text
src-tauri/target/release/bundle/macos/SatX.app
src-tauri/target/release/bundle/dmg/SatX_0.1.0_*.dmg   # version in filename
```

Zip the `.app` or ship the `.dmg`.

### Optional: signing and notarization

For distribution outside your Mac, you need an **Apple Developer** ID, code signing, and **notarization**. Without it, Gatekeeper may block the app. See [Tauri — macOS code signing](https://v2.tauri.app/distribute/sign/macos/).

## Linux release

On a **Linux** host with WebKitGTK 4.1 dev packages installed (see [linux.md](linux.md)):

```bash
npm install
npm run ensure:tauri2
npm run tauri -- build
```

### Output (typical)

```text
src-tauri/target/release/<binary>
src-tauri/target/release/bundle/
  deb/          # on Debian/Ubuntu-style hosts
  rpm/          # on Fedora-style hosts (when tooling is available)
  appimage/     # when AppImage tooling is available
```

Not every format is produced on every distro; Tauri enables what your build environment supports.

**Compatibility:** A `.deb` built on Ubuntu 24.04 may not install cleanly on very old releases. Build on the oldest distro you intend to support, or ship **AppImage** for broader glibc-based systems.

## Build only specific bundle types (optional)

Edit `src-tauri/tauri.conf.json`:

```json
"bundle": {
  "active": true,
  "targets": ["msi", "nsis"]
}
```

Examples: `["dmg"]` on macOS, `["deb", "appimage"]` on Linux. See [Tauri bundle configuration](https://v2.tauri.app/reference/config/#bundleconfig).

## CI: GitHub Actions (all three OS)

Workflow: [`.github/workflows/release.yml`](../../.github/workflows/release.yml)

| Job | Runner | Command |
|-----|--------|---------|
| `build-windows` | `windows-latest` | `npm run tauri -- build` (MSVC preinstalled on runner) |
| `build-macos` | `macos-latest` | `npm run tauri -- build` |
| `build-linux` | `ubuntu-latest` | `npm run tauri -- build` + apt packages |
| `publish-release` | `ubuntu-latest` | Uploads artifacts to a GitHub Release |

### Trigger a release build

1. Bump version in `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`.
2. Commit and push to your default branch.
3. Create and push a version tag:

   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

4. Open **Actions** on GitHub and watch the **release** workflow.
5. When it finishes, open [Releases](https://github.com/bbuckle1959/SatX/releases) — you should see **up to five** clearly named installers (see [GitHub Releases layout](github-releases.md)).

Tags must match `v*` (e.g. `v0.1.0`, `v1.2.3-beta.1`).

### Manual download without a Release

Each build job also uploads artifacts (`satx-windows`, `satx-macos`, `satx-linux`) on the workflow run page for 90 days.

### Signing (optional)

Add repository secrets and extend the workflow when you are ready for public distribution:

- Windows: Authenticode — [Tauri Windows signing](https://v2.tauri.app/distribute/sign/windows/)
- macOS: `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, notarization — [Tauri macOS signing](https://v2.tauri.app/distribute/sign/macos/)

## Checklist per release

- [ ] Version bumped in `package.json`, `tauri.conf.json`, `Cargo.toml`
- [ ] `npm run ensure:tauri2` passes
- [ ] Built on **Windows**, **macOS**, and **Linux** (or CI equivalents)
- [ ] Smoke-tested each installer on a clean VM or machine
- [ ] Starlink **Fetch** tested on desktop build (optional; needs dish network)
- [ ] Release notes + artifacts uploaded ([GitHub Releases](https://github.com/bbuckle1959/SatX/releases), website, etc.)

## Troubleshooting

| Issue | Notes |
|-------|--------|
| Slow first build | Release Rust compile is large; CI caches `target/` and npm |
| Windows `link.exe` | Use `npm run tauri:build`, not raw `tauri build` without MSVC |
| macOS “damaged app” | Unsigned build — Open via right-click, or sign/notarize |
| Linux missing `webkit2gtk` | Install packages from [linux.md](linux.md) |
| MSI build fails | Enable VBSCRIPT optional feature on Windows (see [windows.md](windows.md)) |

[← Running overview](README.md)
