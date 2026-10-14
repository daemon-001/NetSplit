# NetSplit Automated Service Installer
# Requires Administrator Privileges

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Warning "Administrator rights required to install Windows Services. Relaunching elevated..."
    Start-Process powershell -Verb RunAs -ArgumentList "-ExecutionPolicy Bypass -File `"$PSCommandPath`""
    exit
}

Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "   NetSplit - Installing Privileged Windows Networking Service     " -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan

# 1. Compile service binary if missing
$serviceExe = "$PSScriptRoot\..\native\windows-service\NetSplitService.exe"
if (-not (Test-Path $serviceExe)) {
    Write-Host "Compiling NetSplitService.exe..." -ForegroundColor Yellow
    cmd.exe /c "`"$PSScriptRoot\..\native\windows-service\build.bat`""
}

if (-not (Test-Path $serviceExe)) {
    Write-Error "Failed to compile NetSplitService.exe. Check Visual Studio 2022 build tools."
    exit 1
}

# 2. Register service with Service Control Manager
Write-Host "Registering service with SCM..." -ForegroundColor Yellow
& $serviceExe --install

# 3. Start service
Write-Host "Starting NetSplitService..." -ForegroundColor Yellow
Start-Service -Name NetSplitService -ErrorAction SilentlyContinue

$svc = Get-Service -Name NetSplitService
Write-Host "`nService Status: $($svc.Status)" -ForegroundColor Green
Write-Host "NetSplit is now protecting and routing connections in the background." -ForegroundColor Green
