# Scenario B: Quarantine Corrupted Final Artifact
# Usage: .\scripts\validation\scenario-b-run.ps1 [-InstanceId default] [-EvidenceDir "path"] [-Verbose]

param(
    [string]$InstanceId = "default",
    [string]$EvidenceDir = "",
    [switch]$Verbose
)

$ErrorActionPreference = "Continue"

# Paths
$appData = $env:APPDATA
$quarantinePath = Join-Path $appData "MineAnvil\instances\$InstanceId\.quarantine"
$lockfilePath = Join-Path $appData "MineAnvil\instances\$InstanceId\pack\lock.json"
$logPath = Join-Path $appData "MineAnvil\instances\$InstanceId\logs\mineanvil-main.log"

# Create evidence directory if not provided
if ([string]::IsNullOrEmpty($EvidenceDir)) {
    $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $EvidenceDir = Join-Path (Get-Location) "prompts\02-evidence\L2\sp2.3-final\20260102-180200"
}
New-Item -ItemType Directory -Path $EvidenceDir -Force | Out-Null

Write-Host "=== Scenario B: Quarantine Corrupted Final Artifact ===" -ForegroundColor Cyan
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

# Step 2: Find a library artifact to corrupt
Write-Host "[2/6] Finding a library artifact to corrupt..." -ForegroundColor Cyan
if (-not (Test-Path $lockfilePath)) {
    Write-Host "  ERROR: Lockfile not found: $lockfilePath" -ForegroundColor Red
    exit 1
}

$lockfile = Get-Content $lockfilePath | ConvertFrom-Json

# Find a library artifact that exists and is moderately sized (100KB - 5MB)
$libraries = $lockfile.artifacts | Where-Object { 
    $_.kind -eq "library" -and 
    $_.size -gt 100000 -and 
    $_.size -lt 5000000 
}

if ($libraries.Count -eq 0) {
    Write-Host "  ERROR: No suitable library artifacts found" -ForegroundColor Red
    exit 1
}

$library = $libraries[0]
$mcDir = Join-Path $appData "MineAnvil\instances\$InstanceId\.minecraft"
$finalPath = Join-Path $mcDir ($library.path -replace "^\.minecraft/", "")

if (-not (Test-Path $finalPath)) {
    Write-Host "  ERROR: Library artifact not found: $finalPath" -ForegroundColor Red
    Write-Host "  This artifact needs to be installed first. Run MineAnvil to install it." -ForegroundColor Yellow
    exit 1
}

Write-Host "  Selected library: $($library.name)" -ForegroundColor Green
Write-Host "  Path: $finalPath" -ForegroundColor Gray
Write-Host "  Expected size: $($library.size) bytes ($([math]::Round($library.size / 1KB, 2)) KB)" -ForegroundColor Gray

# Step 3: Capture state BEFORE corruption
Write-Host "[3/6] Capturing state BEFORE corruption..." -ForegroundColor Cyan

# Capture quarantine state before
$quarantineBeforePath = Join-Path $EvidenceDir "scenario-b-quarantine-before.txt"
if (Test-Path $quarantinePath) {
    $quarantineFiles = Get-ChildItem -Path $quarantinePath -File -ErrorAction SilentlyContinue
    $quarantineBefore = @()
    foreach ($file in $quarantineFiles) {
        $quarantineBefore += "$($file.Name) | Size: $($file.Length) bytes | Modified: $($file.LastWriteTime)"
    }
    $quarantineBefore | Out-File -FilePath $quarantineBeforePath -Encoding UTF8
    Write-Host "  Captured $($quarantineFiles.Count) file(s) in quarantine." -ForegroundColor Green
} else {
    "Quarantine directory does not exist (clean state)" | Out-File -FilePath $quarantineBeforePath -Encoding UTF8
    Write-Host "  Quarantine directory does not exist (clean state)." -ForegroundColor Green
}

# Capture artifact state before
$artifactBeforePath = Join-Path $EvidenceDir "scenario-b-artifact-before.txt"
$fileInfo = Get-Item $finalPath
$artifactBefore = @()
$artifactBefore += "Name: $($library.name)"
$artifactBefore += "Path: $finalPath"
$artifactBefore += "Size: $($fileInfo.Length) bytes ($([math]::Round($fileInfo.Length / 1KB, 2)) KB)"
$artifactBefore += "Modified: $($fileInfo.LastWriteTime)"
$artifactBefore += "Expected checksum: $($library.checksum.algo) = $($library.checksum.value)"
$artifactBefore | Out-File -FilePath $artifactBeforePath -Encoding UTF8
Write-Host "  Captured artifact state." -ForegroundColor Green

# Step 4: Corrupt the file
Write-Host "[4/6] Corrupting the library artifact..." -ForegroundColor Cyan
$originalSize = $fileInfo.Length

# Append corruption bytes to the file
Add-Content -Path $finalPath -Value "CORRUPTED_BYTES_ADDED_FOR_TESTING_SCENARIO_B" -NoNewline

$corruptedSize = (Get-Item $finalPath).Length
Write-Host "  Corrupted file: $([math]::Round($originalSize / 1KB, 2)) KB -> $([math]::Round($corruptedSize / 1KB, 2)) KB" -ForegroundColor Green
Write-Host "  Added corruption bytes to end of file." -ForegroundColor Gray

# Step 5: Capture state AFTER corruption
Write-Host "[5/6] Capturing state AFTER corruption..." -ForegroundColor Cyan

$artifactAfterCorruptionPath = Join-Path $EvidenceDir "scenario-b-artifact-after-corruption.txt"
$fileInfo = Get-Item $finalPath
$artifactAfter = @()
$artifactAfter += "Name: $($library.name)"
$artifactAfter += "Path: $finalPath"
$artifactAfter += "Size: $($fileInfo.Length) bytes ($([math]::Round($fileInfo.Length / 1KB, 2)) KB)"
$artifactAfter += "Modified: $($fileInfo.LastWriteTime)"
$artifactAfter += "Status: CORRUPTED (corruption bytes added)"
$artifactAfter | Out-File -FilePath $artifactAfterCorruptionPath -Encoding UTF8
Write-Host "  Captured corrupted artifact state." -ForegroundColor Green

# Step 6: Summary
Write-Host "[6/6] Summary..." -ForegroundColor Cyan
Write-Host ""
Write-Host "=== Phase 1 Complete (Corruption Created) ===" -ForegroundColor Green
Write-Host "Evidence saved to: $EvidenceDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "Corrupted artifact:" -ForegroundColor Yellow
Write-Host "  Name: $($library.name)" -ForegroundColor White
Write-Host "  Path: $finalPath" -ForegroundColor White
Write-Host "  Original size: $([math]::Round($originalSize / 1KB, 2)) KB" -ForegroundColor White
Write-Host "  Corrupted size: $([math]::Round($corruptedSize / 1KB, 2)) KB" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Run MineAnvil: npm run dev:electron" -ForegroundColor White
Write-Host "2. Wait for installation to complete" -ForegroundColor White
Write-Host "3. Run: .\scripts\validation\scenario-b-assert.ps1 -InstanceId $InstanceId -EvidenceDir `"$EvidenceDir`" -LibraryName `"$($library.name)`"" -ForegroundColor White
Write-Host ""
Write-Host "Status: READY FOR PHASE 2 (Recovery)" -ForegroundColor Green

# Save library info for assertion script
$libraryInfo = @{
    name = $library.name
    path = $library.path
    finalPath = $finalPath
    expectedSize = $library.size
    expectedChecksum = $library.checksum
}
$libraryInfo | ConvertTo-Json | Out-File -FilePath (Join-Path $EvidenceDir "scenario-b-library-info.json") -Encoding UTF8

exit 0




