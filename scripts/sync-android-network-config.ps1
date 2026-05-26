# Copies Starlink-friendly network_security_config.xml into the generated Android tree.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$src = Join-Path $root 'src-tauri\mobile\android\res\xml\network_security_config.xml'
$destDir = Join-Path $root 'src-tauri\gen\android\app\src\main\res\xml'
$dest = Join-Path $destDir 'network_security_config.xml'

if (-not (Test-Path $src)) {
  Write-Error "Missing source: $src"
}

if (-not (Test-Path (Join-Path $root 'src-tauri\gen\android'))) {
  Write-Host 'Run `npm run tauri android init` first, then re-run this script.'
  exit 1
}

New-Item -ItemType Directory -Force -Path $destDir | Out-Null
Copy-Item -Force $src $dest
Write-Host "Copied network_security_config.xml -> $dest"
Write-Host 'Next: set android:usesCleartextTraffic="true" and android:networkSecurityConfig="@xml/network_security_config" on <application> in AndroidManifest.xml (see src-tauri/mobile/android/AndroidManifest.patch.md).'
