Stop-Service -Name NetSplitService -Force -ErrorAction SilentlyContinue
Stop-Process -Name NetSplitService -Force -ErrorAction SilentlyContinue
Write-Host "Cleanup completed successfully."
