# Scenario A: Corrupt Staging Artifact Removal + Re-download
# Usage: .\scripts\validation\scenario-a-run.ps1 [-InstanceId default] [-McVersion 1.21.4] [-EvidenceDir "path"] [-Verbose]

param(
    [string]$InstanceId = "default",
    [string]$McVersion = "1.21.4",
    [string]$EvidenceDir = "",
    [switch]$Verbose
)

$ErrorActionPreference = "Continue"

# Paths
$appData = $env:APPDATA
$stagingPath = Join-Path $appData "MineAnvil\instances\$InstanceId\.staging\pack-install"
$finalJarPath = Join-Path $appData "MineAnvil\instances\$InstanceId\.minecraft\versions\$McVersion\$McVersion.jar"
$stagingJarPath = Join-Path $stagingPath ".minecraft\versions\$McVersion\$McVersion.jar"
$logPath = Join-Path $appData "MineAnvil\instances\$InstanceId\logs\mineanvil-main.log"

# Create evidence directory if not provided
if ([string]::IsNullOrEmpty($EvidenceDir)) {
    $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $EvidenceDir = Join-Path (Get-Location) "prompts\02-evidence\L2\sp2.3-final\20260102-180200"
}
New-Item -ItemType Directory -Path $EvidenceDir -Force | Out-Null

Write-Host "=== Scenario A: Corrupt Staging Artifact Removal + Re-download ===" -ForegroundColor Cyan
Write-Host "Instance: $InstanceId" -ForegroundColor Yellow
Write-Host "Minecraft Version: $McVersion" -ForegroundColor Yellow
Write-Host "Evidence Dir: $EvidenceDir" -ForegroundColor Yellow
Write-Host ""

# Step 1: Ensure MineAnvil is not running
Write-Host "[1/7] Ensuring MineAnvil is not running..." -ForegroundColor Cyan
$electronProcs = Get-Process electron -ErrorAction SilentlyContinue
if ($electronProcs) {
    Write-Host "  Found $($electronProcs.Count) Electron process(es), stopping..." -ForegroundColor Yellow
    $electronProcs | Stop-Process -Force
    Start-Sleep -Seconds 2
    Write-Host "  Stopped." -ForegroundColor Green
} else {
    Write-Host "  No Electron processes running." -ForegroundColor Green
}

# Step 2: Delete final client jar to force installer to act
Write-Host "[2/7] Deleting final client jar to force installation..." -ForegroundColor Cyan
if (Test-Path $finalJarPath) {
    Remove-Item $finalJarPath -Force
    Write-Host "  Deleted: $finalJarPath" -ForegroundColor Green
} else {
    Write-Host "  Final jar does not exist (already deleted or never installed)." -ForegroundColor Yellow
}

# Step 3: Capture staging state BEFORE
Write-Host "[3/7] Capturing staging state BEFORE..." -ForegroundColor Cyan
$stagingBeforePath = Join-Path $EvidenceDir "scenario-a-staging-before.txt"
if (Test-Path $stagingPath) {
    $stagingFiles = Get-ChildItem -Path $stagingPath -Recurse -File -ErrorAction SilentlyContinue
    $stagingBefore = @()
    foreach ($file in $stagingFiles) {
        $relativePath = $file.FullName.Replace($stagingPath, "").TrimStart("\")
        $stagingBefore += "$relativePath | Size: $($file.Length) bytes | Modified: $($file.LastWriteTime)"
    }
    $stagingBefore | Out-File -FilePath $stagingBeforePath -Encoding UTF8
    Write-Host "  Captured $($stagingFiles.Count) file(s) in staging." -ForegroundColor Green
} else {
    "Staging directory does not exist (clean state)" | Out-File -FilePath $stagingBeforePath -Encoding UTF8
    Write-Host "  Staging directory does not exist (clean state)." -ForegroundColor Green
}

# Step 4: Start MineAnvil
Write-Host "[4/7] Starting MineAnvil..." -ForegroundColor Cyan
Write-Host "  Starting in background..." -ForegroundColor Gray
$workingDir = Get-Location
$proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c","npm run dev:electron" -PassThru -WindowStyle Minimized -WorkingDirectory $workingDir

if (-not $proc) {
    Write-Host "  ERROR: Failed to start MineAnvil" -ForegroundColor Red
    exit 1
}

Write-Host "  Started (PID: $($proc.Id))" -ForegroundColor Green
Start-Sleep -Seconds 3  # Give it time to initialize

# Step 5: Monitor logs and wait for staging file to be partially written, then kill
Write-Host "[5/7] Monitoring logs and waiting for staging file to be partially written..." -ForegroundColor Cyan
Write-Host "  Looking for client jar download to staging..." -ForegroundColor Gray
Write-Host "  Will kill MineAnvil when staging file is partially written (before completion)..." -ForegroundColor Gray

$startTime = Get-Date
$maxWaitSeconds = 120
$foundDownload = $false
$stagingFileExists = $false
$initialLogSize = 0
if (Test-Path $logPath) {
    $initialLogSize = (Get-Item $logPath).Length
}
$lastLogSize = $initialLogSize
$lastFileSize = 0
$stableSizeCount = 0
$shouldKillNow = $false

while (((Get-Date) - $startTime).TotalSeconds -lt $maxWaitSeconds) {
    # Check log for download start
    if (Test-Path $logPath) {
        $currentLogSize = (Get-Item $logPath).Length
        if ($currentLogSize -gt $lastLogSize) {
            $recent = Get-Content $logPath -Tail 50 -ErrorAction SilentlyContinue
            foreach ($line in $recent) {
                try {
                    $entry = $line | ConvertFrom-Json
                    if ($entry.area -eq "install.deterministic") {
                        $msg = $entry.message
                        
                        # Check for download start for client jar
                        if ($msg -match "downloading artifact to staging") {
                            if ($entry.meta -and $entry.meta.kind -eq "client" -and $entry.meta.name -match $McVersion) {
                                if (-not $foundDownload) {
                                    Write-Host "  [LOG] Download started: $($entry.meta.name)" -ForegroundColor Green
                                    $foundDownload = $true
                                }
                            }
                        }
                    }
                } catch {
                    # Skip non-JSON
                }
            }
            $lastLogSize = $currentLogSize
        }
    }
    
    # Check if staging file exists and is partially written (not full size yet)
    if (Test-Path $stagingJarPath) {
        $fileInfo = Get-Item $stagingJarPath
        $currentSize = $fileInfo.Length
        $expectedSizeMin = 25MB  # Approximate minimum size for 1.21.4.jar
        
        if (-not $stagingFileExists) {
            Write-Host "  [FILE] Staging jar created: $([math]::Round($currentSize / 1MB, 2)) MB" -ForegroundColor Green
            $stagingFileExists = $true
        }
        
        # Kill when file is partially written (between 1MB and 3MB - very early to catch before verification)
        if ($currentSize -gt 1MB -and $currentSize -lt 3MB) {
            # Kill immediately when in this range (partial file)
            Write-Host "  [FILE] Staging jar is partially written: $([math]::Round($currentSize / 1MB, 2)) MB" -ForegroundColor Yellow
            Write-Host "  [FILE] Killing now to create partial staging file..." -ForegroundColor Yellow
            $shouldKillNow = $true
            break
        } elseif ($currentSize -ge $expectedSizeMin) {
            # File reached full size - kill immediately before promotion
            Write-Host "  [FILE] Staging jar reached full size: $([math]::Round($currentSize / 1MB, 2)) MB" -ForegroundColor Yellow
            Write-Host "  [FILE] Killing immediately to prevent promotion..." -ForegroundColor Yellow
            $shouldKillNow = $true
            break
        }
        
        if ($Verbose) {
            Write-Host "  [FILE] Size: $([math]::Round($currentSize / 1MB, 2)) MB (waiting for partial state...)" -ForegroundColor DarkGray
        }
    }
    
    if ($shouldKillNow) {
        break
    }
    
    Start-Sleep -Milliseconds 200
    if (-not $Verbose) {
        Write-Host "." -NoNewline
    }
}

Write-Host ""

# Step 6: Kill MineAnvil
Write-Host "[6/7] Killing MineAnvil..." -ForegroundColor Cyan
$electronProcs = Get-Process electron -ErrorAction SilentlyContinue
if ($electronProcs) {
    $electronProcs | Stop-Process -Force
    Start-Sleep -Seconds 1
    Write-Host "  Killed $($electronProcs.Count) process(es)." -ForegroundColor Green
} else {
    Write-Host "  No Electron processes found (may have already exited)." -ForegroundColor Yellow
}

# Step 7: Corrupt the staging file
Write-Host "[7/7] Corrupting staging file..." -ForegroundColor Cyan
if (Test-Path $stagingJarPath) {
    $originalSize = (Get-Item $stagingJarPath).Length
    # Append corruption bytes
    Add-Content -Path $stagingJarPath -Value "CORRUPTED_BYTES_ADDED_FOR_TESTING" -NoNewline
    $corruptedSize = (Get-Item $stagingJarPath).Length
    Write-Host "  Corrupted staging file: $([math]::Round($originalSize / 1MB, 2)) MB -> $([math]::Round($corruptedSize / 1MB, 2)) MB" -ForegroundColor Green
} else {
    Write-Host "  WARNING: Staging jar does not exist. Cannot corrupt." -ForegroundColor Red
    Write-Host "  You may need to run this script again or manually create a partial staging file." -ForegroundColor Yellow
}

# Capture evidence after corruption
Write-Host ""
Write-Host "Capturing evidence after corruption..." -ForegroundColor Cyan

# Staging state AFTER corruption
$stagingAfterCorruptionPath = Join-Path $EvidenceDir "scenario-a-staging-after-corruption.txt"
if (Test-Path $stagingPath) {
    $stagingFiles = Get-ChildItem -Path $stagingPath -Recurse -File -ErrorAction SilentlyContinue
    $stagingAfter = @()
    foreach ($file in $stagingFiles) {
        $relativePath = $file.FullName.Replace($stagingPath, "").TrimStart("\")
        $stagingAfter += "$relativePath | Size: $($file.Length) bytes | Modified: $($file.LastWriteTime)"
    }
    $stagingAfter | Out-File -FilePath $stagingAfterCorruptionPath -Encoding UTF8
    Write-Host "  Captured $($stagingFiles.Count) file(s) in staging after corruption." -ForegroundColor Green
} else {
    "Staging directory does not exist" | Out-File -FilePath $stagingAfterCorruptionPath -Encoding UTF8
    Write-Host "  Staging directory does not exist." -ForegroundColor Yellow
}

# Final jar existence check (should not exist yet)
$finalJarCheckPath = Join-Path $EvidenceDir "scenario-a-final-jar-before-recovery.txt"
$finalJarExists = Test-Path $finalJarPath
if ($finalJarExists) {
    $jarInfo = Get-Item $finalJarPath
    "EXISTS | Size: $($jarInfo.Length) bytes | Modified: $($jarInfo.LastWriteTime)" | Out-File -FilePath $finalJarCheckPath -Encoding UTF8
    Write-Host "  WARNING: Final jar exists (killed too late?)" -ForegroundColor Red
} else {
    "MISSING (expected - promotion should not have occurred)" | Out-File -FilePath $finalJarCheckPath -Encoding UTF8
    Write-Host "  Final jar missing (expected - promotion should not have occurred)." -ForegroundColor Green
}

# Summary
Write-Host ""
Write-Host "=== Phase 1 Complete (Corruption Created) ===" -ForegroundColor Green
Write-Host "Evidence saved to: $EvidenceDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Run MineAnvil again: npm run dev:electron" -ForegroundColor White
Write-Host "2. Wait for installation to complete" -ForegroundColor White
Write-Host "3. Run: .\scripts\validation\scenario-a-assert.ps1 -InstanceId $InstanceId -McVersion $McVersion -EvidenceDir `"$EvidenceDir`"" -ForegroundColor White
Write-Host ""

if (-not $finalJarExists) {
    Write-Host "Status: READY FOR PHASE 2 (Recovery)" -ForegroundColor Green
    exit 0
} else {
    Write-Host "Status: WARNING - Final jar exists. May have killed too late." -ForegroundColor Yellow
    exit 1
}

