# SP2.3 Validation B2: Phase 1 - Create staging artifact and kill before promote
# Usage: .\scripts\validation\sp2.3-b2-run.ps1 -InstanceId default -McVersion 1.21.4 [-Verbose] [-vvv]

param(
    [string]$InstanceId = "default",
    [string]$McVersion = "1.21.4",
    [switch]$Verbose,
    [switch]$vvv
)

$ErrorActionPreference = "Continue"

# Paths
$appData = $env:APPDATA
$stagingPath = Join-Path $appData "MineAnvil\instances\$InstanceId\.staging\pack-install"
$finalJarPath = Join-Path $appData "MineAnvil\instances\$InstanceId\.minecraft\versions\$McVersion\$McVersion.jar"
$logPath = Join-Path $appData "MineAnvil\instances\$InstanceId\logs\mineanvil-main.log"
$evidenceDir = Join-Path (Get-Location) "evidence\sp2.3-b2\$(Get-Date -Format 'yyyyMMdd-HHmmss')"

Write-Host "=== SP2.3 Validation B2: Phase 1 (Create Staging, Kill Before Promote) ===" -ForegroundColor Cyan
Write-Host "Instance: $InstanceId" -ForegroundColor Yellow
Write-Host "Minecraft Version: $McVersion" -ForegroundColor Yellow
Write-Host "Evidence Dir: $evidenceDir" -ForegroundColor Yellow
if ($Verbose -or $vvv) {
    Write-Host "Verbose mode: ON" -ForegroundColor Gray
}
Write-Host ""

# Create evidence directory
New-Item -ItemType Directory -Path $evidenceDir -Force | Out-Null

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

# Step 2: Delete final client jar to force installer to act
Write-Host "[2/6] Deleting final client jar to force installation..." -ForegroundColor Cyan
if (Test-Path $finalJarPath) {
    Remove-Item $finalJarPath -Force
    Write-Host "  Deleted: $finalJarPath" -ForegroundColor Green
} else {
    Write-Host "  Final jar does not exist (already deleted or never installed)." -ForegroundColor Yellow
}

# Step 3: Capture staging state BEFORE
Write-Host "[3/6] Capturing staging state BEFORE..." -ForegroundColor Cyan
$stagingBeforePath = Join-Path $evidenceDir "staging-before.txt"
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
Write-Host "[4/6] Starting MineAnvil..." -ForegroundColor Cyan
$workingDir = Get-Location
$proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c","npm run dev:electron" -PassThru -WindowStyle Minimized -WorkingDirectory $workingDir

if (-not $proc) {
    Write-Host "  ERROR: Failed to start MineAnvil" -ForegroundColor Red
    exit 1
}

Write-Host "  Started (PID: $($proc.Id))" -ForegroundColor Green
Start-Sleep -Seconds 3  # Give it time to initialize

# Step 5: Monitor logs and wait for staging file to be full size
Write-Host "[5/6] Monitoring logs and waiting for staging file to be full size..." -ForegroundColor Cyan
Write-Host "  Looking for client jar download and verification..." -ForegroundColor Gray

$startTime = Get-Date
$maxWaitSeconds = 120
$foundDownload = $false
$foundVerification = $false
$stagingJarPath = Join-Path $stagingPath ".minecraft\versions\$McVersion\$McVersion.jar"
$expectedSizeMin = 25MB  # Approximate minimum size for 1.21.4.jar
$initialLogSize = 0
if (Test-Path $logPath) {
    $initialLogSize = (Get-Item $logPath).Length
}
$lastLogSize = $initialLogSize
$lastFileSize = 0
$stableSizeCount = 0
$shouldKillNow = $false

# Track what we're looking for
$targetArtifactName = "$McVersion.jar"
$targetArtifactKind = "client"

while (((Get-Date) - $startTime).TotalSeconds -lt $maxWaitSeconds) {
    # Check log for download start (only process entries newer than script start)
    if (Test-Path $logPath) {
        $currentLogSize = (Get-Item $logPath).Length
        if ($currentLogSize -gt $lastLogSize) {
            # Read recent lines and filter by timestamp
            $recent = Get-Content $logPath -Tail 200 -ErrorAction SilentlyContinue
            foreach ($line in $recent) {
                # Only process entries with timestamps after script start
                try {
                    $entry = $line | ConvertFrom-Json
                    $entryTime = if ($entry.ts) { [DateTime]::Parse($entry.ts) } else { $null }
                    if ($null -eq $entryTime -or $entryTime -lt $startTime) {
                        continue  # Skip old entries
                    }
                } catch {
                    continue  # Skip non-JSON or invalid entries
                }
                
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
                                    if ($vvv) {
                                        Write-Host "    Meta: $($entry.meta | ConvertTo-Json -Compress)" -ForegroundColor DarkGray
                                    }
                                }
                            }
                        }
                        
                        # Check for checksum verification (means download complete, kill before promotion)
                        if ($msg -match "artifact checksum verified") {
                            if ($entry.meta -and $entry.meta.name -match $McVersion) {
                                if (-not $foundVerification) {
                                    Write-Host "  [LOG] Checksum verified: $($entry.meta.name)" -ForegroundColor Green
                                    Write-Host "  [LOG] Killing immediately (download complete, before promotion)..." -ForegroundColor Yellow
                                    $foundVerification = $true
                                    $shouldKillNow = $true
                                    break
                                }
                            }
                        }
                        
                        # Check for promotion (we want to kill BEFORE this)
                        if ($msg -match "promoting artifacts from staging to final location") {
                            Write-Host "  [LOG] WARNING: Promotion detected! Killing immediately..." -ForegroundColor Red
                            $foundVerification = $true  # Force exit
                            $shouldKillNow = $true
                            break
                        }
                    }
                } catch {
                    # Skip non-JSON
                }
            }
            $lastLogSize = $currentLogSize
        }
    }
    
    # Check if staging file exists and is full size - kill IMMEDIATELY when it reaches size
    if (Test-Path $stagingJarPath) {
        $fileInfo = Get-Item $stagingJarPath
        $currentSize = $fileInfo.Length
        
        if ($currentSize -ge $expectedSizeMin) {
            # File reached expected size - kill IMMEDIATELY (don't wait for stability)
            Write-Host "  [FILE] Staging jar reached full size: $([math]::Round($currentSize / 1MB, 2)) MB" -ForegroundColor Green
            Write-Host "  [FILE] Killing immediately to prevent promotion..." -ForegroundColor Yellow
            $shouldKillNow = $true
            break
        } elseif ($vvv) {
            Write-Host "  [FILE] Size: $([math]::Round($currentSize / 1MB, 2)) MB (waiting for full size...)" -ForegroundColor DarkGray
        }
        $lastFileSize = $currentSize
    }
    
    # If promotion was detected in logs, kill immediately
    if ($shouldKillNow) {
        break
    }
    
    Start-Sleep -Milliseconds 500
    if (-not $Verbose -and -not $vvv) {
        Write-Host "." -NoNewline
    } elseif ($vvv) {
        $elapsed = [math]::Round(((Get-Date) - $startTime).TotalSeconds, 1)
        Write-Host "  [${elapsed}s] Monitoring..." -ForegroundColor DarkGray
    }
}

Write-Host ""

# Step 6: Kill MineAnvil
Write-Host "[6/6] Killing MineAnvil..." -ForegroundColor Cyan
$electronProcs = Get-Process electron -ErrorAction SilentlyContinue
if ($electronProcs) {
    $electronProcs | Stop-Process -Force
    Start-Sleep -Seconds 1
    Write-Host "  Killed $($electronProcs.Count) process(es)." -ForegroundColor Green
} else {
    Write-Host "  No Electron processes found (may have already exited)." -ForegroundColor Yellow
}

# Capture evidence
Write-Host ""
Write-Host "Capturing evidence..." -ForegroundColor Cyan

# Staging state AFTER
$stagingAfterPath = Join-Path $evidenceDir "staging-after.txt"
if (Test-Path $stagingPath) {
    $stagingFiles = Get-ChildItem -Path $stagingPath -Recurse -File -ErrorAction SilentlyContinue
    $stagingAfter = @()
    foreach ($file in $stagingFiles) {
        $relativePath = $file.FullName.Replace($stagingPath, "").TrimStart("\")
        $stagingAfter += "$relativePath | Size: $($file.Length) bytes | Modified: $($file.LastWriteTime)"
    }
    $stagingAfter | Out-File -FilePath $stagingAfterPath -Encoding UTF8
    Write-Host "  Captured $($stagingFiles.Count) file(s) in staging." -ForegroundColor Green
} else {
    "Staging directory does not exist" | Out-File -FilePath $stagingAfterPath -Encoding UTF8
    Write-Host "  Staging directory does not exist." -ForegroundColor Yellow
}

# Final jar existence check
$finalJarCheckPath = Join-Path $evidenceDir "final-jar-check.txt"
$finalJarExists = Test-Path $finalJarPath
if ($finalJarExists) {
    $jarInfo = Get-Item $finalJarPath
    "EXISTS | Size: $($jarInfo.Length) bytes | Modified: $($jarInfo.LastWriteTime)" | Out-File -FilePath $finalJarCheckPath -Encoding UTF8
    Write-Host "  WARNING: Final jar exists (killed too late?)" -ForegroundColor Red
} else {
    "MISSING (expected - promotion should not have occurred)" | Out-File -FilePath $finalJarCheckPath -Encoding UTF8
    Write-Host "  Final jar missing (expected - promotion should not have occurred)." -ForegroundColor Green
}

# Log excerpts
$logExcerptsPath = Join-Path $evidenceDir "log-excerpts-phase1.txt"
$logExcerpts = @()
if (Test-Path $logPath) {
    $logContent = Get-Content $logPath -ErrorAction SilentlyContinue
    foreach ($line in $logContent) {
        try {
            $entry = $line | ConvertFrom-Json
            if ($entry.area -eq "install.deterministic" -or $entry.area -eq "install.planner") {
                $msg = $entry.message
                if ($msg -match "staging|recovery|resuming|downloading|promoting|checksum|artifact") {
                    $logExcerpts += "[$($entry.ts)] [$($entry.level)] $msg"
                    if ($entry.meta) {
                        $logExcerpts += "  Meta: $($entry.meta | ConvertTo-Json -Compress)"
                    }
                }
            }
        } catch {
            # Skip non-JSON
        }
    }
}
$logExcerpts | Out-File -FilePath $logExcerptsPath -Encoding UTF8
Write-Host "  Captured $($logExcerpts.Count) relevant log entries." -ForegroundColor Green

# Summary
Write-Host ""
Write-Host "=== Phase 1 Complete ===" -ForegroundColor Green
Write-Host "Evidence saved to: $evidenceDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Run MineAnvil again: npm run dev:electron" -ForegroundColor White
Write-Host "2. Wait for installation to complete" -ForegroundColor White
Write-Host "3. Run: .\scripts\validation\sp2.3-b2-assert.ps1 -InstanceId $InstanceId -McVersion $McVersion -EvidenceDir `"$evidenceDir`"" -ForegroundColor White
Write-Host ""

if (-not $finalJarExists) {
    Write-Host "Status: READY FOR PHASE 2" -ForegroundColor Green
    exit 0
} else {
    Write-Host "Status: WARNING - Final jar exists. May have killed too late." -ForegroundColor Yellow
    exit 1
}

