# Monitor logs for download activity and kill the app mid-download
# Usage: .\scripts\validation\monitor-and-kill-download.ps1 [waitSeconds]

param(
    [int]$WaitSeconds = 30
)

$appData = $env:APPDATA
$logPath = Join-Path $appData "MineAnvil\instances\default\logs\mineanvil-main.log"

Write-Host "Monitoring logs for download activity..." -ForegroundColor Cyan
Write-Host "Will kill app when download starts (max wait: $WaitSeconds seconds)" -ForegroundColor Yellow
Write-Host ""

$startTime = Get-Date
$found = $false

while (((Get-Date) - $startTime).TotalSeconds -lt $WaitSeconds) {
    if (Test-Path $logPath) {
        $recent = Get-Content $logPath -Tail 10 -ErrorAction SilentlyContinue
        foreach ($line in $recent) {
            try {
                $entry = $line | ConvertFrom-Json
                if ($entry.area -eq "install.deterministic" -or $entry.area -eq "install.planner") {
                    if ($entry.message -match "downloading|installing.*staging|promoting") {
                        Write-Host "Found download activity: $($entry.message)" -ForegroundColor Green
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
    
    Start-Sleep -Seconds 2
    Write-Host "." -NoNewline
}

Write-Host ""

if ($found) {
    Write-Host "Killing Electron processes..." -ForegroundColor Yellow
    Get-Process electron -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 1
    Write-Host "Processes killed. Check staging directory now." -ForegroundColor Green
} else {
    Write-Host "No download activity detected within $WaitSeconds seconds." -ForegroundColor Yellow
    Write-Host "Checking if app is still running..." -ForegroundColor Cyan
    $procs = Get-Process electron -ErrorAction SilentlyContinue
    if ($procs) {
        Write-Host "App is still running. Kill manually if needed:" -ForegroundColor Yellow
        Write-Host "  Get-Process electron | Stop-Process -Force" -ForegroundColor White
    } else {
        Write-Host "App is not running." -ForegroundColor Gray
    }
}

