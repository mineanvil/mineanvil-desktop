# Capture snapshot evidence for SP2.3 validation
param(
    [Parameter(Mandatory=$true)]
    [string]$EvidenceDir
)

powershell -File scripts\validation\list-snapshots.ps1 | Out-File -FilePath (Join-Path $EvidenceDir "snapshots.txt") -Encoding UTF8
powershell -File scripts\validation\read-snapshot.ps1 -SnapshotId 1767368619156-1.21.4 | Out-File -FilePath (Join-Path $EvidenceDir "snapshot-manifest.txt") -Encoding UTF8
Write-Host "Snapshot evidence saved to: $EvidenceDir"

