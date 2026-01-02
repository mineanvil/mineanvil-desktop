# Phase B: Interrupt During Staging Download
# Monitors logs and kills MineAnvil when staging download is detected

$ErrorActionPreference = "Stop"

Write-Host "=== Phase B: Interrupt During Staging Download ===" -ForegroundColor Cyan
Write-Host ""

$appData = $env:APPDATA
$logPath = Join-Path $appData "MineAnvil\instances\default\logs\mineanvil-main.log"
$stagingPath = Join-Path $appData "MineAnvil\instances\default\.staging\pack-install"

Write-Host "Monitoring logs for staging download activity..." -ForegroundColor Yellow
Write-Host "Will kill app when download starts (max wait: 60 seconds)" -ForegroundColor Gray
Write-Host ""

# Start MineAnvil
Write-Host "Starting MineAnvil..." -ForegroundColor Yellow
$proc = Start-Process npm -ArgumentList "run","dev:electron" -PassThru -WindowStyle Minimized -WorkingDirectory (Get-Location)
Write-Host "  App started (PID: $($proc.Id))" -ForegroundColor Gray
Write-Host ""

$startTime = Get-Date
$found = $false
$checkCount = 0

while (((Get-Date) - $startTime).TotalSeconds -lt 60) {
    $checkCount++
    
    # Check logs
    if (Test-Path $logPath) {
        $recent = Get-Content $logPath -Tail 20 -ErrorAction SilentlyContinue
        foreach ($line in $recent) {
            try {
                $entry = $line | ConvertFrom-Json
                if ($entry.area -eq "install.deterministic") {
                    if ($entry.message -match "downloading.*staging|installing.*staging|downloading artifact to staging") {
                        Write-Host "  Download detected! Log: $($entry.message)" -ForegroundColor Green
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
    
    # Also check if staging directory was created with files
    if (Test-Path $stagingPath) {
        $files = Get-ChildItem -Path $stagingPath -Recurse -File -ErrorAction SilentlyContinue
        if ($files.Count -gt 0) {
            Write-Host "  Staging directory created with $($files.Count) files!" -ForegroundColor Green
            Write-Host "  Killing app..." -ForegroundColor Yellow
            Get-Process electron -ErrorAction SilentlyContinue | Stop-Process -Force
            Start-Sleep -Seconds 2
            $found = $true
            break
        }
    }
    
    if ($found) {
        break
    }
    
    Start-Sleep -Seconds 1
    if ($checkCount % 5 -eq 0) {
        Write-Host "." -NoNewline
    }
}

Write-Host ""

if ($found) {
    Write-Host "Phase B complete. App killed during staging download." -ForegroundColor Green
    Write-Host "Ready for Phase C (verify staging)." -ForegroundColor Green
} else {
    Write-Host "No staging download detected within 60 seconds." -ForegroundColor Yellow
    Write-Host "Checking if app is still running..." -ForegroundColor Yellow
    $procs = Get-Process electron -ErrorAction SilentlyContinue
    if ($procs) {
        Write-Host "App is still running. Kill manually if needed:" -ForegroundColor Yellow
        Write-Host "  Get-Process electron | Stop-Process -Force" -ForegroundColor White
    }
    exit 1
}

