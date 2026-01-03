# Test rollback execution in a controlled way
# Usage: .\scripts\validation\test-rollback.ps1 [instanceId] [snapshotId]

param(
    [string]$InstanceId = "default",
    [string]$SnapshotId = $null,
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

Write-Host "=== Rollback Test ===" -ForegroundColor Cyan
Write-Host "Instance: $InstanceId" -ForegroundColor White
if ($SnapshotId) {
    Write-Host "Snapshot: $SnapshotId" -ForegroundColor White
} else {
    Write-Host "Snapshot: latest (auto-select)" -ForegroundColor White
}
Write-Host ""

# Check if snapshots exist
$rollbackPath = Join-Path $env:APPDATA "MineAnvil\instances\$InstanceId\.rollback"
if (-not (Test-Path $rollbackPath)) {
    Write-Host "❌ Rollback directory does not exist: $rollbackPath" -ForegroundColor Red
    Write-Host "   Create a snapshot first by running an installation." -ForegroundColor Yellow
    exit 1
}

# List available snapshots
Write-Host "Available snapshots:" -ForegroundColor Green
$snapshots = Get-ChildItem -Path $rollbackPath -Directory | Sort-Object Name -Descending
if ($snapshots.Count -eq 0) {
    Write-Host "❌ No snapshots found in rollback directory." -ForegroundColor Red
    exit 1
}

foreach ($snapshot in $snapshots) {
    $manifestPath = Join-Path $snapshot.FullName "snapshot.json"
    if (Test-Path $manifestPath) {
        $manifest = Get-Content $manifestPath | ConvertFrom-Json
        Write-Host "  $($snapshot.Name)" -ForegroundColor White
        Write-Host "    Created: $($manifest.createdAt)" -ForegroundColor Gray
        Write-Host "    Artifacts: $($manifest.artifactCount)" -ForegroundColor Gray
    } else {
        Write-Host "  $($snapshot.Name) (no manifest)" -ForegroundColor Yellow
    }
}
Write-Host ""

# Run rollback
$rollbackArgs = @("node", "scripts\run-rollback.ts", "--instance", $InstanceId)
if ($SnapshotId) {
    $rollbackArgs += "--snapshot"
    $rollbackArgs += $SnapshotId
}
if ($Verbose) {
    $rollbackArgs += "--verbose"
}

Write-Host "Executing rollback..." -ForegroundColor Cyan
$result = & $rollbackArgs[0] $rollbackArgs[1..($rollbackArgs.Length-1)] 2>&1

# Output result
$result | ForEach-Object {
    if ($_ -match "✅") {
        Write-Host $_ -ForegroundColor Green
    } elseif ($_ -match "❌") {
        Write-Host $_ -ForegroundColor Red
    } else {
        Write-Host $_
    }
}

# Check exit code
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Rollback test completed successfully" -ForegroundColor Green
    exit 0
} else {
    Write-Host ""
    Write-Host "❌ Rollback test failed" -ForegroundColor Red
    exit 1
}


