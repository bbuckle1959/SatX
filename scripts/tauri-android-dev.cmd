@echo off
setlocal

rem MSVC + Rust (same as desktop Tauri)
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

rem JAVA_HOME for Gradle
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-android-java.ps1"
if errorlevel 1 exit /b 1

rem Starlink HTTP (192.168.100.1) cleartext config
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0apply-android-starlink.ps1"

rem Tauri jniLibs step needs symlink privilege on Windows
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0check-android-symlinks.ps1"
if errorlevel 1 exit /b 1

echo.
echo Starting SatX on Android (LAN dev server + native Starlink APIs)...
echo  - Phone and PC must be on the same Wi-Fi for the dev UI.
echo  - For dish alignment, connect the phone to Starlink Wi-Fi (192.168.100.1).
echo.

npm run tauri -- android dev --host
