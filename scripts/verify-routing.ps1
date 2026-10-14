# NetSplit Live Routing Verification Harness
# Tests multi-adapter socket routing across active network connections

Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "   NetSplit - Interface-Specific Egress Verification Test           " -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan

$pocExe = "$PSScriptRoot\..\native\poc-verifier\poc_adapter_routing.exe"

if (-not (Test-Path $pocExe)) {
    Write-Host "Compiling proof-of-concept verification binary..." -ForegroundColor Yellow
    cmd.exe /c "call `"C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat`" && cl.exe /EHsc /O2 /W3 /std:c++17 `"$PSScriptRoot\..\native\poc-verifier\poc_adapter_routing.cpp`" /Fe:`"$pocExe`" /link ws2_32.lib iphlpapi.lib"
}

if (-not (Test-Path $pocExe)) {
    Write-Error "Failed to compile verification binary. Check C++ compiler tools."
    exit 1
}

Write-Host "Executing interface binding tests on live network adapters...`n" -ForegroundColor Yellow
& $pocExe
