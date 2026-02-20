@echo off
cd /d "%~dp0hub"
echo [Hub] Folder: %CD%

if not exist "node_modules" (
  echo [Hub] Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo [Hub] npm install failed. Check that Node.js is installed.
    pause
    exit /b 1
  )
  echo [Hub] Done. Starting dev server...
)

echo [Hub] Starting dev server...
echo First time can take 1-2 minutes. Then open http://localhost:3000
echo.
npm run dev
pause
