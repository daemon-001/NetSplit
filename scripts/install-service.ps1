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

# 1. Ensure binary exists
$serviceExe = "$PSScriptRoot\..\native\windows-service\NetSplitService.exe"
if (-not (Test-Path $serviceExe)) {
    Write-Host "Compiling NetSplitService.exe..." -ForegroundColor Yellow
    cmd.exe /c "`"$PSScriptRoot\..\native\windows-service\build.bat`""
}

if (-not (Test-Path $serviceExe)) {
    Write-Error "Failed to find NetSplitService.exe at $serviceExe"
    exit 1
}

# 2. Stop any existing running instance
Write-Host "Stopping any existing NetSplitService instances..." -ForegroundColor Yellow
Stop-Service -Name NetSplitService -Force -ErrorAction SilentlyContinue
Stop-Process -Name NetSplitService -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 400

# 3. Register service with Service Control Manager
Write-Host "Registering service with SCM..." -ForegroundColor Yellow
& $serviceExe --install

# Ensure binPath is fully quoted and start= auto
$binPathArg = "`"$serviceExe`" --run-service"
sc.exe config NetSplitService binPath= $binPathArg start= auto >$null 2>&1

# 4. Start service
Write-Host "Starting NetSplitService..." -ForegroundColor Yellow
Start-Service -Name NetSplitService -ErrorAction SilentlyContinue
sc.exe start NetSplitService >$null 2>&1

# 5. Wait for port 48192 to be ready
$ready = $false
for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 500
    $conn = Get-NetTCPConnection -LocalPort 48192 -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        $ready = $true
        break
    }
}

# 6. Ensure open token permissions
$progToken = "C:\ProgramData\NetSplit\ipc_auth.token"
if (Test-Path $progToken) {
    icacls "C:\ProgramData\NetSplit" /grant "Users:(OI)(CI)F" /grant "Everyone:(OI)(CI)R" /Q | Out-Null
    icacls $progToken /grant "Users:F" /grant "Everyone:R" /Q | Out-Null
}

Write-Host "`n[SUCCESS] NetSplit Windows Service installed and active (Listening on port 48192: $ready)." -ForegroundColor Green
Write-Host "NetSplit will now run automatically on Windows startup." -ForegroundColor Green
