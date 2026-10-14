@echo off
title NetSplit Launcher
echo Starting NetSplit Desktop Application...

:: Check if NetSplitService is already running
tasklist /FI "IMAGENAME eq NetSplitService.exe" 2>NUL | find /I /N "NetSplitService.exe">NUL
if "%ERRORLEVEL%"=="1" (
    echo Starting NetSplit background routing daemon...
    start /b "" "native\windows-service\NetSplitService.exe" --background
)

:: Start Electron desktop GUI
cmd /c "npm run desktop --workspace=@netsplit/desktop"
