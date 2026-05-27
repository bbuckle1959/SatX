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
if ($text -notmatch 'ACCESS_FINE_LOCATION') {
  $text = $text -replace '(<uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />)',
    "`$1`r`n    <uses-permission android:name=`"android.permission.ACCESS_COARSE_LOCATION`" />`r`n    <uses-permission android:name=`"android.permission.ACCESS_FINE_LOCATION`" />"
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

$mainActivity = Join-Path $gen 'java\com\satx\tracker\MainActivity.kt'
if (Test-Path $mainActivity) {
  $kotlin = Get-Content $mainActivity -Raw
  if ($kotlin -notmatch 'requestLocationIfNeeded') {
    @'
package com.satx.tracker

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.activity.enableEdgeToEdge
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    requestLocationIfNeeded()
  }

  private fun requestLocationIfNeeded() {
    val fine = Manifest.permission.ACCESS_FINE_LOCATION
    val coarse = Manifest.permission.ACCESS_COARSE_LOCATION
    val hasFine =
      ContextCompat.checkSelfPermission(this, fine) == PackageManager.PERMISSION_GRANTED
    val hasCoarse =
      ContextCompat.checkSelfPermission(this, coarse) == PackageManager.PERMISSION_GRANTED
    if (!hasFine && !hasCoarse) {
      ActivityCompat.requestPermissions(this, arrayOf(fine, coarse), LOCATION_REQUEST_CODE)
    }
  }

  companion object {
    private const val LOCATION_REQUEST_CODE = 9021
  }
}

'@ | Set-Content -Path $mainActivity -NoNewline
  }
}

Write-Host '[apply-android-starlink] Starlink + location config applied.' -ForegroundColor Green
