# Phase D: Verify Scenario B (Resume from Staging)
# Relaunches MineAnvil and verifies recovery from staging

$ErrorActionPreference = "Continue"

Write-Host "=== Phase D: Verify Scenario B (Resume from Staging) ===" -ForegroundColor Cyan
Write-Host ""

$appData = $env:APPDATA
$stagingPath = Join-Path $appData "MineAnvil\instances\default\.staging\pack-install"
$clientJar = Join-Path $appData "MineAnvil\instances\default\.minecraft\versions\1.21.4\1.21.4.jar"

# Verify staging exists before resume
if (-not (Test-Path $stagingPath)) {
    Write-Host "ERROR: Staging directory does not exist!" -ForegroundColor Red
    Write-Host "Run Phase B first to create staging artifacts." -ForegroundColor Yellow
    exit 1
}

$stagingFiles = Get-ChildItem -Path $stagingPath -Recurse -File -ErrorAction SilentlyContinue
if ($stagingFiles.Count -eq 0) {
    Write-Host "ERROR: Staging directory is empty!" -ForegroundColor Red
    exit 1
}

Write-Host "Staging verified: $($stagingFiles.Count) files ready for recovery" -ForegroundColor Green
Write-Host ""

# Stop any running processes
Write-Host "Stopping any running processes..." -ForegroundColor Yellow
Get-Process electron -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

# Relaunch MineAnvil
Write-Host "Relaunching MineAnvil for recovery test..." -ForegroundColor Yellow
$workingDir = Get-Location
$proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c","npm run dev:electron" -PassThru -WindowStyle Minimized -WorkingDirectory $workingDir

if (-not $proc) {
    Write-Host "Failed to start app" -ForegroundColor Red
    exit 1
}

Write-Host "App started (PID: $($proc.Id))" -ForegroundColor Gray
Write-Host "Waiting for recovery and installation to complete (60 seconds)..." -ForegroundColor Yellow
Write-Host ""

Start-Sleep -Seconds 60

# Check if process is still running
$stillRunning = Get-Process -Id $proc.Id -ErrorAction SilentlyContinue
if ($stillRunning) {
    Write-Host "App is still running. Waiting a bit more..." -ForegroundColor Yellow
    Start-Sleep -Seconds 30
    Get-Process electron -ErrorAction SilentlyContinue | Stop-Process -Force
}

Write-Host ""
Write-Host "=== Verification Results ===" -ForegroundColor Cyan
Write-Host ""

# Check staging cleanup
Write-Host "1. Staging Cleanup:" -ForegroundColor Yellow
if (Test-Path $stagingPath) {
    $remainingFiles = Get-ChildItem -Path $stagingPath -Recurse -File -ErrorAction SilentlyContinue
    if ($remainingFiles.Count -eq 0) {
        Write-Host "   PASS: Staging directory cleaned up" -ForegroundColor Green
    } else {
        Write-Host "   WARNING: Staging still has $($remainingFiles.Count) files" -ForegroundColor Yellow
    }
} else {
    Write-Host "   PASS: Staging directory removed (clean state)" -ForegroundColor Green
}

Write-Host ""

# Check final location
Write-Host "2. Final Location:" -ForegroundColor Yellow
if (Test-Path $clientJar) {
    $fileInfo = Get-Item $clientJar
    $sizeMB = [math]::Round($fileInfo.Length / 1MB, 2)
    Write-Host "   PASS: Client JAR exists in final location ($sizeMB MB)" -ForegroundColor Green
} else {
    Write-Host "   FAIL: Client JAR not in final location" -ForegroundColor Red
}

Write-Host ""
Write-Host "Run verification scripts for detailed logs:" -ForegroundColor Cyan
Write-Host "  pwsh -File scripts\validation\parse-recovery-logs.ps1" -ForegroundColor White
Write-Host "  pwsh -File scripts\validation\list-staging.ps1" -ForegroundColor White
Write-Host "  pwsh -File scripts\validation\list-snapshots.ps1" -ForegroundColor White

