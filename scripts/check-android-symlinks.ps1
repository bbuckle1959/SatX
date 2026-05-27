# Verify Windows can create symlinks (required by Tauri Android jniLibs step).
$ErrorActionPreference = 'Stop'

function Test-SatxSymlinkPrivilege {
  $dir = Join-Path $env:TEMP "satx-symlink-test-$PID"
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  try {
    $src = Join-Path $dir 'source.txt'
    'satx' | Set-Content -Path $src -Encoding ascii
    $link = Join-Path $dir 'link.txt'
    if (Test-Path $link) { Remove-Item -Force $link }
    New-Item -ItemType SymbolicLink -Path $link -Target $src -Force | Out-Null
    return (Test-Path $link)
  } catch {
    return $false
  } finally {
    Remove-Item -Recurse -Force $dir -ErrorAction SilentlyContinue
  }
}

$drive = (Split-Path -Qualifier (Resolve-Path (Join-Path $PSScriptRoot '..'))).TrimEnd(':')
$vol = Get-Volume -DriveLetter $drive -ErrorAction SilentlyContinue
if ($vol -and $vol.FileSystem -notin @('NTFS', 'ReFS')) {
  Write-Host "[check-android-symlinks] WARNING: Project drive $drive is $($vol.FileSystem). Android builds need NTFS (move repo off USB/exFAT)." -ForegroundColor Yellow
}

if (Test-SatxSymlinkPrivilege) {
  Write-Host '[check-android-symlinks] Symlink test OK — Android build can proceed.' -ForegroundColor Green
  exit 0
}

Write-Host ''
Write-Host '[check-android-symlinks] Symlinks are blocked on this PC.' -ForegroundColor Red
Write-Host 'Tauri links libsatx_lib.so into jniLibs with a symlink; without that privilege the Android build fails.'
Write-Host ''
Write-Host 'Fix (pick one):'
Write-Host '  1. Enable Developer Mode (recommended):'
Write-Host '       Settings -> System -> For developers -> Developer Mode -> On'
Write-Host '     Then close this terminal, open a new one, and run the build again.'
Write-Host '  2. Or run your terminal as Administrator once for the build.'
Write-Host ''
Write-Host 'Opening Developer settings...'
Start-Process 'ms-settings:developers'
exit 1
