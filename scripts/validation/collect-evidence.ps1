# Collect all evidence for SP2.3 Scenario A + B validation
# Usage: .\scripts\validation\collect-evidence.ps1

$ErrorActionPreference = "Continue"

Write-Host "=== Collecting SP2.3 Scenario A + B Evidence ===" -ForegroundColor Cyan
Write-Host ""

$evidenceDir = "sp2.3-scenario-ab-evidence"
New-Item -ItemType Directory -Force -Path $evidenceDir | Out-Null

$appData = $env:APPDATA
$logPath = Join-Path $appData "MineAnvil\instances\default\logs\mineanvil-main.log"
$clientJar = Join-Path $appData "MineAnvil\instances\default\.minecraft\versions\1.21.4\1.21.4.jar"

Write-Host "Collecting evidence files..." -ForegroundColor Yellow

# Recovery logs
Write-Host "1. Recovery logs..." -ForegroundColor Gray
Get-Content $logPath -Tail 200 | Select-String -Pattern "install|staging|recovery|promote|resume|quarantine|snapshot" | Out-File "$evidenceDir\recovery-logs.txt"

# Staging status
Write-Host "2. Staging status..." -ForegroundColor Gray
& "$PSScriptRoot\list-staging.ps1" | Out-File "$evidenceDir\staging-status.txt"

# Snapshots
Write-Host "3. Snapshots..." -ForegroundColor Gray
& "$PSScriptRoot\list-snapshots.ps1" | Out-File "$evidenceDir\snapshots.txt"

# Quarantine
Write-Host "4. Quarantine..." -ForegroundColor Gray
& "$PSScriptRoot\list-quarantine.ps1" | Out-File "$evidenceDir\quarantine.txt"

# Final location verification
Write-Host "5. Final location..." -ForegroundColor Gray
$finalExists = Test-Path $clientJar
if ($finalExists) {
    $fileInfo = Get-Item $clientJar
    "Client JAR exists: $([math]::Round($fileInfo.Length / 1MB, 2)) MB" | Out-File "$evidenceDir\final-location.txt"
} else {
    "Client JAR does not exist" | Out-File "$evidenceDir\final-location.txt"
}

# Immutability checks
Write-Host "6. Immutability checks..." -ForegroundColor Gray
& "$PSScriptRoot\check-manifest-immutability.ps1" | Out-File "$evidenceDir\manifest-immutability.txt"
& "$PSScriptRoot\check-lockfile-immutability.ps1" | Out-File "$evidenceDir\lockfile-immutability.txt"

Write-Host ""
Write-Host "Evidence collected in: $evidenceDir" -ForegroundColor Green
Write-Host ""
Get-ChildItem -Path $evidenceDir | ForEach-Object {
    Write-Host "  $($_.Name)" -ForegroundColor Gray
}

