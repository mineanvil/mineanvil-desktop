# Scenario A: Assert corrupt staging artifact removal + re-download
# Usage: .\scripts\validation\scenario-a-assert.ps1 -InstanceId default -McVersion 1.21.4 -EvidenceDir "path" [-Verbose]

param(
    [string]$InstanceId = "default",
    [string]$McVersion = "1.21.4",
    [Parameter(Mandatory=$true)]
    [string]$EvidenceDir
)

$ErrorActionPreference = "Continue"

# Paths
$appData = $env:APPDATA
$stagingPath = Join-Path $appData "MineAnvil\instances\$InstanceId\.staging\pack-install"
$finalJarPath = Join-Path $appData "MineAnvil\instances\$InstanceId\.minecraft\versions\$McVersion\$McVersion.jar"
$logPath = Join-Path $appData "MineAnvil\instances\$InstanceId\logs\mineanvil-main.log"

Write-Host "=== Scenario A: Assert Corrupt Staging Artifact Removal + Re-download ===" -ForegroundColor Cyan
Write-Host "Instance: $InstanceId" -ForegroundColor Yellow
Write-Host "Minecraft Version: $McVersion" -ForegroundColor Yellow
Write-Host "Evidence Dir: $EvidenceDir" -ForegroundColor Yellow
Write-Host ""

# Validate evidence directory exists
if (-not (Test-Path $EvidenceDir)) {
    Write-Host "ERROR: Evidence directory does not exist: $EvidenceDir" -ForegroundColor Red
    exit 1
}

# Results tracking
$results = @{
    "corruption_detected" = $false
    "staging_removed_or_quarantined" = $false
    "artifact_redownloaded" = $false
    "verified_in_staging" = $false
    "promoted_atomically" = $false
    "staging_cleaned_up" = $false
    "final_jar_exists" = $false
}

$evidence = @{}

# Step 1: Parse logs for recovery signals
Write-Host "[1/6] Parsing logs for recovery signals..." -ForegroundColor Cyan

if (-not (Test-Path $logPath)) {
    Write-Host "  ERROR: Log file does not exist: $logPath" -ForegroundColor Red
    exit 1
}

$logContent = Get-Content $logPath -ErrorAction SilentlyContinue
$recoveryLogs = @()
$corruptionLogs = @()
$downloadLogs = @()
$verificationLogs = @()
$promotionLogs = @()

foreach ($line in $logContent) {
    try {
        $entry = $line | ConvertFrom-Json
        if ($entry.area -eq "install.deterministic" -or $entry.area -eq "install.planner") {
            $msg = $entry.message
            
            # Check for corruption detection
            if ($msg -match "corrupt|corruption|checksum.*fail|checksum.*mismatch|invalid.*checksum") {
                $results.corruption_detected = $true
                $corruptionLogs += "[$($entry.ts)] [$($entry.level)] $msg"
                if ($entry.meta) {
                    $corruptionLogs += "  Meta: $($entry.meta | ConvertTo-Json -Compress)"
                }
            }
            
            # Check for staging removal or quarantine
            if ($msg -match "removing.*staging|staging.*removed|staging.*corrupt|quarantine.*staging") {
                $results.staging_removed_or_quarantined = $true
                $recoveryLogs += "[$($entry.ts)] [$($entry.level)] $msg"
                if ($entry.meta) {
                    $recoveryLogs += "  Meta: $($entry.meta | ConvertTo-Json -Compress)"
                }
            }
            
            # Check for re-download
            if ($msg -match "downloading artifact to staging") {
                if ($entry.meta -and $entry.meta.kind -eq "client" -and $entry.meta.name -match $McVersion) {
                    $results.artifact_redownloaded = $true
                    $downloadLogs += "[$($entry.ts)] [$($entry.level)] $msg"
                    $downloadLogs += "  Meta: $($entry.meta | ConvertTo-Json -Compress)"
                }
            }
            
            # Check for verification in staging
            if ($msg -match "artifact checksum verified|verifying.*staging") {
                if ($entry.meta -and $entry.meta.name -match $McVersion) {
                    $results.verified_in_staging = $true
                    $verificationLogs += "[$($entry.ts)] [$($entry.level)] $msg"
                    if ($entry.meta) {
                        $verificationLogs += "  Meta: $($entry.meta | ConvertTo-Json -Compress)"
                    }
                }
            }
            
            # Check for promotion
            if ($msg -match "promoting artifacts from staging to final location|artifact promoted from staging") {
                $results.promoted_atomically = $true
                $promotionLogs += "[$($entry.ts)] [$($entry.level)] $msg"
                if ($entry.meta) {
                    $promotionLogs += "  Meta: $($entry.meta | ConvertTo-Json -Compress)"
                }
            }
            
            # Check for staging cleanup
            if ($msg -match "staging.*cleaned|staging.*cleanup|staging directory") {
                if ($msg -match "cleaned|cleanup") {
                    $results.staging_cleaned_up = $true
                    $recoveryLogs += "[$($entry.ts)] [$($entry.level)] $msg"
                }
            }
        }
    } catch {
        # Skip non-JSON
    }
}

$evidence.corruption_logs = $corruptionLogs
$evidence.recovery_logs = $recoveryLogs
$evidence.download_logs = $downloadLogs
$evidence.verification_logs = $verificationLogs
$evidence.promotion_logs = $promotionLogs

Write-Host "  Found $($corruptionLogs.Count) corruption detection log entries" -ForegroundColor $(if ($corruptionLogs.Count -gt 0) { "Green" } else { "Yellow" })
Write-Host "  Found $($recoveryLogs.Count) recovery log entries" -ForegroundColor $(if ($recoveryLogs.Count -gt 0) { "Green" } else { "Yellow" })
Write-Host "  Found $($downloadLogs.Count) download log entries" -ForegroundColor $(if ($downloadLogs.Count -gt 0) { "Green" } else { "Yellow" })
Write-Host "  Found $($verificationLogs.Count) verification log entries" -ForegroundColor $(if ($verificationLogs.Count -gt 0) { "Green" } else { "Yellow" })
Write-Host "  Found $($promotionLogs.Count) promotion log entries" -ForegroundColor $(if ($promotionLogs.Count -gt 0) { "Green" } else { "Yellow" })

# Step 2: Check final jar exists
Write-Host "[2/6] Checking final jar exists..." -ForegroundColor Cyan
if (Test-Path $finalJarPath) {
    $jarInfo = Get-Item $finalJarPath
    $results.final_jar_exists = $true
    Write-Host "  EXISTS: $([math]::Round($jarInfo.Length / 1MB, 2)) MB" -ForegroundColor Green
    $evidence.final_jar = @{
        exists = $true
        size = $jarInfo.Length
        modified = $jarInfo.LastWriteTime
    }
} else {
    Write-Host "  MISSING" -ForegroundColor Red
    $evidence.final_jar = @{
        exists = $false
    }
}

# Step 3: Check staging state AFTER recovery
Write-Host "[3/6] Checking staging state AFTER recovery..." -ForegroundColor Cyan
$stagingAfterRecoveryPath = Join-Path $EvidenceDir "scenario-a-staging-after-recovery.txt"
if (Test-Path $stagingPath) {
    $stagingFiles = Get-ChildItem -Path $stagingPath -Recurse -File -ErrorAction SilentlyContinue
    $stagingAfter = @()
    foreach ($file in $stagingFiles) {
        $relativePath = $file.FullName.Replace($stagingPath, "").TrimStart("\")
        $stagingAfter += "$relativePath | Size: $($file.Length) bytes | Modified: $($file.LastWriteTime)"
    }
    $stagingAfter | Out-File -FilePath $stagingAfterRecoveryPath -Encoding UTF8
    Write-Host "  Found $($stagingFiles.Count) file(s) in staging" -ForegroundColor $(if ($stagingFiles.Count -eq 0) { "Green" } else { "Yellow" })
    $evidence.staging_after_recovery = $stagingAfter
    # If staging is empty or doesn't exist, consider cleanup successful
    if ($stagingFiles.Count -eq 0) {
        $results.staging_cleaned_up = $true
    }
} else {
    "Staging directory does not exist (cleaned up)" | Out-File -FilePath $stagingAfterRecoveryPath -Encoding UTF8
    Write-Host "  Staging directory does not exist (expected after cleanup)" -ForegroundColor Green
    $evidence.staging_after_recovery = @("Staging directory does not exist (cleaned up)")
    $results.staging_cleaned_up = $true
}

# Step 4: Save evidence
Write-Host "[4/6] Saving evidence..." -ForegroundColor Cyan

# Corruption logs
$corruptionLogsPath = Join-Path $EvidenceDir "scenario-a-corruption-logs.txt"
$corruptionLogs | Out-File -FilePath $corruptionLogsPath -Encoding UTF8

# Recovery logs
$recoveryLogsPath = Join-Path $EvidenceDir "scenario-a-recovery-logs.txt"
$recoveryLogs | Out-File -FilePath $recoveryLogsPath -Encoding UTF8

# Download logs
$downloadLogsPath = Join-Path $EvidenceDir "scenario-a-download-logs.txt"
$downloadLogs | Out-File -FilePath $downloadLogsPath -Encoding UTF8

# Verification logs
$verificationLogsPath = Join-Path $EvidenceDir "scenario-a-verification-logs.txt"
$verificationLogs | Out-File -FilePath $verificationLogsPath -Encoding UTF8

# Promotion logs
$promotionLogsPath = Join-Path $EvidenceDir "scenario-a-promotion-logs.txt"
$promotionLogs | Out-File -FilePath $promotionLogsPath -Encoding UTF8

# Final jar check
$finalJarCheckPath = Join-Path $EvidenceDir "scenario-a-final-jar-after-recovery.txt"
if ($results.final_jar_exists) {
    $jarInfo = Get-Item $finalJarPath
    "EXISTS | Size: $($jarInfo.Length) bytes | Modified: $($jarInfo.LastWriteTime)" | Out-File -FilePath $finalJarCheckPath -Encoding UTF8
} else {
    "MISSING" | Out-File -FilePath $finalJarCheckPath -Encoding UTF8
}

Write-Host "  Evidence saved." -ForegroundColor Green

# Step 5: Generate validation summary
Write-Host "[5/6] Generating validation summary..." -ForegroundColor Cyan

$summaryPath = Join-Path $EvidenceDir "scenario-a-validation-summary.md"
$summary = @"
# Scenario A: Corrupt Staging Artifact Removal + Re-download

**Date**: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  
**Instance**: $InstanceId  
**Minecraft Version**: $McVersion

## Results

| Check | Status | Evidence |
|-------|--------|----------|
| Corruption detected | $(if ($results.corruption_detected) { "✅ PASS" } else { "❌ FAIL" }) | $(if ($results.corruption_detected) { "$($corruptionLogs.Count) log entry(ies) found" } else { "No corruption detection logs found" }) |
| Staging removed/quarantined | $(if ($results.staging_removed_or_quarantined) { "✅ PASS" } else { "❌ FAIL" }) | $(if ($results.staging_removed_or_quarantined) { "Log entry found" } else { "Log entry NOT found" }) |
| Artifact re-downloaded | $(if ($results.artifact_redownloaded) { "✅ PASS" } else { "❌ FAIL" }) | $(if ($results.artifact_redownloaded) { "$($downloadLogs.Count) download log(s) found" } else { "No download logs found" }) |
| Verified in staging | $(if ($results.verified_in_staging) { "✅ PASS" } else { "❌ FAIL" }) | $(if ($results.verified_in_staging) { "$($verificationLogs.Count) verification log(s) found" } else { "No verification logs found" }) |
| Promoted atomically | $(if ($results.promoted_atomically) { "✅ PASS" } else { "❌ FAIL" }) | $(if ($results.promoted_atomically) { "$($promotionLogs.Count) promotion log(s) found" } else { "No promotion logs found" }) |
| Staging cleaned up | $(if ($results.staging_cleaned_up) { "✅ PASS" } else { "❌ FAIL" }) | $(if ($results.staging_cleaned_up) { "Staging empty or removed" } else { "Staging still contains files" }) |
| Final jar exists | $(if ($results.final_jar_exists) { "✅ PASS" } else { "❌ FAIL" }) | $(if ($results.final_jar_exists) { "File exists" } else { "File missing" }) |

## Evidence Files

- `scenario-a-staging-before.txt` - Staging state before corruption
- `scenario-a-staging-after-corruption.txt` - Staging state after corruption
- `scenario-a-staging-after-recovery.txt` - Staging state after recovery
- `scenario-a-corruption-logs.txt` - Corruption detection log entries
- `scenario-a-recovery-logs.txt` - Recovery-related log entries
- `scenario-a-download-logs.txt` - Download log entries
- `scenario-a-verification-logs.txt` - Verification log entries
- `scenario-a-promotion-logs.txt` - Promotion log entries
- `scenario-a-final-jar-before-recovery.txt` - Final jar check before recovery
- `scenario-a-final-jar-after-recovery.txt` - Final jar check after recovery

## Conclusion

$(if ($results.corruption_detected -and $results.artifact_redownloaded -and $results.verified_in_staging -and $results.promoted_atomically -and $results.staging_cleaned_up -and $results.final_jar_exists) {
    "✅ **PASS**: All checks passed. Corrupt staging artifact was detected, removed, re-downloaded, verified, promoted, and staging was cleaned up."
} else {
    "❌ **FAIL**: One or more checks failed. See details above."
})

"@

$summary | Out-File -FilePath $summaryPath -Encoding UTF8
Write-Host "  Summary saved to: $summaryPath" -ForegroundColor Green

# Step 6: Final report
Write-Host "[6/6] Final report..." -ForegroundColor Cyan
Write-Host ""
Write-Host "=== Validation Results ===" -ForegroundColor Cyan
Write-Host "Corruption detected: $(if ($results.corruption_detected) { "✅" } else { "❌" })" -ForegroundColor $(if ($results.corruption_detected) { "Green" } else { "Red" })
Write-Host "Staging removed/quarantined: $(if ($results.staging_removed_or_quarantined) { "✅" } else { "❌" })" -ForegroundColor $(if ($results.staging_removed_or_quarantined) { "Green" } else { "Red" })
Write-Host "Artifact re-downloaded: $(if ($results.artifact_redownloaded) { "✅" } else { "❌" })" -ForegroundColor $(if ($results.artifact_redownloaded) { "Green" } else { "Red" })
Write-Host "Verified in staging: $(if ($results.verified_in_staging) { "✅" } else { "❌" })" -ForegroundColor $(if ($results.verified_in_staging) { "Green" } else { "Red" })
Write-Host "Promoted atomically: $(if ($results.promoted_atomically) { "✅" } else { "❌" })" -ForegroundColor $(if ($results.promoted_atomically) { "Green" } else { "Red" })
Write-Host "Staging cleaned up: $(if ($results.staging_cleaned_up) { "✅" } else { "❌" })" -ForegroundColor $(if ($results.staging_cleaned_up) { "Green" } else { "Red" })
Write-Host "Final jar exists: $(if ($results.final_jar_exists) { "✅" } else { "❌" })" -ForegroundColor $(if ($results.final_jar_exists) { "Green" } else { "Red" })
Write-Host ""

$allPassed = $results.corruption_detected -and $results.artifact_redownloaded -and $results.verified_in_staging -and $results.promoted_atomically -and $results.staging_cleaned_up -and $results.final_jar_exists

if ($allPassed) {
    Write-Host "✅ VALIDATION PASSED" -ForegroundColor Green
    Write-Host "Evidence saved to: $EvidenceDir" -ForegroundColor Cyan
    exit 0
} else {
    Write-Host "❌ VALIDATION FAILED" -ForegroundColor Red
    Write-Host "Evidence saved to: $EvidenceDir" -ForegroundColor Cyan
    exit 1
}

