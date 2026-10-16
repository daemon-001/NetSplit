# NetSplit Release Packaging Script
# Builds native binaries, compiles frontend, runs test suite, and bundles standalone release.

$ErrorActionPreference = "Stop"
$rootDir = (Get-Item $PSScriptRoot\..).FullName
Set-Location $rootDir

Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "   NetSplit - Automated Release Builder & Packager                  " -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan

# 1. Compile C++ Windows Service & Router DLLs
Write-Host "`n[1/5] Compiling native Windows Service & Router DLLs..." -ForegroundColor Yellow
& cmd.exe /c "native\windows-service\build.bat"
if ($LASTEXITCODE -ne 0) { throw "Native service compilation failed" }

# 2. Compile native NetSplit.exe launcher with embedded icon
Write-Host "`n[2/5] Compiling native NetSplit.exe launcher with embedded icon..." -ForegroundColor Yellow
$vcvars = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
$compileLauncher = @"
@echo off
call "$vcvars" >nul
copy /y icon.ico native\icon.ico >nul
rc.exe /fo native\launcher.res native\launcher.rc
cl.exe /nologo /EHsc /O2 /W3 /std:c++17 native\launcher.cpp native\launcher.res /Fe:NetSplit.exe /link /SUBSYSTEM:WINDOWS ws2_32.lib advapi32.lib shell32.lib user32.lib
if exist native\icon.ico del native\icon.ico
if exist native\launcher.res del native\launcher.res
if exist launcher.obj del launcher.obj
"@
$compileLauncher | Set-Content "$rootDir\compile_temp.bat"
& cmd.exe /c "$rootDir\compile_temp.bat"
Remove-Item "$rootDir\compile_temp.bat" -Force

# 3. Build Desktop UI Web Bundle
Write-Host "`n[3/5] Compiling Desktop UI bundle (Vite)..." -ForegroundColor Yellow
& npm run build:ui
if ($LASTEXITCODE -ne 0) { throw "UI compilation failed" }

# 4. Run automated test suite
Write-Host "`n[4/5] Running automated verification test suite..." -ForegroundColor Yellow
& npm test
if ($LASTEXITCODE -ne 0) { throw "Automated tests failed" }

# 5. Assemble Standalone Clean Release Distribution (No loose JS, no README, no package.json)
$version = "1.0.0"
$releaseDir = "$rootDir\release\NetSplit-v$version-windows-x64"
$zipPath = "$rootDir\release\NetSplit-v$version-windows-x64.zip"

Write-Host "`n[5/5] Assembling clean release distribution at $releaseDir..." -ForegroundColor Yellow
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq 'NetSplit.exe' } | Invoke-CimMethod -MethodName Terminate -ErrorAction SilentlyContinue
if (Test-Path "$rootDir\release") {
    Remove-Item "$rootDir\release" -Recurse -Force -ErrorAction SilentlyContinue
}

# Create required release directories
New-Item -ItemType Directory -Path "$releaseDir\runtime\resources" -Force | Out-Null
New-Item -ItemType Directory -Path "$releaseDir\native\windows-service" -Force | Out-Null
New-Item -ItemType Directory -Path "$releaseDir\scripts" -Force | Out-Null

# Copy standalone Electron runtime
Copy-Item "$rootDir\node_modules\electron\dist\*" "$releaseDir\runtime\" -Recurse -Force
if (Test-Path "$releaseDir\runtime\electron.exe") {
    Rename-Item "$releaseDir\runtime\electron.exe" "NetSplit.exe" -Force
}
if (Test-Path "$releaseDir\runtime\resources\default_app.asar") {
    Remove-Item "$releaseDir\runtime\resources\default_app.asar" -Force
}

# Stage UI into temporary folder and pack into app.asar (Seals all JavaScript into a single binary archive)
$stagingDir = "$rootDir\release_staging"
if (Test-Path $stagingDir) { Remove-Item $stagingDir -Recurse -Force }
New-Item -ItemType Directory -Path "$stagingDir\electron" -Force | Out-Null
New-Item -ItemType Directory -Path "$stagingDir\dist" -Force | Out-Null

Copy-Item "$rootDir\apps\desktop\package.json" "$stagingDir\"
Copy-Item "$rootDir\apps\desktop\electron\main.js" "$stagingDir\electron\"
Copy-Item "$rootDir\apps\desktop\electron\preload.js" "$stagingDir\electron\"
if (Test-Path "$rootDir\apps\desktop\electron\icon.png") {
    Copy-Item "$rootDir\apps\desktop\electron\icon.png" "$stagingDir\electron\"
}
Copy-Item "$rootDir\apps\desktop\dist\*" "$stagingDir\dist\" -Recurse -Force

Write-Host "Packaging UI assets into runtime\resources\app.asar (sealing all JavaScript)..." -ForegroundColor Yellow
& npx asar pack "$stagingDir" "$releaseDir\runtime\resources\app.asar"
Remove-Item $stagingDir -Recurse -Force

# Copy root launcher executable with custom embedded icon
Copy-Item "$rootDir\NetSplit.exe" "$releaseDir\"

# Copy native service binaries
Copy-Item "$rootDir\native\windows-service\NetSplitService.exe" "$releaseDir\native\windows-service\"
Copy-Item "$rootDir\native\windows-service\NetSplitRouter.dll" "$releaseDir\native\windows-service\"
if (Test-Path "$rootDir\native\windows-service\NetSplitRouter32.dll") {
    Copy-Item "$rootDir\native\windows-service\NetSplitRouter32.dll" "$releaseDir\native\windows-service\"
}

# Copy scripts
Copy-Item "$rootDir\scripts\install-service.ps1" "$releaseDir\scripts\"
Copy-Item "$rootDir\scripts\uninstall-service.ps1" "$releaseDir\scripts\"
Copy-Item "$rootDir\scripts\elevate-service.ps1" "$releaseDir\scripts\"

# Create zip archive
Write-Host "Creating compressed release archive $zipPath..." -ForegroundColor Yellow
Compress-Archive -Path "$releaseDir\*" -DestinationPath $zipPath -Force

Write-Host "`n====================================================================" -ForegroundColor Green
Write-Host "   [SUCCESS] Clean release NetSplit-v$version packaged successfully! " -ForegroundColor Green
Write-Host "   Distribution Directory: $releaseDir                              " -ForegroundColor Green
Write-Host "   Compressed Zip Archive: $zipPath                                 " -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Green
