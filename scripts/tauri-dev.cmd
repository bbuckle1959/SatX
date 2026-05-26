@echo off
setlocal

rem Load MSVC linker/libs (required for Rust on Windows)
if exist "%ProgramFiles(x86)%\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" (
  call "%ProgramFiles(x86)%\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
) else if exist "%ProgramFiles%\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvars64.bat" (
  call "%ProgramFiles%\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvars64.bat"
) else (
  echo ERROR: Visual Studio Build Tools not found. Install MSVC Build Tools with C++ workload.
  exit /b 1
)

set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
cd /d "%~dp0.."
if /I "%1"=="build" (
  npm run tauri -- build
) else (
  npm run tauri -- dev
)
