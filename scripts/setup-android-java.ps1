# Detect JDK for Tauri Android builds and set JAVA_HOME for this session.
# Run from repo root:  .\scripts\setup-android-java.ps1

$ErrorActionPreference = 'Stop'

$candidates = @(
  $env:JAVA_HOME,
  "$env:LOCALAPPDATA\Programs\Android\Android Studio\jbr",
  "${env:ProgramFiles}\Android\Android Studio\jbr",
  "${env:ProgramFiles(x86)}\Android\Android Studio\jbr",
  "${env:ProgramFiles}\Android\Android Studio1\jbr",
  "${env:ProgramFiles}\Java\jdk-17",
  "${env:ProgramFiles}\Java\jdk-21",
  "${env:ProgramFiles}\Eclipse Adoptium\jdk-17*",
  "${env:ProgramFiles}\Microsoft\jdk-17*"
) | Where-Object { $_ -and (Test-Path $_) }

foreach ($pattern in @(
  "${env:ProgramFiles}\Eclipse Adoptium\jdk-17*",
  "${env:ProgramFiles}\Microsoft\jdk-17*"
)) {
  $resolved = Get-Item $pattern -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
  if ($resolved) { $candidates += $resolved.FullName }
}

$javaHome = $null
foreach ($dir in $candidates) {
  $javaExe = Join-Path $dir 'bin\java.exe'
  if (Test-Path $javaExe) {
    $javaHome = $dir
    break
  }
}

if (-not $javaHome) {
  Write-Host ''
  Write-Host 'No JDK found. Install one of the following, then re-run this script:' -ForegroundColor Yellow
  Write-Host ''
  Write-Host '  1. Android Studio (recommended — includes JDK + Android SDK):'
  Write-Host '     https://developer.android.com/studio'
  Write-Host ''
  Write-Host '  2. Microsoft OpenJDK 17 (JDK only; you still need Android SDK):'
  Write-Host '     winget install Microsoft.OpenJDK.17'
  Write-Host ''
  Write-Host 'After install, set permanently (PowerShell as you):'
  Write-Host '  [Environment]::SetEnvironmentVariable("JAVA_HOME", "<path-to-jdk>", "User")'
  Write-Host ''
  exit 1
}

$env:JAVA_HOME = $javaHome
$env:Path = "$javaHome\bin;$env:Path"

Write-Host "JAVA_HOME=$javaHome" -ForegroundColor Green
& "$javaHome\bin\java.exe" -version

$studioSdk = "$env:LOCALAPPDATA\Android\Sdk"
if (Test-Path $studioSdk) {
  if (-not $env:ANDROID_HOME) {
    $env:ANDROID_HOME = $studioSdk
    $env:Path = "$studioSdk\platform-tools;$studioSdk\cmdline-tools\latest\bin;$env:Path"
    Write-Host "ANDROID_HOME=$studioSdk" -ForegroundColor Green
  }
} else {
  Write-Host ''
  Write-Host 'Android SDK not found. Install Android Studio and open SDK Manager once,' -ForegroundColor Yellow
  Write-Host "or set ANDROID_HOME to your SDK path (expected: $studioSdk)"
}

Write-Host ''
Write-Host 'Environment is ready for this terminal session. Next:' -ForegroundColor Cyan
Write-Host '  npm run tauri android init'
