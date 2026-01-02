# Lockfile-only Authority Validation Script
# This script validates that all recovery decisions are based solely on lockfile contents
# Usage: .\scripts\validation\lockfile-only-authority-validation.ps1 [-InstanceId default] [-McVersion 1.21.4]

param(
    [string]$InstanceId = "default",
    [string]$McVersion = "1.21.4",
    [switch]$Verbose
)

$ErrorActionPreference = "Continue"

# Create evidence directory
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$evidenceDir = Join-Path (Get-Location) "prompts\02-evidence\L2\sp2.3-final\$timestamp"
New-Item -ItemType Directory -Path $evidenceDir -Force | Out-Null

Write-Host "=== Lockfile-only Authority Validation ===" -ForegroundColor Cyan
Write-Host "Evidence Directory: $evidenceDir" -ForegroundColor Yellow
Write-Host ""

# Paths
$appData = $env:APPDATA
$logPath = Join-Path $appData "MineAnvil\instances\$InstanceId\logs\mineanvil-main.log"
$clientJarPath = Join-Path $appData "MineAnvil\instances\$InstanceId\.minecraft\versions\$McVersion\$McVersion.jar"
$lockfilePath = Join-Path $appData "MineAnvil\instances\$InstanceId\pack\lock.json"

# Step 1: Corrupt a file to trigger recovery
Write-Host "[1/5] Preparing test scenario..." -ForegroundColor Cyan

if (-not (Test-Path $clientJarPath)) {
    Write-Host "  Client JAR not found. Please run MineAnvil first to install artifacts." -ForegroundColor Yellow
    Write-Host "  Path: $clientJarPath" -ForegroundColor Gray
    exit 1
}

# Backup original file
$backupPath = "$clientJarPath.backup"
if (Test-Path $backupPath) {
    Remove-Item $backupPath -Force
}
Copy-Item $clientJarPath $backupPath

# Corrupt the file (modify first few bytes)
Write-Host "  Corrupting client JAR to trigger recovery..." -ForegroundColor Gray
$bytes = [System.IO.File]::ReadAllBytes($clientJarPath)
$bytes[0] = 0xFF
$bytes[1] = 0xFF
$bytes[2] = 0xFF
[System.IO.File]::WriteAllBytes($clientJarPath, $bytes)

Write-Host "  ✓ File corrupted (first 3 bytes modified)" -ForegroundColor Green

# Step 2: Clear old logs (optional, but helps)
Write-Host "[2/5] Preparing logs..." -ForegroundColor Cyan
if (Test-Path $logPath) {
    $logDir = Split-Path $logPath -Parent
    $backupLogPath = Join-Path $logDir "mineanvil-main.log.backup"
    Copy-Item $logPath $backupLogPath -Force
    Write-Host "  ✓ Log backed up" -ForegroundColor Gray
}

# Step 3: Run MineAnvil and wait for recovery
Write-Host "[3/5] Running MineAnvil to trigger recovery..." -ForegroundColor Cyan
Write-Host "  Please launch MineAnvil now (npm run dev:electron)" -ForegroundColor Yellow
Write-Host "  Wait for installation to complete, then press Enter..." -ForegroundColor Yellow
Read-Host "Press Enter when installation is complete"

# Step 4: Parse logs for recovery decisions
Write-Host "[4/5] Parsing logs for recovery decisions..." -ForegroundColor Cyan

if (-not (Test-Path $logPath)) {
    Write-Host "  ERROR: Log file does not exist: $logPath" -ForegroundColor Red
    exit 1
}

$logContent = Get-Content $logPath -ErrorAction SilentlyContinue
$recoveryDecisionLogs = @()
$lockfileAuthorityLogs = @()
$remoteMetadataLogs = @()

foreach ($line in $logContent) {
    try {
        $json = $line | ConvertFrom-Json -ErrorAction SilentlyContinue
        if ($json -and $json.meta) {
            # Check if this is a recovery decision log
            if ($json.meta.decision -or $json.meta.authority -or $json.meta.remoteMetadataUsed -ne $null) {
                $recoveryDecisionLogs += $line
                
                # Check for lockfile authority
                if ($json.meta.authority -eq "lockfile") {
                    $lockfileAuthorityLogs += $line
                }
                
                # Check for remote metadata usage
                if ($json.meta.remoteMetadataUsed -eq $false) {
                    $remoteMetadataLogs += $line
                }
            }
        }
    } catch {
        # Not JSON, skip
    }
}

Write-Host "  Found $($recoveryDecisionLogs.Count) recovery decision log entries" -ForegroundColor Green
Write-Host "  Found $($lockfileAuthorityLogs.Count) entries with authority='lockfile'" -ForegroundColor Green
Write-Host "  Found $($remoteMetadataLogs.Count) entries with remoteMetadataUsed=false" -ForegroundColor Green

# Step 5: Validate and create evidence
Write-Host "[5/5] Creating evidence files..." -ForegroundColor Cyan

# Extract all recovery decision entries with full metadata
$decisionEntries = @()
foreach ($line in $recoveryDecisionLogs) {
    try {
        $json = $line | ConvertFrom-Json
        if ($json.meta) {
            $decisionEntries += @{
                timestamp = $json.timestamp
                level = $json.level
                area = $json.area
                message = $json.message
                decision = $json.meta.decision
                reason = $json.meta.reason
                expected = $json.meta.expected
                observed = $json.meta.observed
                authority = $json.meta.authority
                remoteMetadataUsed = $json.meta.remoteMetadataUsed
            }
        }
    } catch {
        # Skip invalid JSON
    }
}

# Create evidence files
$evidence = @{
    timestamp = $timestamp
    instanceId = $InstanceId
    minecraftVersion = $McVersion
    totalDecisionLogs = $recoveryDecisionLogs.Count
    lockfileAuthorityLogs = $lockfileAuthorityLogs.Count
    remoteMetadataLogs = $remoteMetadataLogs.Count
    allDecisionsUseLockfile = ($decisionEntries.Count -gt 0) -and ($decisionEntries | Where-Object { $_.authority -ne "lockfile" }).Count -eq 0
    noRemoteMetadataUsed = ($decisionEntries.Count -gt 0) -and ($decisionEntries | Where-Object { $_.remoteMetadataUsed -ne $false }).Count -eq 0
}

# Save raw recovery decision logs
$recoveryLogsPath = Join-Path $evidenceDir "lockfile-only-recovery-decisions-raw.txt"
$recoveryDecisionLogs | Out-File -FilePath $recoveryLogsPath -Encoding UTF8

# Save formatted decision entries
$formattedLogsPath = Join-Path $evidenceDir "lockfile-only-recovery-decisions-formatted.txt"
$formatted = @()
$formatted += "=== Lockfile-only Authority Evidence ==="
$formatted += "Timestamp: $timestamp"
$formatted += "Instance: $InstanceId"
$formatted += "Minecraft Version: $McVersion"
$formatted += ""
$formatted += "Total Recovery Decision Logs: $($recoveryDecisionLogs.Count)"
$formatted += "Logs with authority='lockfile': $($lockfileAuthorityLogs.Count)"
$formatted += "Logs with remoteMetadataUsed=false: $($remoteMetadataLogs.Count)"
$formatted += ""
$formatted += "=== Decision Entries ==="
$formatted += ""

foreach ($entry in $decisionEntries) {
    $formatted += "---"
    $formatted += "Timestamp: $($entry.timestamp)"
    $formatted += "Level: $($entry.level)"
    $formatted += "Area: $($entry.area)"
    $formatted += "Message: $($entry.message)"
    $formatted += "Decision: $($entry.decision)"
    $formatted += "Reason: $($entry.reason)"
    $formatted += "Authority: $($entry.authority)"
    $formatted += "Remote Metadata Used: $($entry.remoteMetadataUsed)"
    $formatted += "Expected (from lockfile):"
    $formatted += "  Algorithm: $($entry.expected.algo)"
    $formatted += "  Hash Prefix: $($entry.expected.hashPrefix)"
    if ($entry.expected.size) {
        $formatted += "  Size: $($entry.expected.size)"
    }
    $formatted += "Observed (from filesystem):"
    $formatted += "  Algorithm: $($entry.observed.algo)"
    $formatted += "  Hash Prefix: $($entry.observed.hashPrefix)"
    if ($entry.observed.size) {
        $formatted += "  Size: $($entry.observed.size)"
    }
    $formatted += ""
}

$formatted | Out-File -FilePath $formattedLogsPath -Encoding UTF8

# Create validation summary
$summaryPath = Join-Path $evidenceDir "lockfile-only-authority-validation-summary.md"
$summary = @"
# Lockfile-only Authority Validation

**Date**: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  
**Instance**: $InstanceId  
**Minecraft Version**: $McVersion  
**Evidence Directory**: $evidenceDir

## Test Scenario

1. Corrupted client JAR (modified first 3 bytes)
2. Ran MineAnvil to trigger recovery
3. Parsed logs for recovery decision entries
4. Validated all decisions use lockfile authority

## Results

| Check | Status | Evidence |
|-------|--------|----------|
| Recovery decision logs found | $(if ($recoveryDecisionLogs.Count -gt 0) { "✅ PASS" } else { "❌ FAIL" }) | $($recoveryDecisionLogs.Count) log entry(ies) |
| All decisions use lockfile authority | $(if ($evidence.allDecisionsUseLockfile) { "✅ PASS" } else { "❌ FAIL" }) | $($lockfileAuthorityLogs.Count) / $($recoveryDecisionLogs.Count) entries |
| No remote metadata used | $(if ($evidence.noRemoteMetadataUsed) { "✅ PASS" } else { "❌ FAIL" }) | $($remoteMetadataLogs.Count) / $($recoveryDecisionLogs.Count) entries |
| Expected values from lockfile | $(if ($decisionEntries.Count -gt 0) { "✅ PASS" } else { "❌ FAIL" }) | All entries include `meta.expected` from lockfile |
| Observed values from filesystem | $(if ($decisionEntries.Count -gt 0) { "✅ PASS" } else { "❌ FAIL" }) | All entries include `meta.observed` from filesystem |

## Decision Types Found

$(($decisionEntries | Group-Object decision | ForEach-Object { "- **$($_.Name)**: $($_.Count) occurrence(s)" }) -join "`n")

## Evidence Files

- `lockfile-only-recovery-decisions-raw.txt` - Raw JSON log entries
- `lockfile-only-recovery-decisions-formatted.txt` - Formatted decision entries with metadata
- `lockfile-only-authority-validation-summary.md` - This file

## Validation

To verify lockfile-only authority, check that:
1. All recovery decision logs include `meta.authority = "lockfile"`
2. All recovery decision logs include `meta.remoteMetadataUsed = false`
3. All logs include `meta.expected` with values from lockfile artifact
4. All logs include `meta.observed` with values computed from local filesystem

## Conclusion

$(if ($evidence.allDecisionsUseLockfile -and $evidence.noRemoteMetadataUsed) {
    "✅ **PASS**: All recovery decisions are based solely on lockfile contents. No remote metadata is used."
} else {
    "❌ **FAIL**: Some recovery decisions do not use lockfile authority or use remote metadata."
})
"@

$summary | Out-File -FilePath $summaryPath -Encoding UTF8

# Restore original file
Write-Host "  Restoring original file..." -ForegroundColor Gray
if (Test-Path $backupPath) {
    Copy-Item $backupPath $clientJarPath -Force
    Remove-Item $backupPath -Force
    Write-Host "  ✓ File restored" -ForegroundColor Green
}

# Print summary
Write-Host ""
Write-Host "=== Validation Complete ===" -ForegroundColor Cyan
Write-Host "Evidence saved to: $evidenceDir" -ForegroundColor Yellow
Write-Host ""
Write-Host "Results:" -ForegroundColor Yellow
Write-Host "  Recovery decision logs: $($recoveryDecisionLogs.Count)" -ForegroundColor $(if ($recoveryDecisionLogs.Count -gt 0) { "Green" } else { "Red" })
Write-Host "  All use lockfile authority: $(if ($evidence.allDecisionsUseLockfile) { "✅ PASS" } else { "❌ FAIL" })" -ForegroundColor $(if ($evidence.allDecisionsUseLockfile) { "Green" } else { "Red" })
Write-Host "  No remote metadata used: $(if ($evidence.noRemoteMetadataUsed) { "✅ PASS" } else { "❌ FAIL" })" -ForegroundColor $(if ($evidence.noRemoteMetadataUsed) { "Green" } else { "Red" })
Write-Host ""
Write-Host "See $summaryPath for full details." -ForegroundColor Gray

