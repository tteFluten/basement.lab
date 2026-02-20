@echo off
cd /d "%~dp0"

:: Find npm
where npm >nul 2>nul
if errorlevel 1 (
  set "NPM="
  if exist "C:\Program Files\nodejs\npm.cmd" set "NPM=C:\Program Files\nodejs\npm.cmd"
  if exist "%LOCALAPPDATA%\Programs\node\npm.cmd" set "NPM=%LOCALAPPDATA%\Programs\node\npm.cmd"
  if not defined NPM (
    echo [!] Node.js / npm not found. Install from https://nodejs.org
    pause
    exit /b 1
  )
) else (
  set "NPM=npm"
)

:: Kill any leftover process on port 3000
echo [Hub] Cleaning port 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " ^| findstr "LISTENING"') do (
  taskkill /PID %%a /F /T >nul 2>nul
)

:: Root deps (concurrently)
if not exist "node_modules" (
  echo [Root] Installing root dependencies...
  call "%NPM%" install
)

:: Build apps if not built yet
if not exist "hub\public\embed\cineprompt\index.html" (
  echo [Hub] Building apps...
  call "%NPM%" run build:apps
  if errorlevel 1 (
    echo [!] build:apps failed.
    pause
    exit /b 1
  )
)

:: Hub deps
if not exist "hub\node_modules" (
  echo [Hub] Installing hub dependencies...
  call "%NPM%" install --prefix hub
)

echo.
echo [Hub] Starting on http://localhost:3000
echo      Press Ctrl+C to stop, then close this window.
echo.
call "%NPM%" run dev --prefix hub
pause
