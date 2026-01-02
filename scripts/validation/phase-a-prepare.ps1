# Phase A: Prepare Interrupted Install
# Deletes the Minecraft client JAR to force a download

$ErrorActionPreference = "Stop"

Write-Host "=== Phase A: Prepare Interrupted Install ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check client JAR location
Write-Host "Step 1: Checking client JAR location..." -ForegroundColor Yellow
$clientJar = Join-Path $env:APPDATA "MineAnvil\instances\default\.minecraft\versions\1.21.4\1.21.4.jar"
$exists = Test-Path $clientJar

if ($exists) {
    $fileInfo = Get-Item $clientJar
    $sizeMB = [math]::Round($fileInfo.Length / 1MB, 2)
    Write-Host "  Client JAR exists: $sizeMB MB" -ForegroundColor Green
    Write-Host "  Path: $clientJar" -ForegroundColor Gray
} else {
    Write-Host "  Client JAR not found (already deleted)" -ForegroundColor Yellow
}

Write-Host ""

# Step 2: Stop any running processes
Write-Host "Step 2: Stopping any running Electron processes..." -ForegroundColor Yellow
Get-Process electron -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
Write-Host "  Processes stopped" -ForegroundColor Green

Write-Host ""

# Step 3: Delete client JAR
Write-Host "Step 3: Deleting client JAR..." -ForegroundColor Yellow
if ($exists) {
    Remove-Item $clientJar -Force
    Write-Host "  Client JAR deleted" -ForegroundColor Green
} else {
    Write-Host "  Client JAR already deleted" -ForegroundColor Yellow
}

Write-Host ""

# Step 4: Verify deletion
Write-Host "Step 4: Verifying deletion..." -ForegroundColor Yellow
$stillExists = Test-Path $clientJar
if ($stillExists) {
    Write-Host "  FAILED: File still exists!" -ForegroundColor Red
    exit 1
} else {
    Write-Host "  SUCCESS: File deleted" -ForegroundColor Green
    Write-Host ""
    Write-Host "Phase A complete. Ready for Phase B (interrupt during download)." -ForegroundColor Green
}

