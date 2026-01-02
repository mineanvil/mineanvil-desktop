# Check if ready for Scenario B (resume from staging)
# Usage: .\scripts\validation\check-scenario-b-ready.ps1

$appData = $env:APPDATA
$stagingPath = Join-Path $appData "MineAnvil\instances\default\.staging\pack-install"
$logPath = Join-Path $appData "MineAnvil\instances\default\logs\mineanvil-main.log"

Write-Host "=== Scenario B Readiness Check ===" -ForegroundColor Cyan
Write-Host ""

# Check staging
Write-Host "1. Staging Directory:" -ForegroundColor Yellow
if (Test-Path $stagingPath) {
    $files = Get-ChildItem -Path $stagingPath -Recurse -File -ErrorAction SilentlyContinue
    Write-Host "   EXISTS with $($files.Count) files" -ForegroundColor Green
    Write-Host "   Path: $stagingPath" -ForegroundColor Gray
} else {
    Write-Host "   DOES NOT EXIST" -ForegroundColor Red
    Write-Host "   Need to complete Scenario A first (interrupted install)" -ForegroundColor Yellow
}

Write-Host ""

# Check logs for recent activity
Write-Host "2. Recent Installation Logs:" -ForegroundColor Yellow
if (Test-Path $logPath) {
    $recent = Get-Content $logPath -Tail 100 -ErrorAction SilentlyContinue
    $installLogs = @()
    foreach ($line in $recent) {
        try {
            $entry = $line | ConvertFrom-Json
            if ($entry.area -eq "install.deterministic" -or $entry.area -eq "install.planner") {
                $installLogs += $entry
            }
        } catch {
            # Skip non-JSON
        }
    }
    
    if ($installLogs.Count -gt 0) {
        Write-Host "   Found $($installLogs.Count) installation log entries" -ForegroundColor Green
        $latest = $installLogs[-1]
        Write-Host "   Latest: [$($latest.ts)] $($latest.message)" -ForegroundColor Gray
        if ($latest.meta) {
            if ($latest.meta.needsInstall) {
                Write-Host "   needsInstall: $($latest.meta.needsInstall)" -ForegroundColor Cyan
            }
            if ($latest.meta.recoverableCount) {
                Write-Host "   recoverableCount: $($latest.meta.recoverableCount)" -ForegroundColor Cyan
            }
        }
    } else {
        Write-Host "   No installation logs found" -ForegroundColor Yellow
    }
} else {
    Write-Host "   Log file not found" -ForegroundColor Red
}

Write-Host ""

# Summary
if (Test-Path $stagingPath) {
    Write-Host "Ready for Scenario B" -ForegroundColor Green
    Write-Host "  Next: Relaunch MineAnvil and verify recovery from staging" -ForegroundColor White
} else {
    Write-Host "Not ready for Scenario B" -ForegroundColor Red
    Write-Host "  Need to complete Scenario A first" -ForegroundColor Yellow
}
