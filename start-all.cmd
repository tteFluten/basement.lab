@echo off
cd /d "%~dp0"
echo [Root] Folder: %CD%

where npm >nul 2>nul
if errorlevel 1 (
  set "NPM="
  if exist "C:\Program Files\nodejs\npm.cmd" set "NPM=C:\Program Files\nodejs\npm.cmd"
  if exist "%LOCALAPPDATA%\Programs\node\npm.cmd" set "NPM=%LOCALAPPDATA%\Programs\node\npm.cmd"
  if not defined NPM (
    echo Node.js / npm not found in PATH.
    echo Install Node.js from https://nodejs.org or run from Cursor: Ctrl+Shift+P -^> "Tasks: Run Task" -^> "Start Hub + all apps"
    pause
    exit /b 1
  )
) else (
  set "NPM=npm"
)

if not exist "node_modules" (
  echo [Root] Installing dependencies...
  call "%NPM%" install
  if errorlevel 1 ( pause & exit /b 1 )
)
if not exist "hub\node_modules" (
  echo [Hub] Installing hub dependencies...
  cd hub
  call "%NPM%" install
  cd ..
)
echo [Root] Starting Hub + all apps. Hub: http://localhost:3000
echo.
call "%NPM%" run dev:all
pause
