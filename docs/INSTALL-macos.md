# Installing SatX on macOS (GitHub release)

If macOS says SatX is **“damaged”** or **“can’t be opened”**, the download is usually fine. Apple blocks apps that are **not signed with an Apple Developer certificate** when they come from the internet. SatX releases from GitHub Actions are currently **unsigned** (see [Release builds — macOS signing](running/release-builds.md)).

## Install steps

1. Download **`SatX-*-macOS.zip`** from [Releases](https://github.com/bbuckle1959/SatX/releases) and extract it.
2. Open **`SatX-*-macOS.dmg`** inside the folder.
3. Drag **SatX** (or **SatX Tracker**) into **Applications**.
4. Eject the disk image.

## First launch (avoid “damaged”)

Do **not** double-click the app the first time if macOS shows a warning.

**Recommended:**

1. Open **Applications** in Finder.
2. **Control-click** (or right-click) **SatX** → **Open**.
3. Click **Open** in the dialog (you may need to do this once).

**Alternative (Terminal):**

```bash
xattr -cr /Applications/SatX.app
open -a SatX
```

If the app bundle has a different name on disk, adjust the path (e.g. `SatX Tracker.app`).

## If macOS still refuses to open

1. **System Settings** → **Privacy & Security** → scroll to the security message about SatX → **Open Anyway** (if shown).
2. Confirm you downloaded from the official [bbuckle1959/SatX releases](https://github.com/bbuckle1959/SatX/releases) page, not a re-hosted copy.
3. On **Apple Silicon**, ensure you did not copy only part of the `.app` bundle (always drag the whole app from the `.dmg`).

## For maintainers: signed / notarized builds

To stop Gatekeeper warnings for end users, ship a **Developer ID signed and notarized** `.dmg` or `.app`. See [Tauri — macOS code signing](https://v2.tauri.app/distribute/sign/macos/) and [release-builds.md](running/release-builds.md).
