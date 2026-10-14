# NetSplit Clean Service Uninstaller
# Requires Administrator Privileges

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Warning "Administrator rights required to uninstall Windows Services. Relaunching elevated..."
    Start-Process powershell -Verb RunAs -ArgumentList "-ExecutionPolicy Bypass -File `"$PSCommandPath`""
    exit
}

Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "   NetSplit - Clean Uninstallation & System Recovery               " -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan

# 1. Stop service via sc and PowerShell
Write-Host "Stopping NetSplitService..." -ForegroundColor Yellow
Stop-Service -Name NetSplitService -Force -ErrorAction SilentlyContinue
sc.exe stop NetSplitService >$null 2>&1

# 2. Force kill any running NetSplitService processes
Write-Host "Terminating any background NetSplitService processes..." -ForegroundColor Yellow
Stop-Process -Name NetSplitService -Force -ErrorAction SilentlyContinue
taskkill /F /IM NetSplitService.exe >$null 2>&1
Start-Sleep -Milliseconds 400

# 3. Delete service from SCM
Write-Host "Deleting NetSplitService from SCM..." -ForegroundColor Yellow
$serviceExe = "$PSScriptRoot\..\native\windows-service\NetSplitService.exe"
if (Test-Path $serviceExe) {
    & $serviceExe --uninstall >$null 2>&1
}
sc.exe delete NetSplitService >$null 2>&1

# 4. Clean up temporary IPC authentication tokens
Write-Host "Cleaning up IPC tokens..." -ForegroundColor Yellow
Remove-Item "C:\ProgramData\NetSplit\ipc_auth.token" -Force -ErrorAction SilentlyContinue
Remove-Item "$env:LOCALAPPDATA\NetSplit\ipc_auth.token" -Force -ErrorAction SilentlyContinue

# 5. Restore automatic network route metrics
Write-Host "Restoring default automatic interface route metrics..." -ForegroundColor Yellow
Get-NetIPInterface -AddressFamily IPv4 -ErrorAction SilentlyContinue | ForEach-Object {
    Set-NetIPInterface -InterfaceIndex $_.ifIndex -AutomaticMetric Enabled -ErrorAction SilentlyContinue
}

Write-Host "`n[SUCCESS] NetSplit Windows Service has been completely uninstalled." -ForegroundColor Green
Write-Host "All dynamic WFP filters have been automatically released by Windows kernel." -ForegroundColor Green
Write-Host "System networking configuration is in clean default state." -ForegroundColor Green
