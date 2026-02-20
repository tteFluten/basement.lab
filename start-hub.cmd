@echo off
cd /d "%~dp0hub"
echo Starting Basement Lab Hub...
echo Open http://localhost:3000 in your browser.
echo Close this window to stop the server.
npm run dev
pause
