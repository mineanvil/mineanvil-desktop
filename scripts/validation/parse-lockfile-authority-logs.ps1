# Parse existing logs for lockfile-only authority evidence
# Usage: .\scripts\validation\parse-lockfile-authority-logs.ps1 [-InstanceId default] [-EvidenceDir "path"]

param(
    [string]$InstanceId = "default",
    [string]$EvidenceDir = "",
    [switch]$Verbose
)

$ErrorActionPreference = "Continue"

# Create evidence directory if not provided
if ([string]::IsNullOrEmpty($EvidenceDir)) {
    $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $EvidenceDir = Join-Path (Get-Location) "prompts\02-evidence\L2\sp2.3-final\$timestamp"
}
New-Item -ItemType Directory -Path $EvidenceDir -Force | Out-Null

Write-Host "=== Parsing Lockfile-only Authority Evidence ===" -ForegroundColor Cyan
Write-Host "Evidence Directory: $EvidenceDir" -ForegroundColor Yellow
Write-Host ""

# Paths
$appData = $env:APPDATA
$logPath = Join-Path $appData "MineAnvil\instances\$InstanceId\logs\mineanvil-main.log"

if (-not (Test-Path $logPath)) {
    Write-Host "ERROR: Log file does not exist: $logPath" -ForegroundColor Red
    Write-Host ""
    Write-Host "To generate evidence:" -ForegroundColor Yellow
    Write-Host "1. Corrupt a file (e.g., client JAR)" -ForegroundColor White
    Write-Host "2. Run MineAnvil (npm run dev:electron)" -ForegroundColor White
    Write-Host "3. Wait for recovery to complete" -ForegroundColor White
    Write-Host "4. Re-run this script" -ForegroundColor White
    exit 1
}

Write-Host "Parsing logs from: $logPath" -ForegroundColor Cyan
$logContent = Get-Content $logPath -ErrorAction SilentlyContinue

$recoveryDecisionLogs = @()
$lockfileAuthorityLogs = @()
$remoteMetadataLogs = @()
$decisionEntries = @()

foreach ($line in $logContent) {
    try {
        $json = $line | ConvertFrom-Json -ErrorAction SilentlyContinue
        if ($json -and $json.meta) {
            # Check for nested meta.meta structure (new structured logging)
            $decisionMeta = $null
            if ($json.meta.meta) {
                $decisionMeta = $json.meta.meta
            } elseif ($json.meta.decision -or $json.meta.authority -or $json.meta.remoteMetadataUsed -ne $null) {
                # Fallback: check if meta itself has decision fields
                $decisionMeta = $json.meta
            }
            
            if ($decisionMeta) {
                # Check if this is a recovery decision log
                if ($decisionMeta.decision -or $decisionMeta.authority -or $decisionMeta.remoteMetadataUsed -ne $null) {
                    $recoveryDecisionLogs += $line
                    
                    # Check for lockfile authority
                    if ($decisionMeta.authority -eq "lockfile") {
                        $lockfileAuthorityLogs += $line
                    }
                    
                    # Check for remote metadata usage
                    if ($decisionMeta.remoteMetadataUsed -eq $false) {
                        $remoteMetadataLogs += $line
                    }
                    
                    # Extract structured entry
                    $decisionEntries += @{
                        timestamp = $json.timestamp
                        level = $json.level
                        area = $json.area
                        message = $json.message
                        decision = $decisionMeta.decision
                        reason = $decisionMeta.reason
                        expected = $decisionMeta.expected
                        observed = $decisionMeta.observed
                        authority = $decisionMeta.authority
                        remoteMetadataUsed = $decisionMeta.remoteMetadataUsed
                    }
                }
            }
        }
    } catch {
        # Not JSON, skip
    }
}

Write-Host "Found $($recoveryDecisionLogs.Count) recovery decision log entries" -ForegroundColor Green
Write-Host "Found $($lockfileAuthorityLogs.Count) entries with authority='lockfile'" -ForegroundColor Green
Write-Host "Found $($remoteMetadataLogs.Count) entries with remoteMetadataUsed=false" -ForegroundColor Green
Write-Host ""

# Validate
$allUseLockfile = ($decisionEntries.Count -gt 0) -and ($decisionEntries | Where-Object { $_.authority -ne "lockfile" }).Count -eq 0
$noRemoteMetadata = ($decisionEntries.Count -gt 0) -and ($decisionEntries | Where-Object { $_.remoteMetadataUsed -ne $false }).Count -eq 0

# Save evidence
$recoveryLogsPath = Join-Path $EvidenceDir "lockfile-only-recovery-decisions-raw.txt"
$recoveryDecisionLogs | Out-File -FilePath $recoveryLogsPath -Encoding UTF8

$formattedLogsPath = Join-Path $EvidenceDir "lockfile-only-recovery-decisions-formatted.txt"
$formatted = @()
$formatted += "=== Lockfile-only Authority Evidence ==="
$formatted += "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$formatted += "Instance: $InstanceId"
$formatted += "Log File: $logPath"
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
    if ($entry.expected) {
        $formatted += "Expected (from lockfile):"
        $formatted += "  Algorithm: $($entry.expected.algo)"
        $formatted += "  Hash Prefix: $($entry.expected.hashPrefix)"
        if ($entry.expected.size) {
            $formatted += "  Size: $($entry.expected.size)"
        }
    }
    if ($entry.observed) {
        $formatted += "Observed (from filesystem):"
        $formatted += "  Algorithm: $($entry.observed.algo)"
        $formatted += "  Hash Prefix: $($entry.observed.hashPrefix)"
        if ($entry.observed.size) {
            $formatted += "  Size: $($entry.observed.size)"
        }
    }
    $formatted += ""
}

$formatted | Out-File -FilePath $formattedLogsPath -Encoding UTF8

# Create summary
$summaryPath = Join-Path $EvidenceDir "lockfile-only-authority-validation-summary.md"
$decisionTypes = $decisionEntries | Group-Object decision | ForEach-Object { "- **$($_.Name)**: $($_.Count) occurrence(s)" }

$summary = @"
# Lockfile-only Authority Validation

**Date**: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  
**Instance**: $InstanceId  
**Log File**: $logPath  
**Evidence Directory**: $EvidenceDir

## Results

| Check | Status | Evidence |
|-------|--------|----------|
| Recovery decision logs found | $(if ($recoveryDecisionLogs.Count -gt 0) { "✅ PASS" } else { "❌ FAIL" }) | $($recoveryDecisionLogs.Count) log entry(ies) |
| All decisions use lockfile authority | $(if ($allUseLockfile) { "✅ PASS" } else { "❌ FAIL" }) | $($lockfileAuthorityLogs.Count) / $($recoveryDecisionLogs.Count) entries |
| No remote metadata used | $(if ($noRemoteMetadata) { "✅ PASS" } else { "❌ FAIL" }) | $($remoteMetadataLogs.Count) / $($recoveryDecisionLogs.Count) entries |
| Expected values from lockfile | $(if ($decisionEntries.Count -gt 0 -and ($decisionEntries | Where-Object { $_.expected }).Count -eq $decisionEntries.Count) { "✅ PASS" } else { "❌ FAIL" }) | All entries include `meta.expected` from lockfile |
| Observed values from filesystem | $(if ($decisionEntries.Count -gt 0 -and ($decisionEntries | Where-Object { $_.observed }).Count -eq $decisionEntries.Count) { "✅ PASS" } else { "❌ FAIL" }) | All entries include `meta.observed` from filesystem |

## Decision Types Found

$(if ($decisionTypes) { $decisionTypes -join "`n" } else { "None found" })

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

$(if ($allUseLockfile -and $noRemoteMetadata -and $recoveryDecisionLogs.Count -gt 0) {
    "✅ **PASS**: All recovery decisions are based solely on lockfile contents. No remote metadata is used."
} elseif ($recoveryDecisionLogs.Count -eq 0) {
    "⚠️ **NO EVIDENCE**: No recovery decision logs found. Run MineAnvil with a recovery scenario (corrupt a file) to generate evidence."
} else {
    "❌ **FAIL**: Some recovery decisions do not use lockfile authority or use remote metadata."
})
"@

$summary | Out-File -FilePath $summaryPath -Encoding UTF8

Write-Host "=== Results ===" -ForegroundColor Cyan
Write-Host "Recovery decision logs: $($recoveryDecisionLogs.Count)" -ForegroundColor $(if ($recoveryDecisionLogs.Count -gt 0) { "Green" } else { "Yellow" })
Write-Host "All use lockfile authority: $(if ($allUseLockfile) { "✅ PASS" } else { "❌ FAIL" })" -ForegroundColor $(if ($allUseLockfile) { "Green" } else { "Red" })
Write-Host "No remote metadata used: $(if ($noRemoteMetadata) { "✅ PASS" } else { "❌ FAIL" })" -ForegroundColor $(if ($noRemoteMetadata) { "Green" } else { "Red" })
Write-Host ""
Write-Host "Evidence saved to: $EvidenceDir" -ForegroundColor Yellow
Write-Host "Summary: $summaryPath" -ForegroundColor Gray

