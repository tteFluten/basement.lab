@echo off
cd /d "%~dp0"
echo [Root] Folder: %CD%

if not exist "node_modules" (
  echo [Root] Installing root dependencies...
  call npm install
  if errorlevel 1 (
    echo [Root] npm install failed.
    pause
    exit /b 1
  )
)
if not exist "hub\node_modules" (
  echo [Hub] Installing hub dependencies...
  call cd hub && npm install && cd ..
)
echo [Root] Starting Hub + all apps...
echo Hub: http://localhost:3000
echo When you see "Ready" or port numbers, open the URL above.
echo.
npm run dev:all
pause
