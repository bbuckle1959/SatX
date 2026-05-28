# Organizing GitHub Releases

GitHub Releases show a **flat list** of download files — there are no folders. A crowded release usually means too many assets were uploaded (duplicate installers, portable `.exe` plus MSI, or an entire `.app` bundle unpacked as hundreds of files).

## What SatX publishes (from CI)

On each `v*` tag, [`.github/workflows/release.yml`](../../.github/workflows/release.yml) attaches **three platform archives**. Each archive contains that platform’s installer(s), plus **`README.md`**, **`LICENSE`**, **`ACKNOWLEDGMENTS.md`**, and the full **`docs/`** folder from the repository.

| File | Platform | Format |
|------|----------|--------|
| `SatX-{version}-Windows-x64.zip` | Windows | ZIP (MSI + NSIS Setup.exe + README + LICENSE + docs/) |
| `SatX-{version}-macOS.zip` | macOS | ZIP (`.dmg` + README + LICENSE + docs/) |
| `SatX-{version}-Linux-x64.tar.gz` | Linux | gzip tar (`.deb`, optional AppImage + README + LICENSE + docs/) |

Packaging is done by [`scripts/package-release-archives.sh`](../../scripts/package-release-archives.sh) in the **publish-release** job. **You must push this script and an updated `release.yml` to `main` before tagging** — older workflow runs only uploaded loose installers.

After downloading, extract the archive, then run the installer inside (e.g. double-click the `.msi` or `.dmg`).

The release **description** includes a table that matches these names.

## Start over (delete release + tag)

See **[reset-release.md](reset-release.md)** for delete steps and a clean tag publish (e.g. `v0.2.0`).

## Fixing an existing crowded release

1. Open **Releases** → select the release → **Edit**.
2. Under **Attach binaries**, **delete** duplicate or wrong assets:
   - Loose MSI/EXE/DMG files if you now ship only the three platform archives.
   - Raw `satx.exe` or unpacked `.app` contents.
   - Duplicate uploads from manual drag-and-drop plus CI.
3. Replace with the three archives from CI artifacts or a local repack (see below).
4. Replace the description with the download table from the latest workflow run.
5. Turn off **“Generate release notes”** if GitHub added a long auto changelog you do not want.

## Manual upload (local Windows build)

After `npm run tauri:build`, create a folder and zip it:

```powershell
$v = "0.2.0"
$dir = "SatX-$v-Windows-x64"
New-Item -ItemType Directory -Force -Path $dir
Copy-Item README.md, LICENSE, $dir
Copy-Item src-tauri\target\release\bundle\msi\*.msi "$dir\SatX-$v-Windows-x64.msi"
Copy-Item src-tauri\target\release\bundle\nsis\*-setup.exe "$dir\SatX-$v-Windows-x64-Setup.exe"
Compress-Archive -Path $dir\* -DestinationPath "SatX-$v-Windows-x64.zip"
```

Upload **`SatX-{version}-Windows-x64.zip`** only (not loose installers), unless you intentionally offer both.

## Optional: fewer Windows installers

To ship **only MSI** inside the Windows zip, set in `src-tauri/tauri.conf.json`:

```json
"bundle": {
  "active": true,
  "targets": ["msi", "dmg", "deb", "appimage"]
}
```

Then remove the NSIS copy loop from `release.yml` if you drop NSIS from the build.

## README link for users

Point end users to **one** place:

```markdown
[Download the latest release](https://github.com/bbuckle1959/SatX/releases) — download the zip/tar.gz for your OS, extract, then run the installer inside.
```

[← Running overview](README.md)
