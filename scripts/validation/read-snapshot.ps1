# Read a specific snapshot manifest (read-only)
# Usage: .\scripts\validation\read-snapshot.ps1 <snapshotId> [instanceId]

param(
    [Parameter(Mandatory=$true)]
    [string]$SnapshotId,
    
    [string]$InstanceId = "default"
)

$appData = $env:APPDATA
$snapshotPath = Join-Path $appData "MineAnvil\instances\$InstanceId\.rollback\$SnapshotId\snapshot.json"

if (-not (Test-Path $snapshotPath)) {
    Write-Host "Snapshot not found: $snapshotPath" -ForegroundColor Red
    exit 1
}

$snapshot = Get-Content $snapshotPath | ConvertFrom-Json

Write-Host "Snapshot: $($snapshot.snapshotId)" -ForegroundColor Cyan
Write-Host "Created: $($snapshot.createdAt)" -ForegroundColor White
Write-Host "Minecraft Version: $($snapshot.minecraftVersion)" -ForegroundColor White
Write-Host "Artifact Count: $($snapshot.artifactCount)" -ForegroundColor White

Write-Host "`nArtifacts:" -ForegroundColor Green
$snapshot.artifacts | ForEach-Object {
    Write-Host "  $($_.name)" -ForegroundColor White
    Write-Host "    Path: $($_.path)" -ForegroundColor Gray
    Write-Host "    Checksum: $($_.checksum.algo) = $($_.checksum.value)" -ForegroundColor Gray
}

Write-Host "`nFull JSON:" -ForegroundColor Green
$snapshot | ConvertTo-Json -Depth 10

