# List quarantine directory contents (read-only)
# Usage: .\scripts\validation\list-quarantine.ps1 [instanceId]

param(
    [string]$InstanceId = "default"
)

$appData = $env:APPDATA
$quarantinePath = Join-Path $appData "MineAnvil\instances\$InstanceId\.quarantine"

Write-Host "Quarantine Directory: $quarantinePath" -ForegroundColor Cyan

if (-not (Test-Path $quarantinePath)) {
    Write-Host "Quarantine directory does not exist (no quarantined files)" -ForegroundColor Yellow
    exit 0
}

Write-Host "`nQuarantined Files:" -ForegroundColor Green
Get-ChildItem -Path $quarantinePath -File | ForEach-Object {
    $size = [math]::Round($_.Length / 1KB, 2)
    $modified = $_.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
    Write-Host "  $($_.Name) ($size KB, quarantined: $modified)" -ForegroundColor White
}

$fileCount = (Get-ChildItem -Path $quarantinePath -File).Count
Write-Host "`nTotal quarantined files: $fileCount" -ForegroundColor Cyan

