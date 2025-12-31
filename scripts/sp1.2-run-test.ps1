# SP1.2 Repeatability Test Runner
# Executes a single test run: start app, wait for init, stop, generate manifest

param(
    [Parameter(Mandatory=$true)]
    [int]$RunNumber,
    
    [Parameter(Mandatory=$false)]
    [int]$WaitSeconds = 15
)

$ErrorActionPreference = "Stop"

Write-Host "========================================"
Write-Host "SP1.2 Run $RunNumber"
Write-Host "========================================"

$startTime = Get-Date
Write-Host "Start time: $($startTime.ToString('yyyy-MM-dd HH:mm:ss'))"

# Start the app
Write-Host "Starting MineAnvil..."
# Use cmd to run npm (works better with PATH)
$proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c","npm run dev:electron" -PassThru -WindowStyle Minimized
Write-Host "Process started with PID: $($proc.Id)"

# Wait for instance directory to be created
Write-Host "Waiting for initialization (max $WaitSeconds seconds)..."
$instancePath = Join-Path $env:APPDATA "MineAnvil\instances\default"
$waited = 0
$found = $false

while ($waited -lt $WaitSeconds) {
    Start-Sleep -Seconds 2
    $waited += 2
    if (Test-Path $instancePath) {
        $found = $true
        Write-Host "Instance directory found after $waited seconds"
        break
    }
    Write-Host "  Waiting... ($waited/$WaitSeconds seconds)"
}

if (-not $found) {
    Write-Warning "Instance directory not created within $WaitSeconds seconds"
}

# Wait a bit more for steady state
Write-Host "Waiting additional 5 seconds for steady state..."
Start-Sleep -Seconds 5

# Stop the app
Write-Host "Stopping MineAnvil..."
Get-Process | Where-Object { $_.ProcessName -like "*electron*" -or ($_.ProcessName -eq "node" -and $_.Parent.Id -eq $proc.Id) } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

$endTime = Get-Date
Write-Host "End time: $($endTime.ToString('yyyy-MM-dd HH:mm:ss'))"
$duration = $endTime - $startTime
Write-Host "Duration: $($duration.TotalSeconds) seconds"

# Generate manifest
Write-Host "Generating manifest..."
$manifestPath = "mineanvil-manifest-run$RunNumber.json"
& "$PSScriptRoot\sp1.2-generate-manifest.ps1" -RunNumber $RunNumber -OutputPath $manifestPath

if (Test-Path $manifestPath) {
    Write-Host "✅ Manifest generated: $manifestPath"
} else {
    Write-Error "❌ Failed to generate manifest"
    exit 1
}

Write-Host "Run $RunNumber complete"
Write-Host ""

