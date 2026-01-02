# Phase B: Interrupt During Staging Download (Improved)
# Monitors logs and kills MineAnvil when staging download is detected

$ErrorActionPreference = "Continue"

Write-Host "=== Phase B: Interrupt During Staging Download ===" -ForegroundColor Cyan
Write-Host ""

$appData = $env:APPDATA
$logPath = Join-Path $appData "MineAnvil\instances\default\logs\mineanvil-main.log"
$stagingPath = Join-Path $appData "MineAnvil\instances\default\.staging\pack-install"

# Verify client JAR is deleted
$clientJar = Join-Path $appData "MineAnvil\instances\default\.minecraft\versions\1.21.4\1.21.4.jar"
if (Test-Path $clientJar) {
    Write-Host "ERROR: Client JAR still exists! Run Phase A first." -ForegroundColor Red
    exit 1
}

Write-Host "Client JAR confirmed deleted. Starting MineAnvil..." -ForegroundColor Green
Write-Host ""

# Start MineAnvil in background
$workingDir = Get-Location
Write-Host "Working directory: $workingDir" -ForegroundColor Gray
$proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c","npm run dev:electron" -PassThru -WindowStyle Minimized -WorkingDirectory $workingDir
if ($proc) {
    Write-Host "App started (PID: $($proc.Id))" -ForegroundColor Gray
} else {
    Write-Host "Failed to start app" -ForegroundColor Red
    exit 1
}
Write-Host "Monitoring for staging download (max 90 seconds)..." -ForegroundColor Yellow
Write-Host ""

$startTime = Get-Date
$found = $false
$lastLogSize = 0

while (((Get-Date) - $startTime).TotalSeconds -lt 90) {
    # Check if process is still running
    if ($proc) {
        $stillRunning = Get-Process -Id $proc.Id -ErrorAction SilentlyContinue
        if (-not $stillRunning) {
            Write-Host "App process ended unexpectedly" -ForegroundColor Yellow
            break
        }
    }
    
    # Check logs for staging download
    if (Test-Path $logPath) {
        $currentLogSize = (Get-Item $logPath).Length
        if ($currentLogSize -gt $lastLogSize) {
            # Log file grew, read new lines
            $recent = Get-Content $logPath -Tail 30 -ErrorAction SilentlyContinue
            foreach ($line in $recent) {
                try {
                    $entry = $line | ConvertFrom-Json
                    if ($entry.area -eq "install.deterministic") {
                        $msg = $entry.message
                        if ($msg -match "downloading.*staging" -or $msg -match "downloading artifact to staging" -or $msg -match "installing artifact to staging") {
                            Write-Host "  STAGING DOWNLOAD DETECTED!" -ForegroundColor Green
                            Write-Host "  Log: $msg" -ForegroundColor Gray
                            Write-Host "  Killing app NOW..." -ForegroundColor Yellow
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
            $lastLogSize = $currentLogSize
        }
    }
    
    # Also check staging directory
    if (Test-Path $stagingPath) {
        $files = Get-ChildItem -Path $stagingPath -Recurse -File -ErrorAction SilentlyContinue
        if ($files.Count -gt 0) {
            Write-Host "  STAGING DIRECTORY CREATED with $($files.Count) files!" -ForegroundColor Green
            Write-Host "  Killing app NOW..." -ForegroundColor Yellow
            Get-Process electron -ErrorAction SilentlyContinue | Stop-Process -Force
            Start-Sleep -Seconds 2
            $found = $true
            break
        }
    }
    
    if ($found) {
        break
    }
    
    Start-Sleep -Milliseconds 500
    Write-Host "." -NoNewline
}

Write-Host ""
Write-Host ""

if ($found) {
    Write-Host "Phase B complete. App killed during staging download." -ForegroundColor Green
    Write-Host "Ready for Phase C (verify staging)." -ForegroundColor Green
    exit 0
} else {
    Write-Host "No staging download detected within 90 seconds." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Checking current state..." -ForegroundColor Cyan
    
    # Check if staging exists
    if (Test-Path $stagingPath) {
        $files = Get-ChildItem -Path $stagingPath -Recurse -File -ErrorAction SilentlyContinue
        Write-Host "  Staging directory exists with $($files.Count) files" -ForegroundColor $(if($files.Count -gt 0){'Green'}else{'Yellow'})
    } else {
        Write-Host "  Staging directory does not exist" -ForegroundColor Yellow
    }
    
    # Check if client JAR was restored
    if (Test-Path $clientJar) {
        Write-Host "  Client JAR was restored (download completed)" -ForegroundColor Yellow
    } else {
        Write-Host "  Client JAR still missing" -ForegroundColor Gray
    }
    
    # Check recent logs
    if (Test-Path $logPath) {
        Write-Host ""
        Write-Host "Recent installation logs:" -ForegroundColor Cyan
        Get-Content $logPath -Tail 10 | ForEach-Object {
            try {
                $e = $_ | ConvertFrom-Json
                if ($e.area -match "install") {
                    Write-Host "  [$($e.ts)] $($e.message)" -ForegroundColor Gray
                }
            } catch {}
        }
    }
    
    Write-Host ""
    Write-Host "App may have completed too quickly. Try again or check logs manually." -ForegroundColor Yellow
    exit 1
}

