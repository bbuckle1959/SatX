# Running SatX

SatX is a **Tauri 2** desktop app. Use the native shell for full features (including Starlink dish fetch). Browser-only `npm run dev` is optional and limited.

| Guide | Platform |
|-------|----------|
| [Windows](windows.md) | Windows 10/11 |
| [macOS](macos.md) | macOS 10.15 (Catalina) and later |
| [Linux](linux.md) | Debian, Ubuntu, Fedora, Arch, and derivatives |
| [Release builds](release-builds.md) | Installers for all three OS targets |

## Quick start (all desktop platforms)

From the repository root:

```bash
git clone <your-repo-url>
cd SatX
npm install
```

Then follow your platform guide for prerequisites and the exact dev/build command.

**Windows** uses `npm run tauri:dev` (wrapper script). **macOS and Linux** use `npm run tauri -- dev` because `tauri:dev` in `package.json` points at a Windows `.cmd` script.

## What you get

| Command | Result |
|---------|--------|
| Desktop dev | Native window + hot reload; Vite at `http://localhost:1420` |
| Desktop build | Release binary and installers under `src-tauri/target/release/bundle/` |
| `npm run dev` | Browser UI only — no Starlink dish API |

## Related docs

- [README.md](../../README.md) — features, Starlink workflow, project layout
- [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/) — upstream install details
