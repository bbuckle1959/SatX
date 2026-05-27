# Organizing GitHub Releases

GitHub Releases show a **flat list** of download files — there are no folders. A crowded release usually means too many assets were uploaded (duplicate installers, portable `.exe` plus MSI, or an entire `.app` bundle unpacked as hundreds of files).

## What SatX publishes (from CI)

On each `v*` tag, [`.github/workflows/release.yml`](../../.github/workflows/release.yml) attaches **at most five** renamed files:

| File | Platform |
|------|----------|
| `SatX-{version}-Windows-x64.msi` | Windows (recommended) |
| `SatX-{version}-Windows-x64-Setup.exe` | Windows (NSIS alternative) |
| `SatX-{version}-macOS.dmg` | macOS |
| `SatX-{version}-Linux-x64.deb` | Linux (Debian/Ubuntu) |
| `SatX-{version}-Linux-x64.AppImage` | Linux (if the build produced one) |

The release **description** includes a table that matches these names so users are not guessing.

## Start over (delete release + tag)

See **[reset-release.md](reset-release.md)** for delete steps and a clean `v0.1.0` (or new version) publish.

## Fixing an existing crowded release

1. Open **Releases** → select the release → **Edit**.
2. Under **Attach binaries**, **delete** duplicate or wrong assets:
   - Raw `satx.exe` if you already have MSI/setup (optional keep one portable with a clear name).
   - Any file under a `.app` path or hundreds of small macOS bundle files.
   - Duplicate uploads from manual drag-and-drop plus CI.
3. Replace with the staged files above (from CI artifacts or local `bundle/` builds).
4. Replace the description with the download table from the latest workflow run (or copy from [README release template](https://github.com/bbuckle1959/SatX/blob/main/.github/workflows/release.yml) `release-notes` step).
5. Turn off **“Generate release notes”** if GitHub added a long auto changelog you do not want.

## Manual upload (local Windows build)

After `npm run tauri:build`, upload **only**:

- `src-tauri\target\release\bundle\msi\SatX_*_x64_en-US.msi` → rename to `SatX-0.1.0-Windows-x64.msi`
- `src-tauri\target\release\bundle\nsis\*-setup.exe` → rename to `SatX-0.1.0-Windows-x64-Setup.exe`

Skip uploading `src-tauri\target\release\satx.exe` unless you intentionally offer a portable zip with a README note.

## Optional: fewer Windows installers

To ship **only MSI** on Windows, set in `src-tauri/tauri.conf.json`:

```json
"bundle": {
  "active": true,
  "targets": ["msi", "dmg", "deb", "appimage"]
}
```

Then update the Windows artifact paths in `release.yml` accordingly.

## README link for users

Point end users to **one** place:

```markdown
[Download the latest release](https://github.com/bbuckle1959/SatX/releases) — use the table in the release notes.
```

[← Running overview](README.md)
