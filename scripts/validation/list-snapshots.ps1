# List rollback snapshots (read-only)
# Usage: .\scripts\validation\list-snapshots.ps1 [instanceId]

param(
    [string]$InstanceId = "default"
)

$appData = $env:APPDATA
$rollbackPath = Join-Path $appData "MineAnvil\instances\$InstanceId\.rollback"

Write-Host "Rollback Directory: $rollbackPath" -ForegroundColor Cyan

if (-not (Test-Path $rollbackPath)) {
    Write-Host "Rollback directory does not exist (no snapshots)" -ForegroundColor Yellow
    exit 0
}

Write-Host "`nSnapshots:" -ForegroundColor Green
Get-ChildItem -Path $rollbackPath -Directory | Sort-Object Name -Descending | ForEach-Object {
    $snapshotPath = Join-Path $_.FullName "snapshot.json"
    if (Test-Path $snapshotPath) {
        $snapshot = Get-Content $snapshotPath | ConvertFrom-Json
        Write-Host "  $($_.Name)" -ForegroundColor White
        Write-Host "    Created: $($snapshot.createdAt)" -ForegroundColor Gray
        Write-Host "    Minecraft Version: $($snapshot.minecraftVersion)" -ForegroundColor Gray
        Write-Host "    Artifact Count: $($snapshot.artifactCount)" -ForegroundColor Gray
    } else {
        Write-Host "  $($_.Name) (no snapshot.json)" -ForegroundColor Yellow
    }
}

$snapshotCount = (Get-ChildItem -Path $rollbackPath -Directory).Count
Write-Host "`nTotal snapshots: $snapshotCount" -ForegroundColor Cyan

