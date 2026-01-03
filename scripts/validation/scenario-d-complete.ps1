# Scenario D: Complete failure-path validation
# This script ensures MineAnvil is stopped, corrupts lockfile, starts MineAnvil, and captures errors

param(
    [string]$InstanceId = "default",
    [string]$EvidenceDir = "prompts\02-evidence\L2\sp2.3-final\20260102-180200"
)

$ErrorActionPreference = "Continue"

# Paths
$appData = $env:APPDATA
$lockfilePath = Join-Path $appData "MineAnvil\instances\$InstanceId\pack\lock.json"
$backupPath = "$lockfilePath.backup"
$logPath = Join-Path $appData "MineAnvil\instances\$InstanceId\logs\mineanvil-main.log"

Write-Host "=== Scenario D: Complete Failure-Path Validation ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Stop MineAnvil completely
Write-Host "[1/5] Stopping MineAnvil..." -ForegroundColor Cyan
$electronProcs = Get-Process electron -ErrorAction SilentlyContinue
if ($electronProcs) {
    $electronProcs | Stop-Process -Force
    Start-Sleep -Seconds 3
    Write-Host "  Stopped $($electronProcs.Count) process(es)." -ForegroundColor Green
} else {
    Write-Host "  No processes running." -ForegroundColor Green
}

# Step 2: Backup lockfile if not already backed up
Write-Host "[2/5] Backing up lockfile..." -ForegroundColor Cyan
if (-not (Test-Path $backupPath)) {
    if (Test-Path $lockfilePath) {
        Copy-Item $lockfilePath $backupPath -Force
        Write-Host "  Backed up to: $backupPath" -ForegroundColor Green
    } else {
        Write-Host "  ERROR: Lockfile not found" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "  Backup already exists." -ForegroundColor Yellow
}

# Step 3: Corrupt lockfile
Write-Host "[3/5] Corrupting lockfile..." -ForegroundColor Cyan
Set-Content -Path $lockfilePath -Value '{corrupted: true, invalid: "lockfile"}' -Encoding UTF8
Write-Host "  Lockfile corrupted." -ForegroundColor Green

# Step 4: Start MineAnvil and wait for error
Write-Host "[4/5] Starting MineAnvil with corrupted lockfile..." -ForegroundColor Cyan
$workingDir = Get-Location
Start-Process -FilePath "cmd.exe" -ArgumentList "/c","npm run dev:electron" -WindowStyle Minimized -WorkingDirectory $workingDir
Write-Host "  Started. Waiting for error detection..." -ForegroundColor Gray

# Wait for error to be logged
$startTime = Get-Date
$maxWaitSeconds = 30
$errorFound = $false

while (((Get-Date) - $startTime).TotalSeconds -lt $maxWaitSeconds) {
    if (Test-Path $logPath) {
        $recent = Get-Content $logPath -Tail 20 -ErrorAction SilentlyContinue
        foreach ($line in $recent) {
            try {
                $entry = $line | ConvertFrom-Json
                if (($entry.level -eq "error" -or $entry.level -eq "fatal") -and 
                    ($entry.message -match "lockfile" -or $entry.area -eq "startup")) {
                    $errorFound = $true
                    Write-Host "  Error detected in logs!" -ForegroundColor Green
                    break
                }
            } catch {
                # Skip non-JSON
            }
        }
    }
    if ($errorFound) {
        break
    }
    Start-Sleep -Milliseconds 500
}

if (-not $errorFound) {
    Write-Host "  WARNING: No error detected in logs after $maxWaitSeconds seconds." -ForegroundColor Yellow
}

# Step 5: Run assertion
Write-Host "[5/5] Running assertion..." -ForegroundColor Cyan
powershell -File scripts\validation\scenario-d-assert.ps1 -InstanceId $InstanceId -EvidenceDir $EvidenceDir -BackupPath $backupPath

Write-Host ""
Write-Host "=== Scenario D Complete ===" -ForegroundColor Green


