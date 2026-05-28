# Running SatX

SatX is a **Tauri 2** desktop app. Use the native shell for full features (including Starlink dish fetch). Browser-only `npm run dev` is optional and limited.

| Guide | Platform |
|-------|----------|
| [Windows](windows.md) | Windows 10/11 |
| [macOS](macos.md) | macOS 10.15 (Catalina) and later |
| [Linux](linux.md) | Debian, Ubuntu, Fedora, Arch, and derivatives |
| [Release builds](release-builds.md) | Installers for all three OS targets |
| [GitHub Releases layout](github-releases.md) | Clean up crowded release pages |
| [Reset a release](reset-release.md) | Delete and publish again |

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
| `npm run sync:ground-stations` | Refresh bundled gateway/PoP JSON from Hugging Face |

## Related docs

- [User guide](../user-guide.md) — everyday use (non-technical)
- [Application overview](../application-overview.md) — features and behavior
- [README.md](../../README.md) — project entry point
- [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/) — upstream install details
