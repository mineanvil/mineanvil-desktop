# Test Lockfile-only Authority - Complete Test Script
# This script corrupts a file, then you run MineAnvil, then it parses the evidence
# Usage: .\scripts\validation\test-lockfile-authority.ps1 [-InstanceId default] [-McVersion 1.21.4]

param(
    [string]$InstanceId = "default",
    [string]$McVersion = "1.21.4",
    [switch]$Verbose
)

$ErrorActionPreference = "Continue"

Write-Host "=== Lockfile-only Authority Test ===" -ForegroundColor Cyan
Write-Host ""

# Paths
$appData = $env:APPDATA
$clientJarPath = Join-Path $appData "MineAnvil\instances\$InstanceId\.minecraft\versions\$McVersion\$McVersion.jar"
$lockfilePath = Join-Path $appData "MineAnvil\instances\$InstanceId\pack\lock.json"

# Step 1: Check prerequisites
Write-Host "[1/4] Checking prerequisites..." -ForegroundColor Cyan

if (-not (Test-Path $lockfilePath)) {
    Write-Host "  ERROR: Lockfile not found: $lockfilePath" -ForegroundColor Red
    Write-Host "  Please run MineAnvil first to generate lockfile." -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path $clientJarPath)) {
    Write-Host "  ERROR: Client JAR not found: $clientJarPath" -ForegroundColor Red
    Write-Host "  Please run MineAnvil first to install artifacts." -ForegroundColor Yellow
    exit 1
}

Write-Host "  ✓ Lockfile found" -ForegroundColor Green
Write-Host "  ✓ Client JAR found" -ForegroundColor Green

# Step 2: Backup and corrupt file
Write-Host "[2/4] Preparing test scenario..." -ForegroundColor Cyan

$backupPath = "$clientJarPath.backup"
if (Test-Path $backupPath) {
    Remove-Item $backupPath -Force
}
Copy-Item $clientJarPath $backupPath

Write-Host "  ✓ File backed up" -ForegroundColor Green

# Corrupt the file (modify first few bytes)
$bytes = [System.IO.File]::ReadAllBytes($clientJarPath)
$originalBytes = $bytes[0..2]
$bytes[0] = 0xFF
$bytes[1] = 0xFF
$bytes[2] = 0xFF
[System.IO.File]::WriteAllBytes($clientJarPath, $bytes)

Write-Host "  ✓ File corrupted (first 3 bytes modified: $($originalBytes[0]), $($originalBytes[1]), $($originalBytes[2]) -> 0xFF, 0xFF, 0xFF)" -ForegroundColor Green

# Step 3: Instructions
Write-Host "[3/4] Ready for testing..." -ForegroundColor Cyan
Write-Host ""
Write-Host "  NEXT STEPS:" -ForegroundColor Yellow
Write-Host "  1. Run MineAnvil:" -ForegroundColor White
Write-Host "     npm run dev:electron" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Wait for installation/recovery to complete" -ForegroundColor White
Write-Host ""
Write-Host "  3. After MineAnvil completes, run this script again with -ParseOnly flag:" -ForegroundColor White
Write-Host "     .\scripts\validation\test-lockfile-authority.ps1 -ParseOnly" -ForegroundColor Gray
Write-Host ""
Write-Host "  The script will:" -ForegroundColor White
Write-Host "    - Parse logs for recovery decision entries" -ForegroundColor Gray
Write-Host "    - Validate lockfile-only authority" -ForegroundColor Gray
Write-Host "    - Create evidence files" -ForegroundColor Gray
Write-Host "    - Restore the original file" -ForegroundColor Gray
Write-Host ""

# If ParseOnly flag, skip to parsing
if ($ParseOnly) {
    Write-Host "[4/4] Parsing evidence..." -ForegroundColor Cyan
    
    # Create evidence directory
    $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $evidenceDir = Join-Path (Get-Location) "prompts\02-evidence\L2\sp2.3-final\$timestamp"
    New-Item -ItemType Directory -Path $evidenceDir -Force | Out-Null
    
    # Parse logs
    & "$PSScriptRoot\parse-lockfile-authority-logs.ps1" -InstanceId $InstanceId -EvidenceDir $evidenceDir
    
    # Restore file
    Write-Host ""
    Write-Host "Restoring original file..." -ForegroundColor Cyan
    if (Test-Path $backupPath) {
        Copy-Item $backupPath $clientJarPath -Force
        Remove-Item $backupPath -Force
        Write-Host "  ✓ File restored" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "=== Test Complete ===" -ForegroundColor Cyan
    Write-Host "Evidence saved to: $evidenceDir" -ForegroundColor Yellow
} else {
    Write-Host "[4/4] Waiting for manual test..." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  File is corrupted and ready for testing." -ForegroundColor Yellow
    Write-Host "  Run MineAnvil now, then re-run this script with -ParseOnly" -ForegroundColor Yellow
}

