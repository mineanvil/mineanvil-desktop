# Phase B: Simple approach - start app, wait, then kill when staging detected
# Usage: Run this script, then manually watch for staging or let it auto-detect

$ErrorActionPreference = "Continue"

Write-Host "=== Phase B: Interrupt During Staging Download ===" -ForegroundColor Cyan
Write-Host ""

$appData = $env:APPDATA
$logPath = Join-Path $appData "MineAnvil\instances\default\logs\mineanvil-main.log"
$stagingPath = Join-Path $appData "MineAnvil\instances\default\.staging\pack-install"
$clientJar = Join-Path $appData "MineAnvil\instances\default\.minecraft\versions\1.21.4\1.21.4.jar"

# Verify client JAR is deleted
if (Test-Path $clientJar) {
    Write-Host "ERROR: Client JAR still exists! Run Phase A first." -ForegroundColor Red
    exit 1
}

Write-Host "Client JAR confirmed deleted." -ForegroundColor Green
Write-Host ""
Write-Host "Starting MineAnvil..." -ForegroundColor Yellow
Write-Host "This script will monitor and kill when staging download is detected." -ForegroundColor Gray
Write-Host ""

# Start app
$workingDir = Get-Location
$proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c","npm run dev:electron" -PassThru -WindowStyle Minimized -WorkingDirectory $workingDir

if (-not $proc) {
    Write-Host "Failed to start app" -ForegroundColor Red
    exit 1
}

Write-Host "App started (PID: $($proc.Id))" -ForegroundColor Gray
Write-Host "Waiting for app to initialize (10 seconds)..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

Write-Host "Now monitoring for staging download..." -ForegroundColor Yellow
Write-Host ""

$startTime = Get-Date
$found = $false

while (((Get-Date) - $startTime).TotalSeconds -lt 120) {
    # Check staging directory first (fastest check)
    if (Test-Path $stagingPath) {
        $files = Get-ChildItem -Path $stagingPath -Recurse -File -ErrorAction SilentlyContinue
        if ($files.Count -gt 0) {
            Write-Host "  STAGING DETECTED! $($files.Count) files found" -ForegroundColor Green
            Write-Host "  Killing app..." -ForegroundColor Yellow
            Get-Process electron -ErrorAction SilentlyContinue | Stop-Process -Force
            Start-Sleep -Seconds 2
            $found = $true
            break
        }
    }
    
    # Check logs
    if (Test-Path $logPath) {
        $recent = Get-Content $logPath -Tail 50 -ErrorAction SilentlyContinue
        foreach ($line in $recent) {
            try {
                $entry = $line | ConvertFrom-Json
                if ($entry.area -eq "install.deterministic") {
                    $msg = $entry.message
                    # Match the exact log message from the code
                    if ($msg -eq "downloading artifact to staging" -or $msg -match "downloading.*staging") {
                        Write-Host "  STAGING DOWNLOAD LOG DETECTED!" -ForegroundColor Green
                        Write-Host "  Message: $msg" -ForegroundColor Gray
                        Write-Host "  Killing app..." -ForegroundColor Yellow
                        Get-Process electron -ErrorAction SilentlyContinue | Stop-Process -Force
                        Start-Sleep -Seconds 2
                        $found = $true
                        break
                    }
                }
            } catch {
                # Skip non-JSON
            }
        }
    }
    
    if ($found) {
        break
    }
    
    Start-Sleep -Seconds 1
    Write-Host "." -NoNewline
}

Write-Host ""
Write-Host ""

if ($found) {
    Write-Host "SUCCESS: App killed during staging download!" -ForegroundColor Green
    Write-Host "Ready for Phase C (verify staging)." -ForegroundColor Green
} else {
    Write-Host "No staging detected. Checking state..." -ForegroundColor Yellow
    
    # Final check
    if (Test-Path $stagingPath) {
        $files = Get-ChildItem -Path $stagingPath -Recurse -File -ErrorAction SilentlyContinue
        Write-Host "  Staging exists with $($files.Count) files" -ForegroundColor $(if($files.Count -gt 0){'Green'}else{'Yellow'})
    }
    
    if (Test-Path $clientJar) {
        Write-Host "  Client JAR was restored (download completed)" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "If staging is empty, the download may have completed too quickly." -ForegroundColor Yellow
    Write-Host "Try running the script again, or check logs manually." -ForegroundColor Yellow
}

