@echo off
cd /d "%~dp0hub"
echo [Hub] Folder: %CD%

where npm >nul 2>nul
if errorlevel 1 (
  set "NPM="
  if exist "C:\Program Files\nodejs\npm.cmd" set "NPM=C:\Program Files\nodejs\npm.cmd"
  if exist "%LOCALAPPDATA%\Programs\node\npm.cmd" set "NPM=%LOCALAPPDATA%\Programs\node\npm.cmd"
  if not defined NPM (
    echo [Hub] Node.js / npm not found in PATH.
    echo Install Node.js from https://nodejs.org or run from Cursor: Ctrl+Shift+P -^> "Tasks: Run Task" -^> "Start Hub"
    pause
    exit /b 1
  )
  echo [Hub] Using: %NPM%
) else (
  set "NPM=npm"
)

if not exist "node_modules" (
  echo [Hub] Installing dependencies...
  call "%NPM%" install
  if errorlevel 1 (
    echo [Hub] npm install failed.
    pause
    exit /b 1
  )
  echo [Hub] Done.
)

echo [Hub] Starting... Open http://localhost:3000 when ready.
echo.
call "%NPM%" run dev
pause
