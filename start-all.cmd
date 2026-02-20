@echo off
cd /d "%~dp0"
echo Starting Hub + all apps...
echo Hub: http://localhost:3000
echo Apps: 5173-5177 (CinePrompt, POV, Chronos, Swag, Avatar)
echo Close this window to stop everything.
npm run dev:all
pause
