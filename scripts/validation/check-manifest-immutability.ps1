# Check that PackManifest was not modified during recovery (read-only)
# Usage: .\scripts\validation\check-manifest-immutability.ps1 [instanceId]

param(
    [string]$InstanceId = "default"
)

$appData = $env:APPDATA
$manifestPath = Join-Path $appData "MineAnvil\instances\$InstanceId\pack\manifest.json"

if (-not (Test-Path $manifestPath)) {
    Write-Host "Manifest not found: $manifestPath" -ForegroundColor Red
    exit 1
}

$manifest = Get-Content $manifestPath | ConvertFrom-Json
$fileInfo = Get-Item $manifestPath

Write-Host "PackManifest Immutability Check" -ForegroundColor Cyan
Write-Host "Path: $manifestPath" -ForegroundColor Gray
Write-Host "Last Modified: $($fileInfo.LastWriteTime)" -ForegroundColor Gray
Write-Host ""

Write-Host "Manifest Contents:" -ForegroundColor Green
Write-Host "  Manifest Version: $($manifest.manifestVersion)" -ForegroundColor White
Write-Host "  Instance ID: $($manifest.instanceId)" -ForegroundColor White
Write-Host "  Created At: $($manifest.createdAt)" -ForegroundColor White
Write-Host "  Minecraft Version: $($manifest.minecraftVersion)" -ForegroundColor White

Write-Host "`nNote: This script only displays manifest contents." -ForegroundColor Yellow
Write-Host "To verify immutability, compare LastWriteTime before and after recovery operations." -ForegroundColor Yellow

