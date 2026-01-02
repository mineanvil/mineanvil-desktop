# Find a library artifact from lockfile for testing
# Usage: .\scripts\validation\find-library-artifact.ps1 [instanceId]

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

# Find a library artifact that exists and is moderately sized (100KB - 5MB)
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

Write-Host "Selected Library Artifact:" -ForegroundColor Cyan
Write-Host "  Name: $($library.name)" -ForegroundColor White
Write-Host "  Path: $($library.path)" -ForegroundColor White
Write-Host "  Size: $($library.size) bytes ($([math]::Round($library.size / 1KB, 2)) KB)" -ForegroundColor White
Write-Host "  Final Path: $finalPath" -ForegroundColor White

if (Test-Path $finalPath) {
    $fileInfo = Get-Item $finalPath
    Write-Host "  Status: EXISTS ($([math]::Round($fileInfo.Length / 1KB, 2)) KB)" -ForegroundColor Green
    Write-Host ""
    Write-Host "To delete this file, run:" -ForegroundColor Yellow
    Write-Host "  Remove-Item '$finalPath' -Force" -ForegroundColor White
    Write-Host ""
    Write-Host "Or use:" -ForegroundColor Yellow
    Write-Host "  .\scripts\validation\delete-library-artifact.ps1" -ForegroundColor White
} else {
    Write-Host "  Status: NOT FOUND" -ForegroundColor Yellow
}

# Output the path for use in other scripts
$finalPath

