# Create evidence directory for SP2.3 final validation
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$evidenceDir = Join-Path (Get-Location) "prompts\02-evidence\L2\sp2.3-final\$timestamp"
New-Item -ItemType Directory -Path $evidenceDir -Force | Out-Null
Write-Host $evidenceDir



