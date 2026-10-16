@echo off
title NetSplit
echo Starting NetSplit Desktop Application...

:: Start Electron desktop GUI
cmd /c "npm run desktop --workspace=@netsplit/desktop"
