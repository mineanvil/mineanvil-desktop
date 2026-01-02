# Monitor logs for installation activity and kill the app at specified point
# Usage: .\scripts\validation\monitor-and-kill-download.ps1 [-KillOn <promote|verified|download>] [-WaitSeconds <seconds>] [-Verbose]

param(
    [ValidateSet("promote", "verified", "download")]
    [string]$KillOn = "download",
    [int]$WaitSeconds = 60,
    [switch]$Verbose
)

$ErrorActionPreference = "Continue"

$appData = $env:APPDATA
$logPath = Join-Path $appData "MineAnvil\instances\default\logs\mineanvil-main.log"

Write-Host "=== Monitor and Kill Script ===" -ForegroundColor Cyan
Write-Host "Kill trigger: $KillOn" -ForegroundColor Yellow
Write-Host "Max wait: $WaitSeconds seconds" -ForegroundColor Yellow
if ($Verbose) {
    Write-Host "Verbose mode: ON" -ForegroundColor Gray
}
Write-Host ""

$startTime = Get-Date
$found = $false
$lastLogSize = 0

# Define trigger patterns based on KillOn parameter
# Patterns use regex matching, so escape special characters if needed
$triggerPatterns = @{
    "download" = @("downloading artifact to staging")
    "verified" = @("staging recovery complete", "recoverable artifact found in staging")
    "promote" = @("promoting artifacts from staging to final location")
}

$patterns = $triggerPatterns[$KillOn]

while (((Get-Date) - $startTime).TotalSeconds -lt $WaitSeconds) {
    if (Test-Path $logPath) {
        $currentLogSize = (Get-Item $logPath).Length
        if ($currentLogSize -gt $lastLogSize) {
            # Log file grew, read new lines
            $recent = Get-Content $logPath -Tail 50 -ErrorAction SilentlyContinue
            foreach ($line in $recent) {
                try {
                    $entry = $line | ConvertFrom-Json
                    if ($entry.area -eq "install.deterministic" -or $entry.area -eq "install.planner") {
                        $msg = $entry.message
                        
                        # Check for trigger patterns
                        foreach ($pattern in $patterns) {
                            if ($msg -match $pattern) {
                                # Special handling for "staging recovery complete" - only trigger if recoverableCount > 0
                                if ($msg -eq "staging recovery complete") {
                                    if ($entry.meta -and $entry.meta.recoverableCount -gt 0) {
                                        Write-Host "TRIGGER DETECTED: $msg" -ForegroundColor Green
                                        if ($Verbose) {
                                            Write-Host "  Recoverable count: $($entry.meta.recoverableCount)" -ForegroundColor Gray
                                            Write-Host "  Area: $($entry.area)" -ForegroundColor Gray
                                        }
                                        $found = $true
                                        break
                                    } elseif ($Verbose) {
                                        Write-Host "  [SKIP] staging recovery complete but recoverableCount = $($entry.meta.recoverableCount)" -ForegroundColor DarkGray
                                    }
                                } else {
                                    # For other patterns, trigger immediately
                                    Write-Host "TRIGGER DETECTED: $msg" -ForegroundColor Green
                                    if ($Verbose) {
                                        Write-Host "  Area: $($entry.area)" -ForegroundColor Gray
                                        if ($entry.meta) {
                                            Write-Host "  Meta: $($entry.meta | ConvertTo-Json -Compress)" -ForegroundColor Gray
                                        }
                                    }
                                    $found = $true
                                    break
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
    
    if ($found) {
        break
    }
    
    Start-Sleep -Milliseconds 500
    if (-not $Verbose) {
        Write-Host "." -NoNewline
    } else {
        $elapsed = [math]::Round(((Get-Date) - $startTime).TotalSeconds, 1)
        Write-Host "  [${elapsed}s] Monitoring..." -ForegroundColor Gray
    }
}

Write-Host ""

if ($found) {
    Write-Host "Killing Electron processes..." -ForegroundColor Yellow
    $procs = Get-Process electron -ErrorAction SilentlyContinue
    if ($procs) {
        $procs | Stop-Process -Force
        Start-Sleep -Seconds 1
        Write-Host "Processes killed. Check staging directory now." -ForegroundColor Green
        if ($Verbose) {
            Write-Host "  Killed $($procs.Count) process(es)" -ForegroundColor Gray
        }
    } else {
        Write-Host "No Electron processes found to kill." -ForegroundColor Yellow
    }
} else {
    Write-Host "No trigger detected within $WaitSeconds seconds." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Checking if app is still running..." -ForegroundColor Cyan
    $procs = Get-Process electron -ErrorAction SilentlyContinue
    if ($procs) {
        Write-Host "App is still running. Kill manually if needed:" -ForegroundColor Yellow
        Write-Host "  Get-Process electron | Stop-Process -Force" -ForegroundColor White
    } else {
        Write-Host "App is not running." -ForegroundColor Gray
    }
    
    if ($Verbose) {
        Write-Host ""
        Write-Host "Recent log entries (last 10):" -ForegroundColor Cyan
        if (Test-Path $logPath) {
            Get-Content $logPath -Tail 10 | ForEach-Object {
                try {
                    $e = $_ | ConvertFrom-Json
                    if ($e.area -match "install") {
                        Write-Host "  [$($e.ts)] $($e.message)" -ForegroundColor Gray
                    }
                } catch {}
            }
        }
    }
}

