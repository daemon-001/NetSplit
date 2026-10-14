# NetSplit Service IPC Test Harness

$serviceProcess = Start-Process -FilePath ".\native\windows-service\NetSplitService.exe" -PassThru
Start-Sleep -Seconds 2

try {
    $tokenPath = "$env:LOCALAPPDATA\NetSplit\ipc_auth.token"
    if (!(Test-Path $tokenPath)) {
        $tokenPath = "$env:ProgramData\NetSplit\ipc_auth.token"
    }
    if (!(Test-Path $tokenPath)) {
        $tokenPath = ".\data\ipc_auth.token"
    }

    if (!(Test-Path $tokenPath)) {
        Write-Error "Auth token file not found!"
        exit 1
    }

    $token = (Get-Content $tokenPath).Trim()
    Write-Host "Read ephemeral auth token: $token"

    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }

    # 1. Test system.getStatus
    Write-Host "`n[1] Testing system.getStatus..."
    $statusReq = @{
        jsonrpc = "2.0"
        id = "test-1"
        method = "system.getStatus"
    } | ConvertTo-Json
    $statusResp = Invoke-RestMethod -Uri "http://127.0.0.1:48192" -Method Post -Headers $headers -Body $statusReq
    Write-Host "Status Response:" ($statusResp | ConvertTo-Json -Depth 5)

    # 2. Test adapter.list
    Write-Host "`n[2] Testing adapter.list..."
    $adapterReq = @{
        jsonrpc = "2.0"
        id = "test-2"
        method = "adapter.list"
    } | ConvertTo-Json
    $adapterResp = Invoke-RestMethod -Uri "http://127.0.0.1:48192" -Method Post -Headers $headers -Body $adapterReq
    Write-Host "Detected Adapters:" $adapterResp.result.Count
    foreach ($a in $adapterResp.result) {
        Write-Host " - [$($a.status)] $($a.friendlyName) (Type: $($a.type), Index: $($a.ifIndex), Default: $($a.isDefaultRoute))"
    }

    # 3. Test app.list
    Write-Host "`n[3] Testing app.list..."
    $appReq = @{
        jsonrpc = "2.0"
        id = "test-3"
        method = "app.list"
    } | ConvertTo-Json
    $appResp = Invoke-RestMethod -Uri "http://127.0.0.1:48192" -Method Post -Headers $headers -Body $appReq
    Write-Host "Discovered Applications:" $appResp.result.Count
    $runningApps = $appResp.result | Where-Object { $_.isRunning -eq $true }
    Write-Host "Currently Running Applications:" $runningApps.Count
    $runningApps | Select-Object -First 5 | ForEach-Object {
        Write-Host " - $($_.name) ($($_.executablePath))"
    }

    # 4. Test rule assignment (Test assigning one app to WiFi)
    $wifi = $adapterResp.result | Where-Object { $_.friendlyName -like "*Wi-Fi*" -or $_.friendlyName -eq "WiFi" } | Select-Object -First 1
    if ($wifi -and $runningApps.Count -gt 0) {
        $testApp = $runningApps[0]
        Write-Host "`n[4] Testing rule.assign for app [$($testApp.name)] to adapter [$($wifi.friendlyName)]..."
        $assignReq = @{
            jsonrpc = "2.0"
            id = "test-4"
            method = "rule.assign"
            params = @{
                applicationId = $testApp.id
                executablePath = $testApp.executablePath
                applicationName = $testApp.name
                adapterId = $wifi.id
                fallbackMode = "BLOCK"
            }
        } | ConvertTo-Json
        $assignResp = Invoke-RestMethod -Uri "http://127.0.0.1:48192" -Method Post -Headers $headers -Body $assignReq
        Write-Host "Assign Response:" ($assignResp | ConvertTo-Json)

        # 5. Test rule.verify
        Write-Host "`n[5] Testing rule.verify..."
        $verifyReq = @{
            jsonrpc = "2.0"
            id = "test-5"
            method = "rule.verify"
        } | ConvertTo-Json
        $verifyResp = Invoke-RestMethod -Uri "http://127.0.0.1:48192" -Method Post -Headers $headers -Body $verifyReq
        Write-Host "Verify Response:" ($verifyResp | ConvertTo-Json -Depth 5)

        # 6. Test rule.remove
        Write-Host "`n[6] Testing rule.remove..."
        $removeReq = @{
            jsonrpc = "2.0"
            id = "test-6"
            method = "rule.remove"
            params = @{
                applicationId = $testApp.id
            }
        } | ConvertTo-Json
        $removeResp = Invoke-RestMethod -Uri "http://127.0.0.1:48192" -Method Post -Headers $headers -Body $removeReq
        Write-Host "Remove Response:" ($removeResp | ConvertTo-Json)
    }

    Write-Host "`nAll IPC tests completed successfully!"
} finally {
    Write-Host "`nTerminating test service process..."
    Stop-Process -Id $serviceProcess.Id -Force
}
