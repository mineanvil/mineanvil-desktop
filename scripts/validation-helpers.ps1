# Validation Helper Scripts for SP2.2 Windows Validation
# These functions can be called to analyze MineAnvil installation state

function Get-MineAnvilDirectoryTree {
    param(
        [string]$BasePath = "$env:APPDATA\MineAnvil"
    )
    
    if (-not (Test-Path $BasePath)) {
        Write-Host "Directory does not exist: $BasePath"
        return
    }
    
    Get-ChildItem -Path $BasePath -Recurse | 
        Select-Object FullName, PSIsContainer, Length, LastWriteTime |
        Format-Table -AutoSize
}

function Get-PackFiles {
    param(
        [string]$InstanceId = "default"
    )
    
    $packPath = "$env:APPDATA\MineAnvil\instances\$InstanceId\pack"
    
    if (-not (Test-Path $packPath)) {
        Write-Host "Pack directory does not exist: $packPath"
        return $null
    }
    
    Get-ChildItem -Path $packPath -File | 
        Select-Object Name, Length, LastWriteTime
}

function Get-LockfileMetadata {
    param(
        [string]$InstanceId = "default"
    )
    
    $lockfilePath = "$env:APPDATA\MineAnvil\instances\$InstanceId\pack\lock.json"
    
    if (-not (Test-Path $lockfilePath)) {
        Write-Host "Lockfile does not exist: $lockfilePath"
        return $null
    }
    
    $lockfile = Get-Content $lockfilePath | ConvertFrom-Json
    
    return @{
        SchemaVersion = $lockfile.schemaVersion
        MinecraftVersion = $lockfile.minecraftVersion
        ArtifactCount = $lockfile.artifacts.Count
        GeneratedAt = $lockfile.generatedAt
        PackId = $lockfile.packId
        PackVersion = $lockfile.packVersion
    }
}

function Get-FileHash {
    param(
        [string]$FilePath,
        [string]$Algorithm = "SHA256"
    )
    
    if (-not (Test-Path $FilePath)) {
        Write-Host "File does not exist: $FilePath"
        return $null
    }
    
    $hash = Get-FileHash -Path $FilePath -Algorithm $Algorithm
    return $hash.Hash.ToLower()
}

function Compare-DirectoryTrees {
    param(
        [string]$Path1,
        [string]$Path2,
        [string[]]$ExcludePatterns = @("*.log", "logs\*")
    )
    
    $tree1 = Get-ChildItem -Path $Path1 -Recurse | 
        Where-Object { 
            $excluded = $false
            foreach ($pattern in $ExcludePatterns) {
                if ($_.FullName -like "*\$pattern") {
                    $excluded = $true
                    break
                }
            }
            -not $excluded
        } | 
        Select-Object FullName, Length, LastWriteTime
    
    $tree2 = Get-ChildItem -Path $Path2 -Recurse | 
        Where-Object { 
            $excluded = $false
            foreach ($pattern in $ExcludePatterns) {
                if ($_.FullName -like "*\$pattern") {
                    $excluded = $true
                    break
                }
            }
            -not $excluded
        } | 
        Select-Object FullName, Length, LastWriteTime
    
    $diff = Compare-Object -ReferenceObject $tree1 -DifferenceObject $tree2 -Property FullName, Length
    
    return $diff
}

function Get-ArtifactChecksum {
    param(
        [string]$FilePath,
        [string]$Algorithm = "SHA1"
    )
    
    if (-not (Test-Path $FilePath)) {
        return $null
    }
    
    try {
        if ($Algorithm -eq "SHA1") {
            # Use .NET for SHA1 (PowerShell 5.1+)
            $sha1 = [System.Security.Cryptography.SHA1]::Create()
            $bytes = [System.IO.File]::ReadAllBytes($FilePath)
            $hash = $sha1.ComputeHash($bytes)
            return [System.BitConverter]::ToString($hash).Replace("-", "").ToLower()
        } else {
            $hash = Get-FileHash -Path $FilePath -Algorithm $Algorithm
            return $hash.Hash.ToLower()
        }
    } catch {
        Write-Host "Error computing hash: $_"
        return $null
    }
}

# Export functions for use
Export-ModuleMember -Function Get-MineAnvilDirectoryTree, Get-PackFiles, Get-LockfileMetadata, Get-FileHash, Compare-DirectoryTrees, Get-ArtifactChecksum


