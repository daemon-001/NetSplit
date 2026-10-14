@echo off
title NetSplit Launcher
echo Starting NetSplit Desktop Application...

:: Ensure background service is running
start /b "" "native\windows-service\NetSplitService.exe" --background

:: Start Electron desktop GUI
cmd /c "npm run desktop --workspace=@netsplit/desktop"
