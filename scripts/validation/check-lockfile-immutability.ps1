# Check that lockfile was not modified during recovery (read-only)
# Usage: .\scripts\validation\check-lockfile-immutability.ps1 [instanceId]

param(
    [string]$InstanceId = "default"
)

$appData = $env:APPDATA
$lockfilePath = Join-Path $appData "MineAnvil\instances\$InstanceId\pack\lock.json"

if (-not (Test-Path $lockfilePath)) {
    Write-Host "Lockfile not found: $lockfilePath" -ForegroundColor Red
    exit 1
}

$lockfile = Get-Content $lockfilePath | ConvertFrom-Json
$fileInfo = Get-Item $lockfilePath

Write-Host "Lockfile Immutability Check" -ForegroundColor Cyan
Write-Host "Path: $lockfilePath" -ForegroundColor Gray
Write-Host "Last Modified: $($fileInfo.LastWriteTime)" -ForegroundColor Gray
Write-Host ""

Write-Host "Lockfile Contents:" -ForegroundColor Green
Write-Host "  Schema Version: $($lockfile.schemaVersion)" -ForegroundColor White
Write-Host "  Minecraft Version: $($lockfile.minecraftVersion)" -ForegroundColor White
Write-Host "  Generated At: $($lockfile.generatedAt)" -ForegroundColor White
Write-Host "  Artifact Count: $($lockfile.artifacts.Count)" -ForegroundColor White

Write-Host "`nNote: This script only displays lockfile contents." -ForegroundColor Yellow
Write-Host "To verify immutability, compare LastWriteTime before and after recovery operations." -ForegroundColor Yellow

