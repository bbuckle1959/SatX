# Re-apply Starlink LAN HTTP settings after `tauri android init` regenerates files.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$gen = Join-Path $root 'src-tauri\gen\android\app\src\main'
$manifest = Join-Path $gen 'AndroidManifest.xml'

& (Join-Path $PSScriptRoot 'sync-android-network-config.ps1')

if (-not (Test-Path $manifest)) {
  Write-Error "Missing $manifest — run: npm run tauri android init"
}

$text = Get-Content $manifest -Raw
if ($text -notmatch 'ACCESS_NETWORK_STATE') {
  $text = $text -replace '(<uses-permission android:name="android.permission.INTERNET" />)',
    "`$1`r`n    <uses-permission android:name=`"android.permission.ACCESS_NETWORK_STATE`" />`r`n    <uses-permission android:name=`"android.permission.ACCESS_WIFI_STATE`" />"
}
$text = $text -replace 'android:usesCleartextTraffic="\$\{usesCleartextTraffic\}"',
  'android:usesCleartextTraffic="true"`r`n        android:networkSecurityConfig="@xml/network_security_config"'
if ($text -notmatch 'networkSecurityConfig') {
  $text = $text -replace '(android:usesCleartextTraffic="true")',
    '$1`r`n        android:networkSecurityConfig="@xml/network_security_config"'
}
Set-Content -Path $manifest -Value $text -NoNewline

$gradle = Join-Path $root 'src-tauri\gen\android\app\build.gradle.kts'
if (Test-Path $gradle) {
  $g = Get-Content $gradle -Raw
  $g = $g -replace 'manifestPlaceholders\["usesCleartextTraffic"\] = "false"',
    'manifestPlaceholders["usesCleartextTraffic"] = "true"'
  if ($g -notmatch 'getByName\("release"\)[\s\S]*?usesCleartextTraffic') {
    $g = $g -replace '(getByName\("release"\) \{)',
      '$1`r`n            manifestPlaceholders["usesCleartextTraffic"] = "true"'
  }
  Set-Content -Path $gradle -Value $g -NoNewline
}

Write-Host '[apply-android-starlink] Starlink HTTP config applied.' -ForegroundColor Green
