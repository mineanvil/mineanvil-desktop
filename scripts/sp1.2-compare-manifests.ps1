# SP1.2 Repeatability Validation - Manifest Comparison
# Compares two manifest JSON files to detect differences
# Usage: .\scripts\sp1.2-compare-manifests.ps1 -Manifest1 "mineanvil-manifest-run1.json" -Manifest2 "mineanvil-manifest-run2.json"

param(
    [Parameter(Mandatory=$true)]
    [string]$Manifest1,
    
    [Parameter(Mandatory=$true)]
    [string]$Manifest2
)

if (!(Test-Path $Manifest1)) {
    Write-Error "Manifest 1 not found: $Manifest1"
    exit 1
}

if (!(Test-Path $Manifest2)) {
    Write-Error "Manifest 2 not found: $Manifest2"
    exit 1
}

Write-Host "Comparing manifests:"
Write-Host "  Run 1: $Manifest1"
Write-Host "  Run 2: $Manifest2"
Write-Host ""

$m1 = Get-Content $Manifest1 -Raw | ConvertFrom-Json
$m2 = Get-Content $Manifest2 -Raw | ConvertFrom-Json

$files1 = $m1.files | ForEach-Object { @{ path = $_.path; size = $_.size; sha256 = $_.sha256 } }
$files2 = $m2.files | ForEach-Object { @{ path = $_.path; size = $_.size; sha256 = $_.sha256 } }

$diff = Compare-Object -ReferenceObject $files1 -DifferenceObject $files2 -Property path,size,sha256

if ($null -eq $diff -or $diff.Count -eq 0) {
    Write-Host "✅ MANIFESTS MATCH - No differences found" -ForegroundColor Green
    Write-Host "File count: $($m1.fileCount)"
} else {
    Write-Host "❌ MANIFESTS DIFFER - Found $($diff.Count) difference(s)" -ForegroundColor Red
    Write-Host ""
    
    $onlyIn1 = $diff | Where-Object { $_.SideIndicator -eq "<=" }
    $onlyIn2 = $diff | Where-Object { $_.SideIndicator -eq "=>" }
    
    if ($onlyIn1) {
        Write-Host "Files only in Run 1:" -ForegroundColor Yellow
        $onlyIn1 | ForEach-Object { Write-Host "  - $($_.path)" }
        Write-Host ""
    }
    
    if ($onlyIn2) {
        Write-Host "Files only in Run 2:" -ForegroundColor Yellow
        $onlyIn2 | ForEach-Object { Write-Host "  - $($_.path)" }
        Write-Host ""
    }
    
    # Check for modified files (same path, different hash)
    $paths1 = $files1 | ForEach-Object { $_.path }
    $paths2 = $files2 | ForEach-Object { $_.path }
    $commonPaths = $paths1 | Where-Object { $paths2 -contains $_ }
    
    $modified = @()
    foreach ($p in $commonPaths) {
        $f1 = $files1 | Where-Object { $_.path -eq $p } | Select-Object -First 1
        $f2 = $files2 | Where-Object { $_.path -eq $p } | Select-Object -First 1
        if ($f1.sha256 -ne $f2.sha256) {
            $modified += [PSCustomObject]@{
                path = $p
                run1Size = $f1.size
                run1Hash = $f1.sha256.Substring(0, 16) + "..."
                run2Size = $f2.size
                run2Hash = $f2.sha256.Substring(0, 16) + "..."
            }
        }
    }
    
    if ($modified) {
        Write-Host "Modified files (same path, different content):" -ForegroundColor Yellow
        $modified | ForEach-Object { 
            Write-Host "  - $($_.path)"
            Write-Host "    Run 1: size=$($_.run1Size), hash=$($_.run1Hash)"
            Write-Host "    Run 2: size=$($_.run2Size), hash=$($_.run2Hash)"
        }
    }
}

Write-Host ""
Write-Host "Summary:"
Write-Host "  Run 1 file count: $($m1.fileCount)"
Write-Host "  Run 2 file count: $($m2.fileCount)"

return $diff




