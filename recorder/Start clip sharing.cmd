@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 or newer is required. Install it from https://nodejs.org/
  pause
  exit /b 1
)
echo Bobble clip sharing - keep this window open while sharing.
echo No automatic uploads. Each clip needs your confirmation.
echo Public links expire. Save a local copy of anything important.
node tools\clip_host.cjs
pause
