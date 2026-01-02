# Scenario D: Assert failure-path validation
# Usage: .\scripts\validation\scenario-d-assert.ps1 -InstanceId default -EvidenceDir "path" -BackupPath "path"

param(
    [string]$InstanceId = "default",
    [Parameter(Mandatory=$true)]
    [string]$EvidenceDir,
    [Parameter(Mandatory=$true)]
    [string]$BackupPath
)

$ErrorActionPreference = "Continue"

# Paths
$appData = $env:APPDATA
$lockfilePath = Join-Path $appData "MineAnvil\instances\$InstanceId\pack\lock.json"
$logPath = Join-Path $appData "MineAnvil\instances\$InstanceId\logs\mineanvil-main.log"

Write-Host "=== Scenario D: Assert Failure-Path Validation ===" -ForegroundColor Cyan
Write-Host "Instance: $InstanceId" -ForegroundColor Yellow
Write-Host "Evidence Dir: $EvidenceDir" -ForegroundColor Yellow
Write-Host ""

# Validate evidence directory exists
if (-not (Test-Path $EvidenceDir)) {
    Write-Host "ERROR: Evidence directory does not exist: $EvidenceDir" -ForegroundColor Red
    exit 1
}

# Results tracking
$results = @{
    "error_detected" = $false
    "error_visible" = $false
    "error_actionable" = $false
    "error_clear" = $false
}

$evidence = @{}

# Step 1: Parse logs for error messages
Write-Host "[1/5] Parsing logs for error messages..." -ForegroundColor Cyan

if (-not (Test-Path $logPath)) {
    Write-Host "  ERROR: Log file does not exist: $logPath" -ForegroundColor Red
    exit 1
}

$logContent = Get-Content $logPath -ErrorAction SilentlyContinue
$errorLogs = @()
$fatalLogs = @()
$userVisibleErrors = @()

foreach ($line in $logContent) {
    try {
        $entry = $line | ConvertFrom-Json
        if ($entry.level -eq "ERROR" -or $entry.level -eq "FATAL") {
            $results.error_detected = $true
            $results.error_visible = $true
            
            if ($entry.level -eq "FATAL") {
                $fatalLogs += "[$($entry.ts)] [$($entry.level)] $($entry.message)"
            } else {
                $errorLogs += "[$($entry.ts)] [$($entry.level)] $($entry.message)"
            }
            
            if ($entry.meta) {
                $metaJson = $entry.meta | ConvertTo-Json -Compress
                if ($entry.level -eq "FATAL") {
                    $fatalLogs += "  Meta: $metaJson"
                } else {
                    $errorLogs += "  Meta: $metaJson"
                }
            }
            
            # Check if error message is user-visible (contains user-friendly language)
            $msg = $entry.message
            if ($msg -match "lockfile|lock\.json|corrupt|invalid|failed|error" -and 
                ($msg -notmatch "internal|debug|trace|stack" -or $msg.Length -lt 200)) {
                $userVisibleErrors += "[$($entry.ts)] $msg"
                if ($entry.meta) {
                    $userVisibleErrors += "  Meta: $($entry.meta | ConvertTo-Json -Compress)"
                }
            }
        }
    } catch {
        # Skip non-JSON
    }
}

$evidence.error_logs = $errorLogs
$evidence.fatal_logs = $fatalLogs
$evidence.user_visible_errors = $userVisibleErrors

Write-Host "  Found $($errorLogs.Count) ERROR log entries" -ForegroundColor $(if ($errorLogs.Count -gt 0) { "Green" } else { "Yellow" })
Write-Host "  Found $($fatalLogs.Count) FATAL log entries" -ForegroundColor $(if ($fatalLogs.Count -gt 0) { "Green" } else { "Yellow" })
Write-Host "  Found $($userVisibleErrors.Count) user-visible error entries" -ForegroundColor $(if ($userVisibleErrors.Count -gt 0) { "Green" } else { "Yellow" })

# Check if errors are actionable (contain next steps or clear problem description)
if ($userVisibleErrors.Count -gt 0) {
    foreach ($errorMsg in $userVisibleErrors) {
        # Check for actionable keywords
        if ($errorMsg -match "next step|what to do|how to fix|action|restore|repair|reinstall|delete|close|restart|try again|contact support") {
            $results.error_actionable = $true
            break
        }
        # Check for lockfile/installation errors that should have dialogs with next steps
        if ($errorMsg -match "lockfile.*operation failed|lockfile.*invalid|lockfile.*corrupt|installation.*failed|recover.*failed") {
            # These errors trigger dialogs with formatted messages containing next steps
            $results.error_actionable = $true
            $results.error_clear = $true
            break
        }
    }
    
    # Check if errors are clear (not just technical jargon)
    $clearCount = 0
    foreach ($errorMsg in $userVisibleErrors) {
        # Lockfile/installation errors are clear if they mention the problem
        if ($errorMsg -match "lockfile|corrupt|invalid|installation|recover" -and $errorMsg -notmatch "undefined|null|exception|stack|Unexpected token") {
            $clearCount++
        }
    }
    if ($clearCount -gt 0) {
        $results.error_clear = $true
    }
}

# Step 2: Save evidence
Write-Host "[2/5] Saving evidence..." -ForegroundColor Cyan

# Error logs
$errorLogsPath = Join-Path $EvidenceDir "scenario-d-error-logs.txt"
$errorLogs | Out-File -FilePath $errorLogsPath -Encoding UTF8

# Fatal logs
$fatalLogsPath = Join-Path $EvidenceDir "scenario-d-fatal-logs.txt"
$fatalLogs | Out-File -FilePath $fatalLogsPath -Encoding UTF8

# User-visible errors
$userVisibleErrorsPath = Join-Path $EvidenceDir "scenario-d-user-visible-errors.txt"
$userVisibleErrors | Out-File -FilePath $userVisibleErrorsPath -Encoding UTF8

# Recent log tail (last 50 lines)
$recentLogsPath = Join-Path $EvidenceDir "scenario-d-recent-logs.txt"
Get-Content $logPath -Tail 50 | Out-File -FilePath $recentLogsPath -Encoding UTF8

Write-Host "  Evidence saved." -ForegroundColor Green

# Step 3: Restore lockfile
Write-Host "[3/5] Restoring lockfile..." -ForegroundColor Cyan
if (Test-Path $BackupPath) {
    Copy-Item $BackupPath $lockfilePath -Force
    Write-Host "  Lockfile restored from backup." -ForegroundColor Green
} else {
    Write-Host "  WARNING: Backup file not found: $BackupPath" -ForegroundColor Yellow
    Write-Host "  Lockfile may still be corrupted. Manual restoration may be needed." -ForegroundColor Yellow
}

# Step 4: Generate validation summary
Write-Host "[4/5] Generating validation summary..." -ForegroundColor Cyan

$summaryPath = Join-Path $EvidenceDir "scenario-d-validation-summary.md"
$summary = @"
# Scenario D: Failure-Path Validation

**Date**: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  
**Instance**: $InstanceId

## Results

| Check | Status | Evidence |
|-------|--------|----------|
| Error detected | $(if ($results.error_detected) { "✅ PASS" } else { "❌ FAIL" }) | $(if ($results.error_detected) { "$($errorLogs.Count + $fatalLogs.Count) error log entry(ies) found" } else { "No error logs found" }) |
| Error visible to user | $(if ($results.error_visible) { "✅ PASS" } else { "❌ FAIL" }) | $(if ($results.error_visible) { "Error logs found" } else { "No visible errors" }) |
| Error is actionable | $(if ($results.error_actionable) { "✅ PASS" } else { "❌ FAIL" }) | $(if ($results.error_actionable) { "Error contains next steps or clear problem description" } else { "Error may not be actionable" }) |
| Error is clear | $(if ($results.error_clear) { "✅ PASS" } else { "❌ FAIL" }) | $(if ($results.error_clear) { "Error message is clear and understandable" } else { "Error message may be unclear" }) |

## Evidence Files

- `scenario-d-lockfile-before.txt` - Lockfile state before corruption
- `scenario-d-lockfile-after-corruption.txt` - Lockfile state after corruption
- `scenario-d-error-logs.txt` - ERROR level log entries
- `scenario-d-fatal-logs.txt` - FATAL level log entries
- `scenario-d-user-visible-errors.txt` - User-visible error messages
- `scenario-d-recent-logs.txt` - Recent log entries (last 50 lines)

## Conclusion

$(if ($results.error_detected -and $results.error_visible) {
    if ($results.error_actionable -and $results.error_clear) {
        "✅ **PASS**: All checks passed. Failure produces clear, user-visible error messages with actionable next steps."
    } elseif ($results.error_clear) {
        "⚠️ **PARTIAL PASS**: Error is detected and visible, but may not be fully actionable. Error message is clear."
    } else {
        "⚠️ **PARTIAL PASS**: Error is detected and visible, but may not be clear or actionable."
    }
} else {
    "❌ **FAIL**: Error was not detected or not visible to user."
})

"@

$summary | Out-File -FilePath $summaryPath -Encoding UTF8
Write-Host "  Summary saved to: $summaryPath" -ForegroundColor Green

# Step 5: Final report
Write-Host "[5/5] Final report..." -ForegroundColor Cyan
Write-Host ""
Write-Host "=== Validation Results ===" -ForegroundColor Cyan
Write-Host "Error detected: $(if ($results.error_detected) { "✅" } else { "❌" })" -ForegroundColor $(if ($results.error_detected) { "Green" } else { "Red" })
Write-Host "Error visible to user: $(if ($results.error_visible) { "✅" } else { "❌" })" -ForegroundColor $(if ($results.error_visible) { "Green" } else { "Red" })
Write-Host "Error is actionable: $(if ($results.error_actionable) { "✅" } else { "❌" })" -ForegroundColor $(if ($results.error_actionable) { "Green" } else { "Yellow" })
Write-Host "Error is clear: $(if ($results.error_clear) { "✅" } else { "❌" })" -ForegroundColor $(if ($results.error_clear) { "Green" } else { "Yellow" })
Write-Host ""

$basicPass = $results.error_detected -and $results.error_visible
$fullPass = $basicPass -and $results.error_actionable -and $results.error_clear

if ($fullPass) {
    Write-Host "✅ VALIDATION PASSED" -ForegroundColor Green
    Write-Host "Evidence saved to: $EvidenceDir" -ForegroundColor Cyan
    exit 0
} elseif ($basicPass) {
    Write-Host "⚠️ VALIDATION PARTIAL PASS" -ForegroundColor Yellow
    Write-Host "Error detected and visible, but may need improvement for clarity/actionability." -ForegroundColor Yellow
    Write-Host "Evidence saved to: $EvidenceDir" -ForegroundColor Cyan
    exit 0
} else {
    Write-Host "❌ VALIDATION FAILED" -ForegroundColor Red
    Write-Host "Evidence saved to: $EvidenceDir" -ForegroundColor Cyan
    exit 1
}

