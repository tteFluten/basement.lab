@echo off
cd /d "%~dp0"
echo [Root] %CD%

where npm >nul 2>nul
if errorlevel 1 (
  set "NPM="
  if exist "C:\Program Files\nodejs\npm.cmd" set "NPM=C:\Program Files\nodejs\npm.cmd"
  if exist "%LOCALAPPDATA%\Programs\node\npm.cmd" set "NPM=%LOCALAPPDATA%\Programs\node\npm.cmd"
  if not defined NPM (
    echo Node.js / npm not found in PATH.
    echo Install Node.js from https://nodejs.org or run from Cursor: Ctrl+Shift+P -^> "Tasks: Run Task" -^> "Start Hub"
    pause
    exit /b 1
  )
) else (
  set "NPM=npm"
)

if not exist "hub\public\embed\cineprompt\index.html" (
  echo [Root] Building apps (first time or after changes)...
  call "%NPM%" run build:apps
  if errorlevel 1 (
    echo [Root] build:apps failed. Check errors above.
    pause
    exit /b 1
  )
  echo [Root] Apps built.
)

if not exist "hub\node_modules" (
  echo [Hub] Installing dependencies...
  cd hub
  call "%NPM%" install
  cd ..
)

echo [Hub] Starting. Open http://localhost:3000
echo.
cd hub
call "%NPM%" run dev
pause
