# SP2.3 Final Validation Script
# This script guides the operator through all remaining SP2.3 validation scenarios
# Usage: .\scripts\validation\sp2.3-final-validation.ps1 [-InstanceId default] [-McVersion 1.21.4] [-SkipScenarios A,B,C,D]

param(
    [string]$InstanceId = "default",
    [string]$McVersion = "1.21.4",
    [string]$SkipScenarios = "",
    [switch]$Verbose
)

$ErrorActionPreference = "Continue"

# Create evidence directory
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$evidenceDir = Join-Path (Get-Location) "prompts\02-evidence\L2\sp2.3-final\$timestamp"
New-Item -ItemType Directory -Path $evidenceDir -Force | Out-Null

Write-Host "=== SP2.3 Final Validation ===" -ForegroundColor Cyan
Write-Host "Evidence Directory: $evidenceDir" -ForegroundColor Yellow
Write-Host ""

# Paths
$appData = $env:APPDATA
$stagingPath = Join-Path $appData "MineAnvil\instances\$InstanceId\.staging\pack-install"
$quarantinePath = Join-Path $appData "MineAnvil\instances\$InstanceId\.quarantine"
$rollbackPath = Join-Path $appData "MineAnvil\instances\$InstanceId\.rollback"
$logPath = Join-Path $appData "MineAnvil\instances\$InstanceId\logs\mineanvil-main.log"
$lockfilePath = Join-Path $appData "MineAnvil\instances\$InstanceId\pack\lock.json"

# Scenario A: Corrupt staging artifact removed + re-download
if ($SkipScenarios -notmatch "A") {
    Write-Host "=== Scenario A: Corrupt Staging Artifact Removal + Re-download ===" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "This scenario validates:" -ForegroundColor Yellow
    Write-Host "  - Staging corruption is detected" -ForegroundColor White
    Write-Host "  - Corrupted staging artifact is removed" -ForegroundColor White
    Write-Host "  - Artifact is re-downloaded to staging" -ForegroundColor White
    Write-Host "  - Verified in staging" -ForegroundColor White
    Write-Host "  - Promoted atomically" -ForegroundColor White
    Write-Host "  - Staging cleaned up" -ForegroundColor White
    Write-Host ""
    Write-Host "Steps:" -ForegroundColor Yellow
    Write-Host "1. Choose a large artifact (client jar) from lockfile" -ForegroundColor White
    Write-Host "2. Delete the final artifact so installer needs it" -ForegroundColor White
    Write-Host "3. Start MineAnvil and kill it mid-download to staging so a partial staging file exists" -ForegroundColor White
    Write-Host "4. Corrupt the staging file (modify bytes)" -ForegroundColor White
    Write-Host "5. Re-run MineAnvil and verify recovery" -ForegroundColor White
    Write-Host ""
    $continue = Read-Host "Press Enter to continue with Scenario A, or type 'skip' to skip"
    if ($continue -eq "skip") {
        Write-Host "Skipping Scenario A" -ForegroundColor Yellow
    } else {
        # Capture staging state before
        Write-Host "Capturing staging state before..." -ForegroundColor Cyan
        pwsh -File scripts\validation\list-staging.ps1 -InstanceId $InstanceId | Out-File -FilePath (Join-Path $evidenceDir "scenario-a-staging-before.txt") -Encoding UTF8
        
        # Guide operator through manual steps
        Write-Host ""
        Write-Host "MANUAL STEPS REQUIRED:" -ForegroundColor Yellow
        Write-Host "1. Delete client jar: Remove-Item `"$appData\MineAnvil\instances\$InstanceId\.minecraft\versions\$McVersion\$McVersion.jar`" -Force" -ForegroundColor White
        Write-Host "2. Start MineAnvil: npm run dev:electron" -ForegroundColor White
        Write-Host "3. Wait for download to start, then kill MineAnvil (Ctrl+C or kill process)" -ForegroundColor White
        Write-Host "4. Corrupt the staging file by modifying bytes" -ForegroundColor White
        Write-Host "5. Re-run MineAnvil and let it complete" -ForegroundColor White
        Write-Host ""
        $ready = Read-Host "Type 'done' when you have completed the manual steps"
        
        if ($ready -eq "done") {
            # Capture evidence
            Write-Host "Capturing evidence..." -ForegroundColor Cyan
            pwsh -File scripts\validation\list-staging.ps1 -InstanceId $InstanceId | Out-File -FilePath (Join-Path $evidenceDir "scenario-a-staging-after.txt") -Encoding UTF8
            pwsh -File scripts\validation\parse-recovery-logs.ps1 -InstanceId $InstanceId | Out-File -FilePath (Join-Path $evidenceDir "scenario-a-recovery-logs.txt") -Encoding UTF8
            
            # Check final jar
            $finalJarPath = Join-Path $appData "MineAnvil\instances\$InstanceId\.minecraft\versions\$McVersion\$McVersion.jar"
            if (Test-Path $finalJarPath) {
                $jarInfo = Get-Item $finalJarPath
                "EXISTS | Size: $($jarInfo.Length) bytes | Modified: $($jarInfo.LastWriteTime)" | Out-File -FilePath (Join-Path $evidenceDir "scenario-a-final-jar.txt") -Encoding UTF8
            } else {
                "MISSING" | Out-File -FilePath (Join-Path $evidenceDir "scenario-a-final-jar.txt") -Encoding UTF8
            }
            
            Write-Host "Scenario A evidence captured." -ForegroundColor Green
        }
    }
    Write-Host ""
}

# Scenario B: Quarantine corrupted final artifact
if ($SkipScenarios -notmatch "B") {
    Write-Host "=== Scenario B: Quarantine Corrupted Final Artifact ===" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "This scenario validates:" -ForegroundColor Yellow
    Write-Host "  - Checksum mismatch detected against lockfile" -ForegroundColor White
    Write-Host "  - Corrupted live file moved to quarantine" -ForegroundColor White
    Write-Host "  - Quarantine action logged" -ForegroundColor White
    Write-Host "  - Artifact re-downloaded and promoted cleanly" -ForegroundColor White
    Write-Host ""
    Write-Host "Steps:" -ForegroundColor Yellow
    Write-Host "1. Pick one library jar from lockfile" -ForegroundColor White
    Write-Host "2. Corrupt it (modify bytes) OR replace with a different file" -ForegroundColor White
    Write-Host "3. Run MineAnvil" -ForegroundColor White
    Write-Host ""
    $continue = Read-Host "Press Enter to continue with Scenario B, or type 'skip' to skip"
    if ($continue -eq "skip") {
        Write-Host "Skipping Scenario B" -ForegroundColor Yellow
    } else {
        # Find a library artifact
        Write-Host "Finding a library artifact to corrupt..." -ForegroundColor Cyan
        $libraryPath = pwsh -File scripts\validation\find-library-artifact.ps1 -InstanceId $InstanceId
        
        if ($libraryPath) {
            Write-Host "Found library: $libraryPath" -ForegroundColor Green
            Write-Host ""
            Write-Host "MANUAL STEPS REQUIRED:" -ForegroundColor Yellow
            Write-Host "1. Corrupt the file: Add-Content -Path `"$libraryPath`" -Value 'CORRUPTED'" -ForegroundColor White
            Write-Host "2. Run MineAnvil: npm run dev:electron" -ForegroundColor White
            Write-Host "3. Let installation complete" -ForegroundColor White
            Write-Host ""
            $ready = Read-Host "Type 'done' when you have completed the manual steps"
            
            if ($ready -eq "done") {
                # Capture evidence
                Write-Host "Capturing evidence..." -ForegroundColor Cyan
                pwsh -File scripts\validation\list-quarantine.ps1 -InstanceId $InstanceId | Out-File -FilePath (Join-Path $evidenceDir "scenario-b-quarantine.txt") -Encoding UTF8
                pwsh -File scripts\validation\parse-recovery-logs.ps1 -InstanceId $InstanceId | Out-File -FilePath (Join-Path $evidenceDir "scenario-b-recovery-logs.txt") -Encoding UTF8
                
                # Check if artifact was restored
                if (Test-Path $libraryPath) {
                    $fileInfo = Get-Item $libraryPath
                    "EXISTS | Size: $($fileInfo.Length) bytes | Modified: $($fileInfo.LastWriteTime)" | Out-File -FilePath (Join-Path $evidenceDir "scenario-b-restored-artifact.txt") -Encoding UTF8
                } else {
                    "MISSING" | Out-File -FilePath (Join-Path $evidenceDir "scenario-b-restored-artifact.txt") -Encoding UTF8
                }
                
                Write-Host "Scenario B evidence captured." -ForegroundColor Green
            }
        } else {
            Write-Host "Could not find a library artifact. Skipping Scenario B." -ForegroundColor Yellow
        }
    }
    Write-Host ""
}

# Scenario C: Snapshot validation
if ($SkipScenarios -notmatch "C") {
    Write-Host "=== Scenario C: Snapshot Validation ===" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "This scenario validates:" -ForegroundColor Yellow
    Write-Host "  - Snapshot directory exists after successful run" -ForegroundColor White
    Write-Host "  - Snapshot manifest contains artifact names/paths/checksums" -ForegroundColor White
    Write-Host ""
    Write-Host "Steps:" -ForegroundColor Yellow
    Write-Host "1. Ensure a successful installation has completed" -ForegroundColor White
    Write-Host "2. Check for snapshots" -ForegroundColor White
    Write-Host ""
    $continue = Read-Host "Press Enter to continue with Scenario C, or type 'skip' to skip"
    if ($continue -eq "skip") {
        Write-Host "Skipping Scenario C" -ForegroundColor Yellow
    } else {
        Write-Host "Capturing snapshot evidence..." -ForegroundColor Cyan
        pwsh -File scripts\validation\list-snapshots.ps1 -InstanceId $InstanceId | Out-File -FilePath (Join-Path $evidenceDir "scenario-c-snapshots.txt") -Encoding UTF8
        
        # Read the most recent snapshot
        if (Test-Path $rollbackPath) {
            $snapshots = Get-ChildItem -Path $rollbackPath -Directory | Sort-Object Name -Descending
            if ($snapshots.Count -gt 0) {
                $latestSnapshot = $snapshots[0].Name
                pwsh -File scripts\validation\read-snapshot.ps1 -SnapshotId $latestSnapshot -InstanceId $InstanceId | Out-File -FilePath (Join-Path $evidenceDir "scenario-c-snapshot-manifest.txt") -Encoding UTF8
                Write-Host "Captured snapshot: $latestSnapshot" -ForegroundColor Green
            } else {
                "No snapshots found" | Out-File -FilePath (Join-Path $evidenceDir "scenario-c-snapshot-manifest.txt") -Encoding UTF8
                Write-Host "No snapshots found. Run MineAnvil to complete an installation first." -ForegroundColor Yellow
            }
        } else {
            "Rollback directory does not exist" | Out-File -FilePath (Join-Path $evidenceDir "scenario-c-snapshot-manifest.txt") -Encoding UTF8
            Write-Host "Rollback directory does not exist. Run MineAnvil to complete an installation first." -ForegroundColor Yellow
        }
        
        Write-Host "Scenario C evidence captured." -ForegroundColor Green
    }
    Write-Host ""
}

# Scenario D: Failure-path validation
if ($SkipScenarios -notmatch "D") {
    Write-Host "=== Scenario D: Failure-Path Validation ===" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "This scenario validates:" -ForegroundColor Yellow
    Write-Host "  - Clear failure message path (at least one deterministic failure)" -ForegroundColor White
    Write-Host "  - User-visible error dialog or log message" -ForegroundColor White
    Write-Host ""
    Write-Host "Steps:" -ForegroundColor Yellow
    Write-Host "1. Make lockfile corrupt (temporarily)" -ForegroundColor White
    Write-Host "2. Run MineAnvil" -ForegroundColor White
    Write-Host "3. Capture the error message" -ForegroundColor White
    Write-Host "4. Restore lockfile" -ForegroundColor White
    Write-Host ""
    $continue = Read-Host "Press Enter to continue with Scenario D, or type 'skip' to skip"
    if ($continue -eq "skip") {
        Write-Host "Skipping Scenario D" -ForegroundColor Yellow
    } else {
        if (Test-Path $lockfilePath) {
            # Backup lockfile
            $backupPath = "$lockfilePath.backup"
            Copy-Item $lockfilePath $backupPath -Force
            Write-Host "Backed up lockfile to: $backupPath" -ForegroundColor Green
            
            Write-Host ""
            Write-Host "MANUAL STEPS REQUIRED:" -ForegroundColor Yellow
            Write-Host "1. Corrupt the lockfile: Set-Content -Path `"$lockfilePath`" -Value '{corrupted}'" -ForegroundColor White
            Write-Host "2. Run MineAnvil: npm run dev:electron" -ForegroundColor White
            Write-Host "3. Capture the error dialog text or log message" -ForegroundColor White
            Write-Host "4. Restore lockfile: Copy-Item `"$backupPath`" `"$lockfilePath`" -Force" -ForegroundColor White
            Write-Host ""
            $ready = Read-Host "Type 'done' when you have completed the manual steps"
            
            if ($ready -eq "done") {
                # Capture evidence
                Write-Host "Capturing evidence..." -ForegroundColor Cyan
                
                # Get recent error logs
                if (Test-Path $logPath) {
                    $logContent = Get-Content $logPath -Tail 100 -ErrorAction SilentlyContinue
                    $errorLogs = @()
                    foreach ($line in $logContent) {
                        try {
                            $entry = $line | ConvertFrom-Json
                            if ($entry.level -eq "ERROR" -or $entry.level -eq "FATAL") {
                                $errorLogs += "[$($entry.ts)] [$($entry.level)] $($entry.message)"
                                if ($entry.meta) {
                                    $errorLogs += "  Meta: $($entry.meta | ConvertTo-Json -Compress)"
                                }
                            }
                        } catch {
                            # Skip non-JSON
                        }
                    }
                    $errorLogs | Out-File -FilePath (Join-Path $evidenceDir "scenario-d-failure-path.txt") -Encoding UTF8
                }
                
                Write-Host "Scenario D evidence captured." -ForegroundColor Green
                
                # Restore lockfile
                if (Test-Path $backupPath) {
                    Copy-Item $backupPath $lockfilePath -Force
                    Remove-Item $backupPath -Force
                    Write-Host "Lockfile restored." -ForegroundColor Green
                }
            }
        } else {
            Write-Host "Lockfile not found. Skipping Scenario D." -ForegroundColor Yellow
        }
    }
    Write-Host ""
}

# Generate validation summary
Write-Host "=== Generating Validation Summary ===" -ForegroundColor Cyan
$summaryPath = Join-Path $evidenceDir "validation-summary.md"
$summary = @"
# SP2.3 Final Validation Summary

**Date**: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  
**Instance**: $InstanceId  
**Minecraft Version**: $McVersion  
**Evidence Directory**: $evidenceDir

## Scenarios Validated

### Scenario A: Corrupt Staging Artifact Removal + Re-download
- Evidence: `scenario-a-staging-before.txt`, `scenario-a-staging-after.txt`, `scenario-a-recovery-logs.txt`, `scenario-a-final-jar.txt`
- Validates: Staging corruption detection, removal, re-download, verification, promotion, cleanup

### Scenario B: Quarantine Corrupted Final Artifact
- Evidence: `scenario-b-quarantine.txt`, `scenario-b-recovery-logs.txt`, `scenario-b-restored-artifact.txt`
- Validates: Checksum mismatch detection, quarantine, logging, re-download, promotion

### Scenario C: Snapshot Validation
- Evidence: `scenario-c-snapshots.txt`, `scenario-c-snapshot-manifest.txt`
- Validates: Snapshot creation, manifest presence, artifact listing

### Scenario D: Failure-Path Validation
- Evidence: `scenario-d-failure-path.txt`
- Validates: Clear failure messages, user-visible errors

## Next Steps

1. Review evidence files in: $evidenceDir
2. Update STOP_POINTS.md with proven checklist items
3. Update docs/SP2.3-rollback-recovery.md with evidence references
4. Git commit changes

"@

$summary | Out-File -FilePath $summaryPath -Encoding UTF8
Write-Host "Validation summary saved to: $summaryPath" -ForegroundColor Green
Write-Host ""
Write-Host "=== Validation Complete ===" -ForegroundColor Green
Write-Host "Evidence directory: $evidenceDir" -ForegroundColor Cyan




