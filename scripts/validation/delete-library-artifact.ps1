# Delete a library artifact for testing interrupted install
# Usage: .\scripts\validation\delete-library-artifact.ps1 [instanceId]

param(
    [string]$InstanceId = "default"
)

$appData = $env:APPDATA
$lockfilePath = Join-Path $appData "MineAnvil\instances\$InstanceId\pack\lock.json"

if (-not (Test-Path $lockfilePath)) {
    Write-Host "Lockfile not found: $lockfilePath" -ForegroundColor Red
    exit 1
}

$lockfile = Get-Content $lockfilePath | ConvertFrom-Json

# Find a library artifact that exists and is moderately sized
$libraries = $lockfile.artifacts | Where-Object { 
    $_.kind -eq "library" -and 
    $_.size -gt 100000 -and 
    $_.size -lt 5000000 
}

if ($libraries.Count -eq 0) {
    Write-Host "No suitable library artifacts found" -ForegroundColor Yellow
    exit 1
}

$library = $libraries[0]
$mcDir = Join-Path $appData "MineAnvil\instances\$InstanceId\.minecraft"
$finalPath = Join-Path $mcDir ($library.path -replace "^\.minecraft/", "")

if (-not (Test-Path $finalPath)) {
    Write-Host "File not found: $finalPath" -ForegroundColor Yellow
    Write-Host "Nothing to delete." -ForegroundColor Yellow
    exit 0
}

Write-Host "Deleting library artifact for testing:" -ForegroundColor Cyan
Write-Host "  Name: $($library.name)" -ForegroundColor White
Write-Host "  Path: $finalPath" -ForegroundColor White

Remove-Item $finalPath -Force

if (-not (Test-Path $finalPath)) {
    Write-Host "  Status: DELETED" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Launch MineAnvil to trigger download" -ForegroundColor White
    Write-Host "2. Kill the app mid-download to create staging artifacts" -ForegroundColor White
    Write-Host "3. Check staging with: .\scripts\validation\list-staging.ps1" -ForegroundColor White
} else {
    Write-Host "  Status: FAILED TO DELETE" -ForegroundColor Red
    exit 1
}

