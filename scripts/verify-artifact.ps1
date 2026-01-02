# Verify artifact checksum against lockfile
param(
    [string]$LockfilePath,
    [string]$ArtifactName
)

$lockfile = Get-Content $LockfilePath | ConvertFrom-Json
$artifact = $lockfile.artifacts | Where-Object { $_.name -eq $ArtifactName } | Select-Object -First 1

if (-not $artifact) {
    Write-Host "Artifact not found: $ArtifactName"
    exit 1
}

# Resolve full path
$instancePath = Split-Path (Split-Path $LockfilePath)
if ($artifact.path.StartsWith(".minecraft/")) {
    $relativePath = $artifact.path -replace "^\.minecraft/", ""
    $fullPath = Join-Path $instancePath ".minecraft"
    $fullPath = Join-Path $fullPath $relativePath
} else {
    $fullPath = Join-Path $instancePath $artifact.path
}

if (-not (Test-Path $fullPath)) {
    Write-Host "File not found: $fullPath"
    exit 1
}

# Compute checksum
if ($artifact.checksum.algo -eq "sha1") {
    $sha1 = [System.Security.Cryptography.SHA1]::Create()
    $bytes = [System.IO.File]::ReadAllBytes($fullPath)
    $hash = $sha1.ComputeHash($bytes)
    $actual = [System.BitConverter]::ToString($hash).Replace("-", "").ToLower()
} elseif ($artifact.checksum.algo -eq "sha256") {
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    $bytes = [System.IO.File]::ReadAllBytes($fullPath)
    $hash = $sha256.ComputeHash($bytes)
    $actual = [System.BitConverter]::ToString($hash).Replace("-", "").ToLower()
} else {
    Write-Host "Unsupported algorithm: $($artifact.checksum.algo)"
    exit 1
}

$expected = $artifact.checksum.value.ToLower()
$match = $actual -eq $expected

Write-Host "Artifact: $ArtifactName"
Write-Host "Path: $fullPath"
Write-Host "Expected: $expected"
Write-Host "Actual:   $actual"
Write-Host "Match: $match"

exit $(if ($match) { 0 } else { 1 })

