#!/usr/bin/env bash
# Package CI build artifacts into per-platform archives with README, LICENSE, and docs/.
# Usage: package-release-archives.sh <version-without-v> <artifacts-root> <output-dir>
# Example: package-release-archives.sh 0.2.0 artifacts release-upload

set -euo pipefail

VERSION="${1:?version required (e.g. 0.2.0)}"
ARTIFACTS="${2:?artifacts directory required}"
OUT="${3:?output directory required}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ARTIFACTS="$(cd "$ARTIFACTS" && pwd)"
OUT="$(mkdir -p "$OUT" && cd "$OUT" && pwd)"
STAGE="${OUT}/.staging"
rm -rf "$STAGE"
mkdir -p "$STAGE/windows" "$STAGE/macos" "$STAGE/linux"

echo "Packaging SatX ${VERSION}"
echo "  artifacts: $ARTIFACTS"
echo "  output:    $OUT"
echo "Artifact tree:"
find "$ARTIFACTS" -type f | sed 's/^/  /' || true

copy_docs() {
  local dest="$1"
  cp "$ROOT/README.md" "$ROOT/LICENSE" "$dest/"
  mkdir -p "$dest/docs"
  cp -r "$ROOT/docs/." "$dest/docs/"
  if [ -f "$ROOT/ACKNOWLEDGMENTS.md" ]; then
    cp "$ROOT/ACKNOWLEDGMENTS.md" "$dest/"
  fi
}

copy_macos_install_guide() {
  local dest="$1"
  if [ -f "$ROOT/docs/INSTALL-macos.md" ]; then
    cp "$ROOT/docs/INSTALL-macos.md" "$dest/INSTALL-macos.md"
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
  exit 1
fi

copy_docs "$STAGE/windows"
WIN_ZIP="${OUT}/SatX-${VERSION}-Windows-x64.zip"
rm -f "$WIN_ZIP"
(
  cd "$STAGE/windows"
  zip -r -q "$WIN_ZIP" .
)
echo "Created $WIN_ZIP ($(du -h "$WIN_ZIP" | cut -f1))"

# --- macOS ---
mac_dmg="$(find "$ARTIFACTS" -type f -name '*.dmg' 2>/dev/null | head -n 1 || true)"
if [ -z "$mac_dmg" ]; then
  echo "ERROR: No macOS .dmg under $ARTIFACTS"
  exit 1
fi
cp "$mac_dmg" "$STAGE/macos/SatX-${VERSION}-macOS.dmg"
copy_docs "$STAGE/macos"
copy_macos_install_guide "$STAGE/macos"
MAC_ZIP="${OUT}/SatX-${VERSION}-macOS.zip"
rm -f "$MAC_ZIP"
(
  cd "$STAGE/macos"
  zip -r -q "$MAC_ZIP" .
)
echo "Created $MAC_ZIP ($(du -h "$MAC_ZIP" | cut -f1))"

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
LINUX_TAR="${OUT}/SatX-${VERSION}-Linux-x64.tar.gz"
rm -f "$LINUX_TAR"
(
  cd "$STAGE/linux"
  tar -czf "$LINUX_TAR" .
)
echo "Created $LINUX_TAR ($(du -h "$LINUX_TAR" | cut -f1))"

rm -rf "$STAGE"
echo "Release archives in $OUT:"
ls -la "$OUT"
