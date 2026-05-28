#!/usr/bin/env bash
# Package CI build artifacts into per-platform archives with README, LICENSE, and docs/.
# Usage: package-release-archives.sh <version-without-v> <artifacts-root> <output-dir>
# Example: package-release-archives.sh 0.2.0 artifacts release-upload

set -euo pipefail

VERSION="${1:?version required (e.g. 0.2.0)}"
ARTIFACTS="${2:?artifacts directory required}"
OUT="${3:?output directory required}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAGE="${OUT}/.staging"
rm -rf "$STAGE" "$OUT"
mkdir -p "$STAGE/windows" "$STAGE/macos" "$STAGE/linux" "$OUT"

copy_docs() {
  local dest="$1"
  cp "$ROOT/README.md" "$ROOT/LICENSE" "$dest/"
  mkdir -p "$dest/docs"
  cp -r "$ROOT/docs/." "$dest/docs/"
  if [ -f "$ROOT/ACKNOWLEDGMENTS.md" ]; then
    cp "$ROOT/ACKNOWLEDGMENTS.md" "$dest/"
  fi
}

# --- Windows ---
win_msi="$(find "$ARTIFACTS" -type f -name '*.msi' 2>/dev/null | head -n 1 || true)"
win_exe="$(find "$ARTIFACTS" -type f \( -name '*-setup.exe' -o -name '*setup.exe' \) 2>/dev/null | head -n 1 || true)"

if [ -n "$win_msi" ]; then
  cp "$win_msi" "$STAGE/windows/SatX-${VERSION}-Windows-x64.msi"
fi
if [ -n "$win_exe" ]; then
  cp "$win_exe" "$STAGE/windows/SatX-${VERSION}-Windows-x64-Setup.exe"
fi

if [ ! -f "$STAGE/windows/SatX-${VERSION}-Windows-x64.msi" ] && \
   [ ! -f "$STAGE/windows/SatX-${VERSION}-Windows-x64-Setup.exe" ]; then
  echo "ERROR: No Windows installers under $ARTIFACTS"
  find "$ARTIFACTS" -type f | head -20 || true
  exit 1
fi

copy_docs "$STAGE/windows"
(
  cd "$STAGE/windows"
  zip -r "$OUT/SatX-${VERSION}-Windows-x64.zip" .
)
echo "Created $OUT/SatX-${VERSION}-Windows-x64.zip"
unzip -l "$OUT/SatX-${VERSION}-Windows-x64.zip" | head -20

# --- macOS ---
mac_dmg="$(find "$ARTIFACTS" -type f -name '*.dmg' 2>/dev/null | head -n 1 || true)"
if [ -z "$mac_dmg" ]; then
  echo "ERROR: No macOS .dmg under $ARTIFACTS"
  exit 1
fi
cp "$mac_dmg" "$STAGE/macos/SatX-${VERSION}-macOS.dmg"
copy_docs "$STAGE/macos"
(
  cd "$STAGE/macos"
  zip -r "$OUT/SatX-${VERSION}-macOS.zip" .
)
echo "Created $OUT/SatX-${VERSION}-macOS.zip"
unzip -l "$OUT/SatX-${VERSION}-macOS.zip" | head -20

# --- Linux ---
linux_deb="$(find "$ARTIFACTS" -type f -name '*.deb' 2>/dev/null | head -n 1 || true)"
linux_app="$(find "$ARTIFACTS" -type f -name '*.AppImage' 2>/dev/null | head -n 1 || true)"

if [ -n "$linux_deb" ]; then
  cp "$linux_deb" "$STAGE/linux/SatX-${VERSION}-Linux-x64.deb"
fi
if [ -n "$linux_app" ]; then
  cp "$linux_app" "$STAGE/linux/SatX-${VERSION}-Linux-x64.AppImage"
fi

if [ ! -f "$STAGE/linux/SatX-${VERSION}-Linux-x64.deb" ] && \
   [ ! -f "$STAGE/linux/SatX-${VERSION}-Linux-x64.AppImage" ]; then
  echo "ERROR: No Linux .deb or AppImage under $ARTIFACTS"
  exit 1
fi

copy_docs "$STAGE/linux"
(
  cd "$STAGE/linux"
  tar -czf "$OUT/SatX-${VERSION}-Linux-x64.tar.gz" .
)
echo "Created $OUT/SatX-${VERSION}-Linux-x64.tar.gz"
tar -tzf "$OUT/SatX-${VERSION}-Linux-x64.tar.gz" | head -20

rm -rf "$STAGE"
echo "Release archives ready in $OUT:"
ls -la "$OUT"
