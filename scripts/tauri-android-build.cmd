@echo off
setlocal

if exist "%ProgramFiles(x86)%\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" (
  call "%ProgramFiles(x86)%\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
) else if exist "%ProgramFiles%\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvars64.bat" (
  call "%ProgramFiles%\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvars64.bat"
) else (
  echo ERROR: Visual Studio Build Tools not found.
  exit /b 1
)

set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
cd /d "%~dp0.."

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-android-java.ps1"
if errorlevel 1 exit /b 1

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0apply-android-starlink.ps1"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0check-android-symlinks.ps1"
if errorlevel 1 exit /b 1

echo.
echo Building release APK (install on phone; use on Starlink Wi-Fi for dish)...
echo.

npm run tauri -- android build
