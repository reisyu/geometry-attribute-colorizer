@echo off
rem ---------------------------------------------------------------
rem  Build the offline distribution folder (dist).
rem  Double-click this file; no terminal knowledge needed.
rem  It just calls tools/build_offline.js.
rem
rem  Keep this file ASCII-only. cmd.exe reads batch files with the
rem  system codepage, so Japanese text here is mojibake and its
rem  wrapped lines get executed as commands.
rem  (Japanese output from node is fine: chcp 65001 handles it.)
rem ---------------------------------------------------------------
chcp 65001 > nul
cd /d "%~dp0"

where node > nul 2>&1
if errorlevel 1 (
  echo.
  echo [ERROR] Node.js not found.
  echo         Install from https://nodejs.org/ and run this again.
  echo.
  pause
  exit /b 1
)

echo.
echo Building offline package...
echo.
node tools\build_offline.js
if errorlevel 1 (
  echo.
  echo [ERROR] Build failed.
  echo.
  pause
  exit /b 1
)

echo.
echo Done. Copy the "dist" folder to a USB drive.
echo.
pause
