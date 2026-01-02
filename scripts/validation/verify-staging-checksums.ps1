# Verify staging artifact checksums against lockfile (read-only)
# Usage: .\scripts\validation\verify-staging-checksums.ps1 [instanceId]

param(
    [string]$InstanceId = "default"
)

$appData = $env:APPDATA
$lockfilePath = Join-Path $appData "MineAnvil\instances\$InstanceId\pack\lock.json"
$stagingPath = Join-Path $appData "MineAnvil\instances\$InstanceId\.staging\pack-install"

if (-not (Test-Path $lockfilePath)) {
    Write-Host "Lockfile not found: $lockfilePath" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $stagingPath)) {
    Write-Host "Staging directory does not exist" -ForegroundColor Yellow
    exit 0
}

$lockfile = Get-Content $lockfilePath | ConvertFrom-Json

Write-Host "Verifying staging artifacts against lockfile..." -ForegroundColor Cyan
Write-Host "Lockfile: $lockfilePath" -ForegroundColor Gray
Write-Host "Staging: $stagingPath`n" -ForegroundColor Gray

$verified = 0
$failed = 0

foreach ($artifact in $lockfile.artifacts) {
    if ($artifact.kind -eq "runtime") {
        continue
    }
    
    # Resolve staging path
    $stagingArtifactPath = $stagingPath
    if ($artifact.path.StartsWith(".minecraft/")) {
        $stagingArtifactPath = Join-Path $stagingPath ".minecraft"
        $relativePath = $artifact.path.Substring(".minecraft/".Length)
        $stagingArtifactPath = Join-Path $stagingArtifactPath $relativePath
    } else {
        $stagingArtifactPath = Join-Path $stagingArtifactPath $artifact.path
    }
    
    if (-not (Test-Path $stagingArtifactPath)) {
        continue
    }
    
    # Calculate checksum
    $fileBytes = [System.IO.File]::ReadAllBytes($stagingArtifactPath)
    $sha1 = [System.Security.Cryptography.SHA1]::Create()
    $hashBytes = $sha1.ComputeHash($fileBytes)
    $actualChecksum = [System.BitConverter]::ToString($hashBytes).Replace("-", "").ToLower()
    $expectedChecksum = $artifact.checksum.value.ToLower()
    
    if ($actualChecksum -eq $expectedChecksum) {
        Write-Host "  ✓ $($artifact.name)" -ForegroundColor Green
        $verified++
    } else {
        Write-Host "  ✗ $($artifact.name)" -ForegroundColor Red
        Write-Host "    Expected: $expectedChecksum" -ForegroundColor Gray
        Write-Host "    Actual:   $actualChecksum" -ForegroundColor Gray
        $failed++
    }
}

Write-Host "`nVerified: $verified" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })

