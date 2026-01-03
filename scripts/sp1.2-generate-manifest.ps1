# SP1.2 Repeatability Validation - Manifest Generator
# Generates a filesystem manifest JSON for the MineAnvil instance directory
# Usage: .\scripts\sp1.2-generate-manifest.ps1 -RunNumber 1 -OutputPath "mineanvil-manifest-run1.json"

param(
    [Parameter(Mandatory=$true)]
    [int]$RunNumber,
    
    [Parameter(Mandatory=$false)]
    [string]$OutputPath = "mineanvil-manifest-run$RunNumber.json"
)

$root = Join-Path $env:APPDATA "MineAnvil\instances\default"

if (!(Test-Path $root)) {
    Write-Error "Instance root not found: $root"
    Write-Host "Please ensure MineAnvil has been run at least once."
    exit 1
}

Write-Host "Generating manifest for Run $RunNumber..."
Write-Host "Instance root: $root"
Write-Host "Output path: $OutputPath"

# Files/patterns to ignore (allowed per-run changes)
$ignored = @(
    "logs\mineanvil-main.log",
    ".minecraft\logs\mineanvil-launch-*.log"
)

$items = Get-ChildItem -LiteralPath $root -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object {
    $rel = $_.FullName.Substring($root.Length).TrimStart("\","/")
    $ignore = $false
    foreach ($p in $ignored) {
        if ($rel -like $p) { 
            $ignore = $true
            break
        }
    }
    if ($ignore) { 
        return $null
    }

    try {
        $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName -ErrorAction Stop).Hash
        [PSCustomObject]@{
            path = $rel
            size = $_.Length
            sha256 = $hash
        }
    } catch {
        Write-Warning "Failed to hash file: $($_.FullName) - $($_.Exception.Message)"
        return $null
    }
} | Where-Object { $_ -ne $null } | Sort-Object path

$manifest = @{
    runNumber = $RunNumber
    timestamp = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ")
    instanceRoot = $root
    fileCount = $items.Count
    files = $items
}

$manifest | ConvertTo-Json -Depth 10 | Out-File -Encoding UTF8 -FilePath $OutputPath

Write-Host "Manifest generated: $OutputPath"
Write-Host "Files captured: $($items.Count)"



