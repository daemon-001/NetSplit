# NetSplit Service Elevation and Clean Restart Helper
$ErrorActionPreference = 'SilentlyContinue'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir
$serviceExe = Join-Path $rootDir "native\windows-service\NetSplitService.exe"

# 1. If Windows Service is installed, restart it
$svc = Get-Service -Name "NetSplitService" -ErrorAction SilentlyContinue

if ($svc) {
    Write-Host "[Elevate] Stopping Windows Service NetSplitService..."
    Stop-Service -Name "NetSplitService" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 300
    # Also force kill any orphan process
    Stop-Process -Name "NetSplitService" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 300
    Write-Host "[Elevate] Starting Windows Service NetSplitService..."
    Start-Service -Name "NetSplitService" -ErrorAction SilentlyContinue
} else {
    Write-Host "[Elevate] NetSplitService is not installed as a Windows Service. Use install-service.ps1 to install."
}

# 2. Wait up to 10 seconds for port 48192 to come online
$ready = $false
for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 500
    $conn = Get-NetTCPConnection -LocalPort 48192 -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        $ready = $true
        break
    }
}

# 3. Synchronize token to ensure non-elevated UI can read it
$progToken = "C:\ProgramData\NetSplit\ipc_auth.token"
if (Test-Path $progToken) {
    icacls "C:\ProgramData\NetSplit" /grant "Users:(OI)(CI)F" /grant "Everyone:(OI)(CI)R" /Q | Out-Null
    icacls $progToken /grant "Users:F" /grant "Everyone:R" /Q | Out-Null

    # Mirror to interactive users LOCALAPPDATA if known
    $userProfiles = Get-ChildItem "C:\Users" -Directory -ErrorAction SilentlyContinue
    $tokenContent = (Get-Content $progToken -Raw).Trim()
    foreach ($userDir in $userProfiles) {
        $userAppData = Join-Path $userDir.FullName "AppData\Local\NetSplit"
        if (Test-Path $userAppData) {
            $destToken = Join-Path $userAppData "ipc_auth.token"
            Set-Content -Path $destToken -Value $tokenContent -Force -ErrorAction SilentlyContinue
        }
    }
}

Write-Host "[Elevate] Finished. Ready: $ready"
