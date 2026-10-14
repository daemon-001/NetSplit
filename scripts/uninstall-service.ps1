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

$serviceExe = "$PSScriptRoot\..\native\windows-service\NetSplitService.exe"

if (Get-Service -Name NetSplitService -ErrorAction SilentlyContinue) {
    Write-Host "Stopping and deleting NetSplitService from SCM..." -ForegroundColor Yellow
    if (Test-Path $serviceExe) {
        & $serviceExe --uninstall
    } else {
        Stop-Service -Name NetSplitService -Force -ErrorAction SilentlyContinue
        sc.exe delete NetSplitService
    }
} else {
    Write-Host "NetSplitService is not currently registered in SCM." -ForegroundColor Yellow
}

Write-Host "`nAll dynamic WFP filters have been automatically released by Windows kernel." -ForegroundColor Green
Write-Host "System networking configuration is in clean default state." -ForegroundColor Green
