# Scenario D: Failure-Path Validation
# Usage: .\scripts\validation\scenario-d-run.ps1 [-InstanceId default] [-EvidenceDir "path"] [-Verbose]

param(
    [string]$InstanceId = "default",
    [string]$EvidenceDir = "",
    [switch]$Verbose
)

$ErrorActionPreference = "Continue"

# Paths
$appData = $env:APPDATA
$lockfilePath = Join-Path $appData "MineAnvil\instances\$InstanceId\pack\lock.json"
$logPath = Join-Path $appData "MineAnvil\instances\$InstanceId\logs\mineanvil-main.log"

# Create evidence directory if not provided
if ([string]::IsNullOrEmpty($EvidenceDir)) {
    $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $EvidenceDir = Join-Path (Get-Location) "prompts\02-evidence\L2\sp2.3-final\20260102-180200"
}
New-Item -ItemType Directory -Path $EvidenceDir -Force | Out-Null

Write-Host "=== Scenario D: Failure-Path Validation ===" -ForegroundColor Cyan
Write-Host "Instance: $InstanceId" -ForegroundColor Yellow
Write-Host "Evidence Dir: $EvidenceDir" -ForegroundColor Yellow
Write-Host ""

# Step 1: Ensure MineAnvil is not running
Write-Host "[1/6] Ensuring MineAnvil is not running..." -ForegroundColor Cyan
$electronProcs = Get-Process electron -ErrorAction SilentlyContinue
if ($electronProcs) {
    Write-Host "  Found $($electronProcs.Count) Electron process(es), stopping..." -ForegroundColor Yellow
    $electronProcs | Stop-Process -Force
    Start-Sleep -Seconds 2
    Write-Host "  Stopped." -ForegroundColor Green
} else {
    Write-Host "  No Electron processes running." -ForegroundColor Green
}

# Step 2: Verify lockfile exists
Write-Host "[2/6] Verifying lockfile exists..." -ForegroundColor Cyan
if (-not (Test-Path $lockfilePath)) {
    Write-Host "  ERROR: Lockfile not found: $lockfilePath" -ForegroundColor Red
    Write-Host "  Lockfile must exist to corrupt it. Run MineAnvil first to create it." -ForegroundColor Yellow
    exit 1
}

Write-Host "  Lockfile found: $lockfilePath" -ForegroundColor Green

# Step 3: Backup lockfile
Write-Host "[3/6] Backing up lockfile..." -ForegroundColor Cyan
$backupPath = "$lockfilePath.backup"
Copy-Item $lockfilePath $backupPath -Force
Write-Host "  Backed up to: $backupPath" -ForegroundColor Green

# Step 4: Capture lockfile state BEFORE corruption
Write-Host "[4/6] Capturing lockfile state BEFORE corruption..." -ForegroundColor Cyan
$lockfileBeforePath = Join-Path $EvidenceDir "scenario-d-lockfile-before.txt"
$lockfileContent = Get-Content $lockfilePath -Raw
$lockfileInfo = @()
$lockfileInfo += "Path: $lockfilePath"
$lockfileInfo += "Size: $($lockfileContent.Length) bytes"
$lockfileInfo += "Modified: $((Get-Item $lockfilePath).LastWriteTime)"
$lockfileInfo += ""
$lockfileInfo += "First 500 characters:"
$lockfileInfo += $lockfileContent.Substring(0, [Math]::Min(500, $lockfileContent.Length))
$lockfileInfo | Out-File -FilePath $lockfileBeforePath -Encoding UTF8
Write-Host "  Captured lockfile state." -ForegroundColor Green

# Step 5: Corrupt the lockfile
Write-Host "[5/6] Corrupting the lockfile..." -ForegroundColor Cyan
Set-Content -Path $lockfilePath -Value '{corrupted: true, invalid: "lockfile"}' -Encoding UTF8
Write-Host "  Corrupted lockfile with invalid JSON." -ForegroundColor Green

# Step 6: Capture lockfile state AFTER corruption
Write-Host "[6/6] Capturing lockfile state AFTER corruption..." -ForegroundColor Cyan
$lockfileAfterCorruptionPath = Join-Path $EvidenceDir "scenario-d-lockfile-after-corruption.txt"
$corruptedContent = Get-Content $lockfilePath -Raw
$lockfileAfter = @()
$lockfileAfter += "Path: $lockfilePath"
$lockfileAfter += "Size: $($corruptedContent.Length) bytes"
$lockfileAfter += "Modified: $((Get-Item $lockfilePath).LastWriteTime)"
$lockfileAfter += ""
$lockfileAfter += "Corrupted content:"
$lockfileAfter += $corruptedContent
$lockfileAfter | Out-File -FilePath $lockfileAfterCorruptionPath -Encoding UTF8
Write-Host "  Captured corrupted lockfile state." -ForegroundColor Green

# Summary
Write-Host ""
Write-Host "=== Phase 1 Complete (Lockfile Corrupted) ===" -ForegroundColor Green
Write-Host "Evidence saved to: $EvidenceDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "Corrupted lockfile:" -ForegroundColor Yellow
Write-Host "  Path: $lockfilePath" -ForegroundColor White
Write-Host "  Backup: $backupPath" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Run MineAnvil: npm run dev:electron" -ForegroundColor White
Write-Host "2. Capture the error dialog text or log message" -ForegroundColor White
Write-Host "3. Restore lockfile: Copy-Item `"$backupPath`" `"$lockfilePath`" -Force" -ForegroundColor White
Write-Host "4. Run: .\scripts\validation\scenario-d-assert.ps1 -InstanceId $InstanceId -EvidenceDir `"$EvidenceDir`" -BackupPath `"$backupPath`"" -ForegroundColor White
Write-Host ""
Write-Host "Status: READY FOR PHASE 2 (Error Capture)" -ForegroundColor Green

exit 0


