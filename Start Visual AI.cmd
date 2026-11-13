@echo off
setlocal
cd /d "%~dp0"
if not exist "node_modules\electron\dist\electron.exe" goto missing
if not exist "dist-electron\main.cjs" goto missing
if not exist "dist\index.html" goto missing
start "" "node_modules\electron\dist\electron.exe" "dist-electron\main.cjs"
exit /b 0

:missing
echo The build or Electron runtime is missing.
echo Install Node.js LTS and run npm ci and npm run build in this folder.
pause
exit /b 1
