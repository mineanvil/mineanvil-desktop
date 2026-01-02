# List staging directory contents (read-only)
# Usage: .\scripts\validation\list-staging.ps1 [instanceId]

param(
    [string]$InstanceId = "default"
)

$appData = $env:APPDATA
$stagingPath = Join-Path $appData "MineAnvil\instances\$InstanceId\.staging\pack-install"

Write-Host "Staging Directory: $stagingPath" -ForegroundColor Cyan

if (-not (Test-Path $stagingPath)) {
    Write-Host "Staging directory does not exist (clean state)" -ForegroundColor Yellow
    exit 0
}

Write-Host "`nStaging Contents:" -ForegroundColor Green
Get-ChildItem -Path $stagingPath -Recurse -File | ForEach-Object {
    $relativePath = $_.FullName.Replace($stagingPath, "").TrimStart("\")
    $size = [math]::Round($_.Length / 1KB, 2)
    Write-Host "  $relativePath ($size KB)" -ForegroundColor White
}

$fileCount = (Get-ChildItem -Path $stagingPath -Recurse -File).Count
Write-Host "`nTotal files in staging: $fileCount" -ForegroundColor Cyan

