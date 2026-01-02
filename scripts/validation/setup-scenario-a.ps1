# Setup Scenario A: Create staging artifacts by interrupting download
# Usage: .\scripts\validation\setup-scenario-a.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== Scenario A Setup: Interrupted Install ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Delete library artifact
Write-Host "Step 1: Deleting library artifact..." -ForegroundColor Yellow
& "$PSScriptRoot\delete-library-artifact.ps1"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to delete artifact" -ForegroundColor Red
    exit 1
}

# Step 2: Stop any running processes
Write-Host "Step 2: Stopping any running Electron processes..." -ForegroundColor Yellow
Get-Process electron -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

# Step 3: Start app and monitor for download
Write-Host "Step 3: Starting MineAnvil and monitoring for download..." -ForegroundColor Yellow
$proc = Start-Process npm -ArgumentList "run","dev:electron" -PassThru -WindowStyle Minimized
Write-Host "  App started (PID: $($proc.Id))" -ForegroundColor Gray

$appData = $env:APPDATA
$logPath = Join-Path $appData "MineAnvil\instances\default\logs\mineanvil-main.log"
$stagingPath = Join-Path $appData "MineAnvil\instances\default\.staging\pack-install"

Write-Host "  Monitoring logs for download activity (max 30 seconds)..." -ForegroundColor Gray

$found = $false
$startTime = Get-Date

while (((Get-Date) - $startTime).TotalSeconds -lt 30) {
    # Check logs
    if (Test-Path $logPath) {
        $recent = Get-Content $logPath -Tail 10 -ErrorAction SilentlyContinue
        foreach ($line in $recent) {
            try {
                $entry = $line | ConvertFrom-Json
                if ($entry.area -eq "install.deterministic") {
                    if ($entry.message -match "downloading.*staging|installing.*staging") {
                        Write-Host "  Download detected! Killing app..." -ForegroundColor Green
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
    
    # Also check if staging directory was created
    if (Test-Path $stagingPath) {
        $files = Get-ChildItem -Path $stagingPath -Recurse -File -ErrorAction SilentlyContinue
        if ($files.Count -gt 0) {
            Write-Host "  Staging directory created with files! Killing app..." -ForegroundColor Green
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
    Write-Host "." -NoNewline
}

Write-Host ""

if ($found) {
    Write-Host "Step 4: Verifying staging artifacts..." -ForegroundColor Yellow
    & "$PSScriptRoot\list-staging.ps1"
    Write-Host ""
    Write-Host "Scenario A setup complete!" -ForegroundColor Green
    Write-Host "Staging artifacts created. Ready for Scenario B (resume test)." -ForegroundColor Green
} else {
    Write-Host "No download detected or staging not created." -ForegroundColor Yellow
    Write-Host "Check logs manually or try again." -ForegroundColor Yellow
    exit 1
}

