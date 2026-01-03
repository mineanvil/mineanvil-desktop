# Capture rollback execution evidence for SP2.3
# Usage: .\scripts\validation\capture-rollback-evidence.ps1 -InstanceId <id> [-SnapshotId <id>] [-LogPath <path>] [-ShowVerbose]
#
# Prerequisites:
# - Electron code must be compiled: npm run build:electron
# - At least one snapshot should exist (scenarios will handle missing snapshots gracefully)

param(
    [Parameter(Mandatory=$true)]
    [string]$InstanceId,
    
    [string]$SnapshotId = $null,
    
    [string]$LogPath = $null,
    
    [string]$EvidenceDir = $null,
    
    [switch]$ShowVerbose
)

$ErrorActionPreference = "Continue"

# Helper functions
function Write-VerboseOutput {
    param([string]$Message)
    if ($ShowVerbose) {
        Write-Host $Message -ForegroundColor Gray
    }
}

function Get-SHA256Hash {
    param([string]$FilePath)
    if (Test-Path $FilePath) {
        $hash = Get-FileHash -Path $FilePath -Algorithm SHA256
        return $hash.Hash
    }
    return "missing"
}

function Find-MostRecentLogFile {
    param(
        [string]$LogsDir,
        [string]$InstanceId,
        [string]$ScenarioLocalLog = $null
    )
    # First, check for scenario-local log file (highest priority)
    if (-not [string]::IsNullOrEmpty($ScenarioLocalLog) -and (Test-Path $ScenarioLocalLog)) {
        Write-VerboseOutput "Found scenario-local log file: $ScenarioLocalLog"
        return $ScenarioLocalLog
    }
    
    # Build candidate log paths in priority order
    $candidates = @()
    
    # Priority 1: mineanvil-main.log (preferred main process log)
    $mainLogPath = Join-Path $LogsDir "mineanvil-main.log"
    $candidates += @{
        Path = $mainLogPath
        Name = "mineanvil-main.log"
        Priority = 1
        Reason = "Main process log (preferred)"
    }
    
    # Priority 2: Check instance logs directory for other log files
    if (Test-Path $LogsDir) {
        $logFiles = Get-ChildItem -Path $LogsDir -Filter "*.log" -ErrorAction SilentlyContinue | 
            Sort-Object LastWriteTime -Descending
        
        foreach ($logFile in $logFiles) {
            # Skip main log since we already added it
            if ($logFile.Name -ne "mineanvil-main.log") {
                $candidates += @{
                    Path = $logFile.FullName
                    Name = $logFile.Name
                    Priority = if ($logFile.Name -match "renderer") { 3 } else { 2 }
                    Reason = if ($logFile.Name -match "renderer") { "Renderer log (lower priority)" } else { "Other log file" }
                }
            }
        }
    } else {
        Write-VerboseOutput "Logs directory does not exist: $LogsDir"
    }
    
    # Check each candidate in priority order
    Write-VerboseOutput "Checking $($candidates.Count) log file candidate(s)"
    
    $foundWithRollback = $null
    $foundWithoutRollback = $null
    
    foreach ($candidate in ($candidates | Sort-Object Priority)) {
        $candidatePath = $candidate.Path
        Write-VerboseOutput "  Candidate $($candidate.Priority): $($candidate.Name) - $($candidate.Reason)"
        
        if (-not (Test-Path $candidatePath)) {
            Write-VerboseOutput "    REJECTED: File does not exist"
            continue
        }
        
        Write-VerboseOutput "    File exists: $candidatePath"
        
        # Check if file has rollback entries (sample first 1000 lines and last 1000 lines)
        $hasRollbackEntries = $false
        try {
            # Check first 1000 lines
            $content = Get-Content $candidatePath -ErrorAction SilentlyContinue -TotalCount 1000
            foreach ($line in $content) {
                try {
                    if ($line -match '"area"\s*:\s*"install\.rollback"' -or $line -match '"message"\s*:\s*"rollback_') {
                        $hasRollbackEntries = $true
                        break
                    }
                } catch {
                    # Skip non-JSON lines
                }
            }
            
            # If not found in first 1000, check last 1000 lines (rollback entries might be recent)
            # Use Select-Object -Last to avoid reading entire file into memory
            if (-not $hasRollbackEntries) {
                $lastLines = Get-Content $candidatePath -ErrorAction SilentlyContinue -Tail 1000
                foreach ($line in $lastLines) {
                    try {
                        if ($line -match '"area"\s*:\s*"install\.rollback"' -or $line -match '"message"\s*:\s*"rollback_') {
                            $hasRollbackEntries = $true
                            break
                        }
                    } catch {
                        # Skip non-JSON lines
                    }
                }
            }
        } catch {
            Write-VerboseOutput "    WARNING: Error reading file - $($_.Exception.Message)"
            # Still consider the file if it exists
        }
        
        if ($hasRollbackEntries) {
            Write-VerboseOutput "    ACCEPTED: Contains rollback entries"
            if ($null -eq $foundWithRollback) {
                $foundWithRollback = $candidatePath
            }
        } else {
            Write-VerboseOutput "    No rollback entries found in sample (file may still contain rollback entries)"
            if ($null -eq $foundWithoutRollback -and $candidate.Priority -eq 1) {
                # Keep the main log as fallback
                $foundWithoutRollback = $candidatePath
            }
        }
    }
    
    # Prefer file with rollback entries, but return main log if it exists even without entries in sample
    if ($foundWithRollback) {
        Write-VerboseOutput "  Selected: $foundWithRollback (contains rollback entries)"
        return $foundWithRollback
    } elseif ($foundWithoutRollback) {
        Write-VerboseOutput "  Selected: $foundWithoutRollback (main log file, will scan full file for rollback entries)"
        return $foundWithoutRollback
    }
    
    # If main log exists but wasn't added to candidates (shouldn't happen, but be safe)
    $mainLogPath = Join-Path $LogsDir "mineanvil-main.log"
    if (Test-Path $mainLogPath) {
        Write-VerboseOutput "  Fallback: Found mineanvil-main.log (wasn't in candidates list)"
        return $mainLogPath
    }
    
    Write-VerboseOutput "  No log files found"
    return $null
}

function Find-ManifestFile {
    param([string]$InstanceRoot)
    $manifestPath = Join-Path $InstanceRoot "pack\manifest.json"
    if (Test-Path $manifestPath) {
        return $manifestPath
    }
    # Try searching
    $found = Get-ChildItem -Path $InstanceRoot -Filter "*manifest*.json" -Recurse -ErrorAction SilentlyContinue | 
        Select-Object -First 1
    if ($found) {
        return $found.FullName
    }
    return $null
}

function Capture-DirectoryTree {
    param(
        [string]$Path,
        [string]$OutputFile
    )
    if (Test-Path $Path) {
        tree "$Path" /f | Out-File -FilePath $OutputFile -Encoding UTF8
    } else {
        "Directory does not exist: $Path" | Out-File -FilePath $OutputFile -Encoding UTF8
    }
}

function Capture-DirectoryListing {
    param(
        [string]$Path,
        [string]$OutputFile
    )
    if (Test-Path $Path) {
        Get-ChildItem -Path $Path -Recurse -ErrorAction SilentlyContinue | 
            Select-Object FullName, Length, LastWriteTime | 
            Format-Table -AutoSize | 
            Out-File -FilePath $OutputFile -Encoding UTF8
    } else {
        "Directory does not exist: $Path" | Out-File -FilePath $OutputFile -Encoding UTF8
    }
}

function Extract-RollbackLogs {
    param(
        [string]$LogFile,
        [string]$OutputFile
    )
    if ([string]::IsNullOrEmpty($LogFile) -or -not (Test-Path $LogFile)) {
        if ([string]::IsNullOrEmpty($LogFile)) {
            "Log file path not provided or not found" | Out-File -FilePath $OutputFile -Encoding UTF8
        } else {
            "Log file does not exist: $LogFile" | Out-File -FilePath $OutputFile -Encoding UTF8
        }
        return @()
    }
    
    $extracted = @()
    $content = Get-Content $LogFile -ErrorAction SilentlyContinue
    
    foreach ($line in $content) {
        try {
            # Check for rollback patterns: '"area":"install.rollback"' OR '"message":"rollback_'
            # OR lines containing authority metadata (any non-empty value)
            # OR lines containing remoteMetadataUsed (true or false)
            $matches = $false
            if ($line -match '"area"\s*:\s*"install\.rollback"' -or $line -match '"message"\s*:\s*"rollback_') {
                $matches = $true
            } elseif ($line -match '"authority"\s*:\s*"[^"]+"') {
                # Match "authority": "<non-empty-string>" (any non-empty value)
                $matches = $true
            } elseif ($line -match '"remoteMetadataUsed"\s*:\s*(true|false)') {
                # Match "remoteMetadataUsed": true or false
                $matches = $true
            }
            
            if ($matches) {
                $extracted += $line
            }
        } catch {
            # Skip non-JSON lines or lines that can't be processed
        }
    }
    
    # Always create output file (even if empty)
    $extracted | Out-File -FilePath $OutputFile -Encoding UTF8
    
    # Add verbose logging
    Write-VerboseOutput "Extract-RollbackLogs: Matched $($extracted.Count) lines from $LogFile"
    
    return $extracted
}

function Assert-LogMetadata {
    param(
        [array]$LogLines,
        [string]$ScenarioName,
        [bool]$RollbackExecuted = $true
    )
    
    if (-not $RollbackExecuted) {
        return @{
            HasAuthority = $false
            HasRemoteMetadata = $false
            Pass = $true  # Pass because we skip the check when rollback didn't run
            Skipped = $true
        }
    }
    
    $hasAuthority = $false
    $hasRemoteMetadata = $false
    
    foreach ($line in $LogLines) {
        # First try regex (more reliable for nested structures)
        # Check for nested meta.meta.authority (any non-empty value)
        if (-not $hasAuthority -and $line -match '"meta"\s*:\s*\{[^}]*"meta"\s*:\s*\{[^}]*"authority"\s*:\s*"([^"]+)"') {
            $hasAuthority = $true
        }
        # Check for nested meta.meta.remoteMetadataUsed == false
        if (-not $hasRemoteMetadata -and $line -match '"meta"\s*:\s*\{[^}]*"meta"\s*:\s*\{[^}]*"remoteMetadataUsed"\s*:\s*false') {
            $hasRemoteMetadata = $true
        }
        # Fallback: check for direct meta structure (only if nested wasn't found)
        if (-not $hasAuthority -and $line -match '"meta"\s*:\s*\{[^}]*"authority"\s*:\s*"([^"]+)"') {
            $hasAuthority = $true
        }
        if (-not $hasRemoteMetadata -and $line -match '"meta"\s*:\s*\{[^}]*"remoteMetadataUsed"\s*:\s*false') {
            $hasRemoteMetadata = $true
        }
        
        # Also try JSON parsing as secondary check (may work better in some cases)
        if (-not $hasAuthority -or -not $hasRemoteMetadata) {
            try {
                # Parse JSON line to check meta object
                $entry = $line | ConvertFrom-Json -ErrorAction SilentlyContinue
                if ($null -eq $entry) { continue }
                
                # Handle nested meta.meta structure (meta.meta.authority and meta.meta.remoteMetadataUsed)
                # Also handle direct meta structure (meta.authority and meta.remoteMetadataUsed)
                $metaObj = $entry.meta
                if ($metaObj) {
                    # Check for nested meta.meta structure first
                    if ($metaObj.meta) {
                        # Check meta.meta.authority exists and is non-empty (any string value)
                        if (-not $hasAuthority -and $metaObj.meta.authority -and -not [string]::IsNullOrWhiteSpace($metaObj.meta.authority)) {
                            $hasAuthority = $true
                        }
                        # Check meta.meta.remoteMetadataUsed == false
                        if (-not $hasRemoteMetadata -and $metaObj.meta.remoteMetadataUsed -eq $false) {
                            $hasRemoteMetadata = $true
                        }
                    } else {
                        # Check direct meta structure (fallback)
                        # Check meta.authority exists and is non-empty (any string value)
                        if (-not $hasAuthority -and $metaObj.authority -and -not [string]::IsNullOrWhiteSpace($metaObj.authority)) {
                            $hasAuthority = $true
                        }
                        # Check meta.remoteMetadataUsed == false
                        if (-not $hasRemoteMetadata -and $metaObj.remoteMetadataUsed -eq $false) {
                            $hasRemoteMetadata = $true
                        }
                    }
                }
            } catch {
                # JSON parsing failed, but we already tried regex above, so continue
            }
        }
        
        # Early exit if both found
        if ($hasAuthority -and $hasRemoteMetadata) {
            break
        }
    }
    
    return @{
        HasAuthority = $hasAuthority
        HasRemoteMetadata = $hasRemoteMetadata
        Pass = $hasAuthority -and $hasRemoteMetadata
        Skipped = $false
    }
}

function Ensure-SnapshotExists {
    param(
        [string]$InstanceId,
        [string]$InstanceRoot
    )
    
    $rollbackDir = Join-Path $InstanceRoot ".rollback"
    
    # Check for existing snapshots (newest first)
    if (Test-Path $rollbackDir) {
        $snapshots = Get-ChildItem -Path $rollbackDir -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending
        foreach ($snapshot in $snapshots) {
            # Prefer v1 manifest
            $v1ManifestPath = Join-Path $snapshot.FullName "snapshot.v1.json"
            $manifestPath = if (Test-Path $v1ManifestPath) { $v1ManifestPath } else { Join-Path $snapshot.FullName "snapshot.json" }
            if (Test-Path $manifestPath) {
                # Validate snapshot using validation script
                $snapshotId = Split-Path -Leaf $snapshot.FullName
                $validateResult = node scripts/validation/validate-snapshot.ts $snapshotId $InstanceId 2>&1
                $validateExitCode = $LASTEXITCODE
                
                if ($validateExitCode -eq 0) {
                    Write-Host "  Found valid snapshot: $snapshotId" -ForegroundColor Green
                    return @{ ok = $true; snapshotDir = $snapshot.FullName; manifestPath = $manifestPath; snapshotId = $snapshotId }
                } else {
                    Write-Host "  Skipping invalid snapshot: $snapshotId" -ForegroundColor Yellow
                    Write-VerboseOutput "    Validation output: $($validateResult -join "`n")"
                }
            }
        }
    }
    
    # No snapshot found, create one
    Write-Host "  No snapshot found. Creating snapshot..." -ForegroundColor Yellow
    try {
        $createResult = node scripts/create-snapshot-for-instance.cjs --instance $InstanceId 2>&1
        $createExitCode = $LASTEXITCODE
        
        if ($createExitCode -ne 0) {
            $errorMsg = "Failed to create snapshot (exit code: $createExitCode). Output: $($createResult -join "`n")"
            return @{ ok = $false; error = $errorMsg }
        }
        
        # Re-check for snapshots after creation (validate them)
        if (Test-Path $rollbackDir) {
            $snapshots = Get-ChildItem -Path $rollbackDir -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending
            foreach ($snapshot in $snapshots) {
                # Prefer v1 manifest
                $v1ManifestPath = Join-Path $snapshot.FullName "snapshot.v1.json"
                $manifestPath = if (Test-Path $v1ManifestPath) { $v1ManifestPath } else { Join-Path $snapshot.FullName "snapshot.json" }
                if (Test-Path $manifestPath) {
                    # Validate the newly created snapshot (manifest structure)
                    $snapshotId = Split-Path -Leaf $snapshot.FullName
                    $validateResult = node scripts/validation/validate-snapshot.ts $snapshotId $InstanceId 2>&1
                    $validateExitCode = $LASTEXITCODE
                    
                    if ($validateExitCode -eq 0) {
                        # Also validate that snapshot files exist
                        $validateFilesResult = node scripts/validation/validate-snapshot-files.ts --instance $InstanceId --snapshot $snapshotId 2>&1
                        $validateFilesExitCode = $LASTEXITCODE
                        
                        if ($validateFilesExitCode -eq 0) {
                            Write-Host "  Snapshot created and validated (manifest + files): $snapshotId" -ForegroundColor Green
                            return @{ ok = $true; snapshotDir = $snapshot.FullName; manifestPath = $manifestPath; snapshotId = $snapshotId }
                        } else {
                            Write-Host "  WARNING: Snapshot created but file validation failed: $snapshotId" -ForegroundColor Yellow
                            Write-VerboseOutput "    File validation output: $($validateFilesResult -join "`n")"
                        }
                    } else {
                        Write-Host "  WARNING: Snapshot created but manifest validation failed: $snapshotId" -ForegroundColor Yellow
                        Write-VerboseOutput "    Manifest validation output: $($validateResult -join "`n")"
                    }
                }
            }
        }
        
        return @{ ok = $false; error = "Snapshot creation completed but no valid snapshot found (manifest or files validation failed). Run validation manually to diagnose." }
    } catch {
        return @{ ok = $false; error = "Exception creating snapshot: $($_.Exception.Message)" }
    }
}

function Run-Scenario {
    param(
        [string]$ScenarioName,
        [string]$ScenarioDir,
        [string]$InstanceRoot,
        [string]$LogFile,
        [scriptblock]$SetupScript,
        [scriptblock]$TestScript,
        [scriptblock]$CleanupScript,
        [int]$ExpectedExitCode = 0  # 0 = success expected, 1 = failure expected (safe failure)
    )
    
    Write-Host "`n=== Scenario: $ScenarioName ===" -ForegroundColor Cyan
    
    $consoleOutput = @()
    $consoleOutput += "Scenario: $ScenarioName"
    $consoleOutput += "Started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    $consoleOutput += ""
    
    # Create scenario-local log file
    $scenarioLogFile = Join-Path $ScenarioDir "rollback.ndjson"
    Write-VerboseOutput "Creating scenario-local log file: $scenarioLogFile"
    # Ensure file exists (empty) so rollback can append to it
    "" | Out-File -FilePath $scenarioLogFile -Encoding UTF8 -NoNewline
    
    # Capture pre-state
    Write-VerboseOutput "Capturing pre-state..."
    $lockfilePath = Join-Path $InstanceRoot "pack\lock.json"
    $manifestPath = Find-ManifestFile -InstanceRoot $InstanceRoot
    
    $preHashes = @{
        lockfile = Get-SHA256Hash -FilePath $lockfilePath
        manifest = Get-SHA256Hash -FilePath $manifestPath
        manifestPath = if ($manifestPath) { $manifestPath } else { "missing" }
    }
    $preHashes | ConvertTo-Json | Out-File -FilePath (Join-Path $ScenarioDir "pre-hashes.txt") -Encoding UTF8
    
    Capture-DirectoryTree -Path $InstanceRoot -OutputFile (Join-Path $ScenarioDir "dir-tree-before.txt")
    
    # Setup
    $setupError = $null
    try {
        Write-VerboseOutput "Running setup..."
        & $SetupScript
    } catch {
        $setupError = $_.Exception.Message
        $consoleOutput += "Setup error: $setupError"
    }
    
    # Run test (pass scenario log file path to scriptblock)
    $script:currentScenarioLogFile = $scenarioLogFile
    $testExitCode = 0
    $testOutput = ""
    $rollbackExecuted = $false
    if (-not $setupError) {
        try {
            Write-VerboseOutput "Running test..."
            $testResult = & $TestScript 2>&1
            $testOutput = $testResult | Out-String
            $testExitCode = $LASTEXITCODE
            $consoleOutput += $testOutput
            
            # Check console output for indicators that rollback didn't actually run
            # Look for messages like "no snapshots found", "rollback directory does not exist", etc.
            # If these are found, rollback refused to run and we should skip metadata check
            $noSnapshotsPatterns = @(
                "no snapshots found",
                "rollback directory does not exist",
                "missing manifest file",
                "no snapshot"
            )
            $rollbackRefused = $false
            foreach ($pattern in $noSnapshotsPatterns) {
                if ($testOutput -match $pattern -or $consoleOutput -match $pattern) {
                    $rollbackRefused = $true
                    Write-VerboseOutput "Detected rollback refusal pattern: $pattern - rollback did not execute"
                    break
                }
            }
            
            # Rollback executed if it didn't refuse (even if it failed later)
            # If rollback refused due to missing snapshots, it didn't actually execute
            $rollbackExecuted = -not $rollbackRefused
        } catch {
            $testExitCode = 1
            $testOutput = $_.Exception.Message
            $consoleOutput += "Test error: $testOutput"
        }
    } else {
        # Setup failed, so rollback never executed
        $testExitCode = 1
        $rollbackExecuted = $false
    }
    
    # Wait a bit for logs to flush
    Start-Sleep -Seconds 1
    
    # Determine which log file to use (prefer scenario-local)
    $actualLogFile = if (Test-Path $scenarioLogFile) { $scenarioLogFile } else { $LogFile }
    Write-VerboseOutput "Using log file: $(if ($actualLogFile) { $actualLogFile } else { 'not found' })"
    
    # Capture post-state
    Write-VerboseOutput "Capturing post-state..."
    $postHashes = @{
        lockfile = Get-SHA256Hash -FilePath $lockfilePath
        manifest = Get-SHA256Hash -FilePath $manifestPath
        manifestPath = if ($manifestPath) { $manifestPath } else { "missing" }
    }
    $postHashes | ConvertTo-Json | Out-File -FilePath (Join-Path $ScenarioDir "post-hashes.txt") -Encoding UTF8
    
    Capture-DirectoryTree -Path $InstanceRoot -OutputFile (Join-Path $ScenarioDir "dir-tree-after.txt")
    
    # Capture directory listings
    $quarantineDir = Join-Path $InstanceRoot ".quarantine"
    $stagingDir = Join-Path $InstanceRoot ".staging"
    $rollbackDir = Join-Path $InstanceRoot ".rollback"
    
    Capture-DirectoryListing -Path $quarantineDir -OutputFile (Join-Path $ScenarioDir "quarantine-list.txt")
    Capture-DirectoryListing -Path $stagingDir -OutputFile (Join-Path $ScenarioDir "staging-list.txt")
    Capture-DirectoryListing -Path $rollbackDir -OutputFile (Join-Path $ScenarioDir "rollback-list.txt")
    
    # Extract logs (prefer scenario-local log file, fallback to console output)
    $logExtract = @()
    $logExtractSource = "none"
    if (-not [string]::IsNullOrEmpty($actualLogFile) -and (Test-Path $actualLogFile)) {
        $fileContent = Get-Content $actualLogFile -ErrorAction SilentlyContinue
        if ($fileContent -and $fileContent.Count -gt 0) {
            Write-VerboseOutput "Extracting logs from: $actualLogFile"
            $logExtract = Extract-RollbackLogs -LogFile $actualLogFile -OutputFile (Join-Path $ScenarioDir "rollback-log-extract.txt")
            $logExtractSource = "logfile"
        }
    }
    
    # If log file is empty or missing, try extracting from console output
    if ($logExtract.Count -eq 0 -and $consoleOutput.Count -gt 0) {
        Write-VerboseOutput "Log file empty or missing, extracting from console output"
        # Extract JSON log lines from console output
        $consoleLogLines = @()
        foreach ($line in $consoleOutput) {
            if ($line -match '^\s*\{.*"area"\s*:\s*"install\.rollback"') {
                $consoleLogLines += $line
            } elseif ($line -match '"authority"\s*:\s*"[^"]+"') {
                $consoleLogLines += $line
            } elseif ($line -match '"remoteMetadataUsed"\s*:\s*(true|false)') {
                $consoleLogLines += $line
            }
        }
        if ($consoleLogLines.Count -gt 0) {
            $logExtract = $consoleLogLines
            $logExtractSource = "console"
            Write-VerboseOutput "Extracted $($consoleLogLines.Count) log lines from console output"
        }
    }
    
    # Write extracted logs to file
    if ($logExtract.Count -gt 0) {
        $logExtract | Out-File -FilePath (Join-Path $ScenarioDir "rollback-log-extract.txt") -Encoding UTF8
    } else {
        $logNotFoundMsg = "No log entries found. Checked:"
        if ($scenarioLogFile) { $logNotFoundMsg += " scenario-local=$scenarioLogFile" }
        if ($LogFile) { $logNotFoundMsg += " instance-logs=$LogFile" }
        $logNotFoundMsg += " console output"
        $logNotFoundMsg | Out-File -FilePath (Join-Path $ScenarioDir "rollback-log-extract.txt") -Encoding UTF8
        Write-VerboseOutput "WARNING: $logNotFoundMsg"
    }
    
    $metadataCheck = Assert-LogMetadata -LogLines $logExtract -ScenarioName $ScenarioName -RollbackExecuted $rollbackExecuted
    
    # If rollback executed but log is missing and we couldn't extract from console, fail the scenario
    if ($rollbackExecuted -and $logExtract.Count -eq 0) {
        $metadataCheck.Pass = $false
        $metadataCheck.LogMissing = $true
        Write-VerboseOutput "WARNING: Rollback executed but no log entries found in log file or console output"
    }
    
    # Cleanup
    $cleanupError = $null
    try {
        Write-VerboseOutput "Running cleanup..."
        & $CleanupScript
    } catch {
        $cleanupError = $_.Exception.Message
        $consoleOutput += "Cleanup error: $cleanupError"
    }
    
    # Save console output
    $consoleOutput += ""
    $consoleOutput += "Ended: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    $consoleOutput += "Exit code: $testExitCode"
    $consoleOutput | Out-File -FilePath (Join-Path $ScenarioDir "console.txt") -Encoding UTF8
    
    # Determine pass/fail
    # If setup failed, scenario fails regardless of test exit code
    if ($setupError) {
        $passed = $false
        $testExitCode = 1  # Ensure non-zero exit code when setup fails
    } else {
        # Setup succeeded, check test exit code, metadata, and artifact restoration
        $metadataPass = $metadataCheck.Pass
        $artifactPass = $true  # Default to pass if no artifact check
        if ($artifactRestored -ne $null) {
            $artifactPass = $artifactRestored
            if (-not $artifactRestored) {
                $consoleOutput += "Artifact restoration verification: FAILED (SHA256 mismatch after rollback)"
            }
        }
        
        # If rollback executed but logs cannot be located, fail the scenario with explicit reason
        $logAvailable = -not [string]::IsNullOrEmpty($actualLogFile) -and (Test-Path $actualLogFile)
        if ($rollbackExecuted -and -not $logAvailable) {
            $consoleOutput += "cannot verify rollback metadata because log not found"
            $metadataPass = $false
        }
        
        # Check if exit code matches expected outcome
        $exitCodeMatches = ($testExitCode -eq $ExpectedExitCode)
        
        # For negative scenarios (ExpectedExitCode = 1), verify safe failure:
        # - lockfile unchanged
        # - manifest unchanged
        # - no partial writes (rollback directory restored correctly)
        $safeFailure = $true
        if ($ExpectedExitCode -eq 1) {
            # Negative scenario: must fail safely
            $lockfileUnchanged = ($preHashes.lockfile -eq $postHashes.lockfile)
            $manifestUnchanged = ($preHashes.manifest -eq $postHashes.manifest)
            
            # Check for partial writes: staging should be clean (rollback staging should be removed on failure)
            $rollbackStagingExists = $false
            if (Test-Path $stagingDir) {
                $rollbackStagingDirs = Get-ChildItem -Path $stagingDir -Directory -ErrorAction SilentlyContinue | 
                    Where-Object { $_.Name -eq "rollback" }
                if ($rollbackStagingDirs) {
                    $rollbackStagingExists = $true
                }
            }
            
            $safeFailure = $lockfileUnchanged -and $manifestUnchanged -and (-not $rollbackStagingExists)
            
            if (-not $safeFailure) {
                $consoleOutput += "Safe failure check:"
                $consoleOutput += "  Lockfile unchanged: $lockfileUnchanged"
                $consoleOutput += "  Manifest unchanged: $manifestUnchanged"
                $consoleOutput += "  No partial writes (rollback staging cleaned): $(-not $rollbackStagingExists)"
            }
        }
        
        # Pass if: exit code matches expected AND (success scenario OR safe failure) AND metadata pass AND artifact pass
        $passed = $exitCodeMatches -and $safeFailure -and $metadataPass -and $artifactPass
    }
    
    # Create summary
    # Get artifact info if available (for Happy Path scenario)
    $artifactInfo = $null
    $artifactRestored = $null
    if ($script:scenarioBackups.ContainsKey("scenario01")) {
        $backup = $script:scenarioBackups["scenario01"]
        $artifactInfo = @{
            name = if ($backup.artifactName) { $backup.artifactName } else { "unknown" }
            path = $backup.artifactPath
            size = if ($backup.artifactSize) { $backup.artifactSize } else { 0 }
            originalHash = if ($backup.originalHash) { $backup.originalHash } else { "unknown" }
            corruptedHash = if ($backup.corruptedHash) { $backup.corruptedHash } else { "unknown" }
            restoredHash = if ($backup.restoredHash) { $backup.restoredHash } else { "unknown" }
            source = if ($backup.source) { $backup.source } else { "unknown" }
            snapshotId = if ($backup.snapshotId) { $backup.snapshotId } else { "unknown" }
        }
        $artifactRestored = if ($backup.wasRestored -ne $null) { $backup.wasRestored } else { $null }
    }
    
    $summary = @{
        scenario = $ScenarioName
        passed = $passed
        exitCode = $testExitCode
        setupError = if ($setupError) { $setupError } else { $null }
        cleanupError = if ($cleanupError) { $cleanupError } else { $null }
        lockfileChanged = $preHashes.lockfile -ne $postHashes.lockfile
        manifestChanged = $preHashes.manifest -ne $postHashes.manifest
        logMetadata = @{
            hasAuthority = $metadataCheck.HasAuthority
            hasRemoteMetadata = $metadataCheck.HasRemoteMetadata
            pass = $metadataCheck.Pass
            skipped = $metadataCheck.Skipped
        }
        paths = @{
            lockfile = $lockfilePath
            manifest = if ($manifestPath) { $manifestPath } else { "missing" }
            logFile = if ($actualLogFile) { $actualLogFile } else { "not found" }
            scenarioLogFile = if ($scenarioLogFile) { $scenarioLogFile } else { "not created" }
        }
        artifact = $artifactInfo
        artifactRestored = $artifactRestored
    }
    
    $summary | ConvertTo-Json -Depth 10 | Out-File -FilePath (Join-Path $ScenarioDir "summary.json") -Encoding UTF8
    
    # Create human-readable summary
    # Use UTF-8 compatible emoji encoding
    $passEmoji = [char]0x2705  # ✅
    $failEmoji = [char]0x274C  # ❌
    
    $statusText = if ($passed) { "$passEmoji PASS" } else { "$failEmoji FAIL" }
    $lockfileChanged = if ($preHashes.lockfile -ne $postHashes.lockfile) { "$failEmoji YES (should not change)" } else { "$passEmoji NO" }
    $manifestChanged = if ($preHashes.manifest -ne $postHashes.manifest) { "$failEmoji YES (should not change)" } else { "$passEmoji NO" }
    
    if ($metadataCheck.Skipped) {
        $hasAuthority = "SKIPPED (rollback not executed)"
        $hasRemoteMetadata = "SKIPPED (rollback not executed)"
    } else {
        $hasAuthority = if ($metadataCheck.HasAuthority) { "$passEmoji Found" } else { "$failEmoji Missing" }
        $hasRemoteMetadata = if ($metadataCheck.HasRemoteMetadata) { "$passEmoji Found" } else { "$failEmoji Missing" }
    }
    $startedTime = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    
    $errorLines = @()
    if ($setupError) { $errorLines += "- Setup: $setupError" }
    if ($cleanupError) { $errorLines += "- Cleanup: $cleanupError" }
    $errorSection = if ($errorLines.Count -gt 0) { ($errorLines -join [Environment]::NewLine) + [Environment]::NewLine } else { "" }
    
    # Artifact restoration status (for Happy Path scenario)
    $artifactRestoredText = ""
    if ($artifactInfo -and $artifactRestored -ne $null) {
        $artifactRestoredStatus = if ($artifactRestored) { "$passEmoji YES (SHA256 matches original)" } else { "$failEmoji NO (SHA256 mismatch)" }
        $artifactRestoredText = "- Artifact restored: $artifactRestoredStatus" + [Environment]::NewLine +
            "  - Path: ``$($artifactInfo.path)``" + [Environment]::NewLine +
            "  - Source: $($artifactInfo.source)" + [Environment]::NewLine +
            "  - Original SHA256: ``$($artifactInfo.originalHash.Substring(0, 16))...``" + [Environment]::NewLine +
            "  - Restored SHA256: ``$($artifactInfo.restoredHash.Substring(0, 16))...``" + [Environment]::NewLine
    }
    
    $summaryMd = "# Scenario: $ScenarioName" + [Environment]::NewLine + [Environment]::NewLine +
        "**Status**: $statusText" + [Environment]::NewLine +
        "**Exit Code**: $testExitCode" + [Environment]::NewLine +
        "**Started**: $startedTime" + [Environment]::NewLine + [Environment]::NewLine +
        "## Results" + [Environment]::NewLine + [Environment]::NewLine +
        "- Lockfile changed: $lockfileChanged" + [Environment]::NewLine +
        "- Manifest changed: $manifestChanged" + [Environment]::NewLine +
        "- Log metadata authority: $hasAuthority" + [Environment]::NewLine +
        "- Log metadata remoteMetadataUsed: $hasRemoteMetadata" + [Environment]::NewLine
    if ($artifactRestoredText) {
        $summaryMd += [Environment]::NewLine + $artifactRestoredText
    }
    $summaryMd += [Environment]::NewLine + "## Errors" + [Environment]::NewLine + [Environment]::NewLine +
        $errorSection +
        "## Files" + [Environment]::NewLine + [Environment]::NewLine +
        "- Console output: ``console.txt``" + [Environment]::NewLine +
        "- Log extract: ``rollback-log-extract.txt``" + [Environment]::NewLine +
        "- Pre-hashes: ``pre-hashes.txt``" + [Environment]::NewLine +
        "- Post-hashes: ``post-hashes.txt``" + [Environment]::NewLine +
        "- Directory trees: ``dir-tree-before.txt``, ``dir-tree-after.txt``" + [Environment]::NewLine +
        "- Directory listings: ``quarantine-list.txt``, ``staging-list.txt``, ``rollback-list.txt``"
    
    # Write with UTF-8 encoding (no BOM for better compatibility)
    [System.IO.File]::WriteAllText((Join-Path $ScenarioDir "summary.md"), $summaryMd, [System.Text.UTF8Encoding]::new($false))
    
    $passEmoji = [char]0x2705
    $failEmoji = [char]0x274C
    Write-Host "  Status: $(if ($passed) { "$passEmoji PASS" } else { "$failEmoji FAIL" })" -ForegroundColor $(if ($passed) { "Green" } else { "Red" })
    
    return @{
        Name = $ScenarioName
        Passed = $passed
        ExitCode = $testExitCode
        Summary = $summary
    }
}

# Main execution
Write-Host "=== Rollback Evidence Collection ===" -ForegroundColor Cyan
Write-Host "Instance: $InstanceId" -ForegroundColor White
if ($SnapshotId) {
    Write-Host "Snapshot: $SnapshotId" -ForegroundColor White
} else {
    Write-Host "Snapshot: latest (auto-select)" -ForegroundColor White
}
Write-Host ""

# Setup paths
$appData = $env:APPDATA
$instanceRoot = Join-Path $appData "MineAnvil\instances\$InstanceId"
$logsDir = Join-Path $instanceRoot "logs"
$lockfilePath = Join-Path $instanceRoot "pack\lock.json"
$rollbackDir = Join-Path $instanceRoot ".rollback"

# Find log file (fallback for scenarios that don't create local logs)
if ([string]::IsNullOrEmpty($LogPath)) {
    # Explicitly check for mineanvil-main.log first (required path)
    $mainLogPath = Join-Path $logsDir "mineanvil-main.log"
    
    Write-VerboseOutput "Searching for log files in: $logsDir"
    Write-VerboseOutput "Checking for main log at: $mainLogPath"
    
    # Test the path - this should always work if the file exists
    $fileExists = Test-Path $mainLogPath
    Write-VerboseOutput "Test-Path result for $mainLogPath : $fileExists"
    
    if ($fileExists) {
        $LogPath = $mainLogPath
        Write-VerboseOutput "Found mineanvil-main.log at: $mainLogPath"
        # Verify it was set
        Write-VerboseOutput "LogPath after assignment: $LogPath"
    } else {
        Write-VerboseOutput "mineanvil-main.log not found at: $mainLogPath"
        Write-VerboseOutput "Logs directory exists: $(Test-Path $logsDir)"
        if ($ShowVerbose) {
            Write-Host "  mineanvil-main.log not found at: $mainLogPath" -ForegroundColor Gray
            Write-Host "  Logs directory exists: $(Test-Path $logsDir)" -ForegroundColor Gray
            if (Test-Path $logsDir) {
                $logFiles = Get-ChildItem -Path $logsDir -ErrorAction SilentlyContinue
                Write-Host "  Files in logs directory: $($logFiles.Count)" -ForegroundColor Gray
                $logFiles | ForEach-Object {
                    Write-Host "    - $($_.Name)" -ForegroundColor Gray
                }
            }
        }
        # Try the search function as fallback
        $LogPath = Find-MostRecentLogFile -LogsDir $logsDir -InstanceId $InstanceId
        if ([string]::IsNullOrEmpty($LogPath)) {
            Write-Host "WARNING: No instance log file found. Scenarios will use local log files." -ForegroundColor Yellow
            if ($ShowVerbose) {
                Write-Host "  Logs directory path checked: $logsDir" -ForegroundColor Gray
            }
        } else {
            Write-VerboseOutput "Found log file via search: $LogPath"
            if ($ShowVerbose) {
                Write-Host "  Found log file via search: $LogPath" -ForegroundColor Gray
            }
        }
    }
} else {
    Write-VerboseOutput "LogPath already set to: $LogPath"
}

Write-Host "Instance root: $instanceRoot" -ForegroundColor Gray
Write-Host "Log file: $(if ($LogPath) { $LogPath } else { "not found" })" -ForegroundColor Gray
Write-Host ""

# Create evidence directory
$timestamp = $null
if ([string]::IsNullOrEmpty($EvidenceDir)) {
    # Generate timestamp if not provided
    $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $evidenceRoot = Join-Path (Get-Location) "prompts\02-evidence\L2\sp2.3-rollback-execution\$timestamp"
    New-Item -ItemType Directory -Path $evidenceRoot -Force | Out-Null
} else {
    # Use provided evidence directory
    $evidenceRoot = $EvidenceDir
    # Ensure it exists
    if (-not (Test-Path $evidenceRoot)) {
        New-Item -ItemType Directory -Path $evidenceRoot -Force | Out-Null
    }
    # Extract timestamp from path (last directory name should be timestamp)
    $dirName = Split-Path -Leaf $evidenceRoot
    if ($dirName -match '^\d{8}-\d{6}$') {
        $timestamp = $dirName
    } else {
        # Fallback to current timestamp if can't extract from path
        $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    }
}

Write-Host "Evidence directory: $evidenceRoot" -ForegroundColor Yellow
Write-Host ""

# Verify prerequisites
if (-not (Test-Path $instanceRoot)) {
    Write-Host "ERROR: Instance root does not exist: $instanceRoot" -ForegroundColor Red
    exit 1
}

# Scenario state backups (shared across scenarios)
$script:scenarioBackups = @{}

# Scenario 01: Happy path
$scenario01Dir = Join-Path $evidenceRoot "scenario-01-happy"
New-Item -ItemType Directory -Path $scenario01Dir -Force | Out-Null

$scenario01Result = Run-Scenario -ScenarioName "Happy Path" -ScenarioDir $scenario01Dir -InstanceRoot $instanceRoot -LogFile $LogPath `
    -SetupScript {
        # Validate instance root exists
        if (-not (Test-Path $instanceRoot)) {
            throw "Instance root does not exist: $instanceRoot. Create instance first or use correct InstanceId."
        }
        
        # Ensure snapshot exists
        $snapshotResult = Ensure-SnapshotExists -InstanceId $InstanceId -InstanceRoot $instanceRoot
        if (-not $snapshotResult.ok) {
            throw "Failed to ensure snapshot exists: $($snapshotResult.error). Next steps: Run 'node scripts/create-snapshot-for-instance.ts --instance $InstanceId' manually."
        }
        
        # Load snapshot manifest
        $manifestPath = $snapshotResult.manifestPath
        $snapshotDir = $snapshotResult.snapshotDir
        $manifest = Get-Content $manifestPath | ConvertFrom-Json
        
        # Extract version from snapshot ID (format: <timestamp>-<version>) or from manifest
        $snapshotId = Split-Path -Leaf $snapshotDir
        $version = $null
        if ($snapshotId -match '-(\d+\.\d+\.\d+)$') {
            $version = $matches[1]
        } elseif ($manifest.minecraftVersion) {
            $version = $manifest.minecraftVersion
        }
        
        # Find a valid artifact file to corrupt using deterministic fallback chain
        $script:selectedPath = $null
        $script:selectedSource = $null
        
        # Helper function to validate and select a file path
        function Test-AndSelectFile {
            param([string]$Path, [string]$Source)
            if ([string]::IsNullOrWhiteSpace($Path)) { return $false }
            if (-not (Test-Path $Path)) { return $false }
            $item = Get-Item $Path -ErrorAction SilentlyContinue
            if ($null -eq $item) { return $false }
            if ($item.PSIsContainer) { return $false }
            if ($Path -eq $instanceRoot) { return $false }
            $script:selectedPath = $Path
            $script:selectedSource = $Source
            return $true
        }
        
        # Fallback A: Try common client jar paths
        if ($version) {
            $clientJarCandidates = @(
                Join-Path $instanceRoot ".minecraft\versions\$version\$version.jar"
                Join-Path $instanceRoot ".minecraft\versions\$version\client.jar"
                Join-Path $instanceRoot ".minecraft\client.jar"
                Join-Path $instanceRoot "pack\versions\$version\$version.jar"
                Join-Path $instanceRoot "pack\versions\$version\client.jar"
                Join-Path $instanceRoot "pack\client.jar"
            )
            foreach ($candidate in $clientJarCandidates) {
                if (Test-AndSelectFile -Path $candidate -Source "client_jar_candidate") {
                    break
                }
            }
        }
        
        # Fallback B: Try library jars
        if (-not $script:selectedPath) {
            $librariesDir = Join-Path $instanceRoot ".minecraft\libraries"
            if (Test-Path $librariesDir) {
                $libraryJars = Get-ChildItem -Path $librariesDir -Filter "*.jar" -Recurse -File -ErrorAction SilentlyContinue | 
                    Sort-Object FullName | 
                    Select-Object -First 1
                if ($libraryJars) {
                    Test-AndSelectFile -Path $libraryJars.FullName -Source "library_jar"
                }
            }
        }
        
        # Fallback C: Try asset index json
        if (-not $script:selectedPath) {
            $assetIndexesDir = Join-Path $instanceRoot ".minecraft\assets\indexes"
            if (Test-Path $assetIndexesDir) {
                $assetIndexFiles = Get-ChildItem -Path $assetIndexesDir -Filter "*.json" -File -ErrorAction SilentlyContinue | 
                    Sort-Object Name | 
                    Select-Object -First 1
                if ($assetIndexFiles) {
                    Test-AndSelectFile -Path $assetIndexFiles.FullName -Source "asset_index"
                }
            }
        }
        
        # Fallback D: Try snapshot manifest entries with both base resolutions
        if (-not $script:selectedPath -and $manifest.artifacts -and $manifest.artifacts.Count -gt 0) {
            foreach ($artifact in $manifest.artifacts) {
                if ([string]::IsNullOrWhiteSpace($artifact.relativePath)) {
                    continue
                }
                
                # Try instance root base
                $candidate1 = Join-Path $instanceRoot $artifact.relativePath
                $candidate1 = $candidate1 -replace '/', '\'
                if (Test-AndSelectFile -Path $candidate1 -Source "snapshot_manifest_instance") {
                    break
                }
                
                # Try snapshot root base
                $candidate2 = Join-Path $snapshotDir $artifact.relativePath
                $candidate2 = $candidate2 -replace '/', '\'
                if (Test-AndSelectFile -Path $candidate2 -Source "snapshot_manifest_snapshot") {
                    break
                }
            }
        }
        
        # If still no file found, fail with clear message
        if (-not $script:selectedPath) {
            $packDir = Join-Path $instanceRoot "pack"
            $mcDir = Join-Path $instanceRoot ".minecraft"
            $packContents = if (Test-Path $packDir) { 
                Get-ChildItem -Path $packDir -Recurse -File -ErrorAction SilentlyContinue | 
                    Select-Object -First 10 | 
                    ForEach-Object { $_.FullName.Replace($instanceRoot, "...") }
            } else { @() }
            $mcContents = if (Test-Path $mcDir) { 
                Get-ChildItem -Path $mcDir -Recurse -File -ErrorAction SilentlyContinue | 
                    Select-Object -First 10 | 
                    ForEach-Object { $_.FullName.Replace($instanceRoot, "...") }
            } else { @() }
            
            $errorMsg = "No candidate live artifacts found. Install may not have run or pack layout differs.`n"
            $errorMsg += "Instance root: $instanceRoot`n"
            $errorMsg += "Version guessed: $(if ($version) { $version } else { 'unknown' })`n"
            $errorMsg += "Pack directory exists: $(Test-Path $packDir)`n"
            $errorMsg += ".minecraft directory exists: $(Test-Path $mcDir)`n"
            if ($packContents.Count -gt 0) {
                $errorMsg += "Sample pack files:`n" + ($packContents -join "`n")
            }
            if ($mcContents.Count -gt 0) {
                $errorMsg += "`nSample .minecraft files:`n" + ($mcContents -join "`n")
            }
            throw $errorMsg
        }
        
        # Final validation before reading bytes
        $selectedPath = $script:selectedPath
        $selectedSource = $script:selectedSource
        $fileInfo = Get-Item $selectedPath
        if ($fileInfo.PSIsContainer) {
            throw "Selected artifact path is a directory, not a file: $selectedPath"
        }
        if ($selectedPath -eq $instanceRoot) {
            throw "Selected artifact path equals instance root (invalid): $selectedPath"
        }
        
        # Get SHA256 before corruption
        $originalHash = Get-FileHash -Path $selectedPath -Algorithm SHA256
        $originalHashValue = $originalHash.Hash
        
        # Backup original bytes before corrupting
        $originalBytes = [System.IO.File]::ReadAllBytes($selectedPath)
        $originalSize = $originalBytes.Length
        
        # Corrupt artifact: flip a byte in the middle (safer than first byte)
        $bytes = $originalBytes.Clone()
        $corruptIndex = [Math]::Floor($bytes.Length / 2)
        if ($corruptIndex -ge $bytes.Length) { $corruptIndex = 0 }
        # Flip all bits using XOR with 0xFF
        $bytes[$corruptIndex] = $bytes[$corruptIndex] -bxor 0xFF
        
        [System.IO.File]::WriteAllBytes($selectedPath, $bytes)
        
        # Get SHA256 after corruption
        $corruptedHash = Get-FileHash -Path $selectedPath -Algorithm SHA256
        $corruptedHashValue = $corruptedHash.Hash
        
        # Store snapshot ID for rollback command (use from result if available, otherwise extract from path)
        $snapshotIdForRollback = if ($snapshotResult.snapshotId) { $snapshotResult.snapshotId } else { Split-Path -Leaf $snapshotDir }
        
        $script:scenarioBackups["scenario01"] = @{
            artifactPath = $selectedPath
            artifactName = Split-Path -Leaf $selectedPath
            artifactSize = $originalSize
            originalBytes = $originalBytes
            originalHash = $originalHashValue
            corruptedHash = $corruptedHashValue
            snapshotId = $snapshotIdForRollback
            source = $selectedSource
        }
        
        Write-Host "  Corrupted artifact: $(Split-Path -Leaf $selectedPath)" -ForegroundColor Yellow
        Write-Host "    Path: $selectedPath" -ForegroundColor Gray
        Write-Host "    Size: $originalSize bytes" -ForegroundColor Gray
        Write-Host "    Source: $selectedSource" -ForegroundColor Gray
        Write-Host "    Original SHA256: $($originalHashValue.Substring(0, 16))..." -ForegroundColor Gray
    } `
    -TestScript {
        # Run rollback script with specific snapshot ID and log path
        $backup = $script:scenarioBackups["scenario01"]
        $snapshotId = $backup.snapshotId
        $logPath = $script:currentScenarioLogFile
        if ($logPath) {
            node scripts\run-rollback.ts --instance $InstanceId --snapshot $snapshotId --verbose --logPath $logPath 2>&1
        } else {
            node scripts\run-rollback.ts --instance $InstanceId --snapshot $snapshotId --verbose 2>&1
        }
    } `
    -CleanupScript {
        # Verify the corrupted file was restored by rollback
        if ($script:scenarioBackups.ContainsKey("scenario01")) {
            $backup = $script:scenarioBackups["scenario01"]
            if (Test-Path $backup.artifactPath) {
                # Get current SHA256 after rollback
                $currentHash = Get-FileHash -Path $backup.artifactPath -Algorithm SHA256
                $currentHashValue = $currentHash.Hash
                
                # Compare to original hash
                if ($currentHashValue -eq $backup.originalHash) {
                    Write-Host "  ✅ Artifact was restored by rollback (SHA256 matches original)" -ForegroundColor Green
                } else {
                    Write-Host "  ⚠️  Artifact SHA256 does not match original after rollback" -ForegroundColor Yellow
                    Write-Host "    Original: $($backup.originalHash.Substring(0, 16))..." -ForegroundColor Gray
                    Write-Host "    Current:  $($currentHashValue.Substring(0, 16))..." -ForegroundColor Gray
                    
                    # Restore from backup if still corrupted
                    if ($currentHashValue -eq $backup.corruptedHash) {
                        Write-Host "  Restoring artifact from backup (rollback did not restore it)" -ForegroundColor Yellow
                        [System.IO.File]::WriteAllBytes($backup.artifactPath, $backup.originalBytes)
                    }
                }
                
                # Store verification result in backup
                $backup.restoredHash = $currentHashValue
                $backup.wasRestored = ($currentHashValue -eq $backup.originalHash)
            }
        }
    }

# Scenario 02: No snapshots
$scenario02Dir = Join-Path $evidenceRoot "scenario-02-no-snapshots"
New-Item -ItemType Directory -Path $scenario02Dir -Force | Out-Null

$scenario02Result = Run-Scenario -ScenarioName "No Snapshots" -ScenarioDir $scenario02Dir -InstanceRoot $instanceRoot -LogFile $LogPath -ExpectedExitCode 1 `
    -SetupScript {
        # Backup and move rollback directory
        if (Test-Path $rollbackDir) {
            $backupName = ".rollback__disabled_$timestamp"
            $backupPath = Join-Path $instanceRoot $backupName
            Move-Item -Path $rollbackDir -Destination $backupPath -Force
            $script:scenarioBackups["scenario02"] = $backupPath
            Write-Host "  Moved rollback directory to: $backupName" -ForegroundColor Yellow
        }
    } `
    -TestScript {
        # Run rollback script (electron should be compiled by orchestrator)
        $logPath = $script:currentScenarioLogFile
        if ($logPath) {
            node scripts\run-rollback.ts --instance $InstanceId --verbose --logPath $logPath 2>&1
        } else {
            node scripts\run-rollback.ts --instance $InstanceId --verbose 2>&1
        }
    } `
    -CleanupScript {
        # Restore rollback directory
        if ($script:scenarioBackups.ContainsKey("scenario02")) {
            $backupPath = $script:scenarioBackups["scenario02"]
            if (Test-Path $backupPath) {
                Move-Item -Path $backupPath -Destination $rollbackDir -Force
                Write-Host "  Restored rollback directory" -ForegroundColor Gray
            }
        }
    }

# Scenario 03: Corrupt snapshot manifest
$scenario03Dir = Join-Path $evidenceRoot "scenario-03-corrupt-snapshot-manifest"
New-Item -ItemType Directory -Path $scenario03Dir -Force | Out-Null

$scenario03Result = Run-Scenario -ScenarioName "Corrupt Snapshot Manifest" -ScenarioDir $scenario03Dir -InstanceRoot $instanceRoot -LogFile $LogPath -ExpectedExitCode 1 `
    -SetupScript {
        # Find latest snapshot and corrupt manifest
        if (Test-Path $rollbackDir) {
            $snapshots = Get-ChildItem -Path $rollbackDir -Directory -ErrorAction SilentlyContinue
            if ($snapshots.Count -gt 0) {
                $latestSnapshot = $snapshots | Sort-Object Name -Descending | Select-Object -First 1
                $manifestPath = Join-Path $latestSnapshot.FullName "snapshot.json"
                if (Test-Path $manifestPath) {
                    # Backup and corrupt
                    $backupPath = "$manifestPath.backup"
                    if (Test-Path $backupPath) {
                        Remove-Item -Path $backupPath -Force -ErrorAction SilentlyContinue
                    }
                    Copy-Item -Path $manifestPath -Destination $backupPath -Force
                    $content = Get-Content $manifestPath -Raw
                    $corrupted = $content.Substring(0, [Math]::Min(100, $content.Length))
                    Set-Content -Path $manifestPath -Value $corrupted
                    $script:scenarioBackups["scenario03"] = $backupPath
                    Write-Host "  Corrupted snapshot manifest: $($latestSnapshot.Name)" -ForegroundColor Yellow
                }
            }
        }
    } `
    -TestScript {
        # Run rollback script (electron should be compiled by orchestrator)
        $logPath = $script:currentScenarioLogFile
        if ($logPath) {
            node scripts\run-rollback.ts --instance $InstanceId --verbose --logPath $logPath 2>&1
        } else {
            node scripts\run-rollback.ts --instance $InstanceId --verbose 2>&1
        }
    } `
    -CleanupScript {
        # Restore manifest
        if ($script:scenarioBackups.ContainsKey("scenario03")) {
            $backupPath = $script:scenarioBackups["scenario03"]
            $manifestPath = $backupPath -replace '\.backup$', ''
            if (Test-Path $backupPath) {
                if (Test-Path $manifestPath) {
                    Remove-Item -Path $manifestPath -Force -ErrorAction SilentlyContinue
                }
                Copy-Item -Path $backupPath -Destination $manifestPath -Force
                Remove-Item -Path $backupPath -Force -ErrorAction SilentlyContinue
                Write-Host "  Restored snapshot manifest" -ForegroundColor Gray
            }
        }
    }

# Scenario 04: Snapshot checksum mismatch
$scenario04Dir = Join-Path $evidenceRoot "scenario-04-snapshot-checksum-mismatch"
New-Item -ItemType Directory -Path $scenario04Dir -Force | Out-Null

$scenario04Result = Run-Scenario -ScenarioName "Snapshot Checksum Mismatch" -ScenarioDir $scenario04Dir -InstanceRoot $instanceRoot -LogFile $LogPath -ExpectedExitCode 1 `
    -SetupScript {
        # Find latest snapshot and corrupt an artifact file
        if (Test-Path $rollbackDir) {
            $snapshots = Get-ChildItem -Path $rollbackDir -Directory -ErrorAction SilentlyContinue
            if ($snapshots.Count -gt 0) {
                $latestSnapshot = $snapshots | Sort-Object Name -Descending | Select-Object -First 1
                $manifestPath = Join-Path $latestSnapshot.FullName "snapshot.json"
                if (Test-Path $manifestPath) {
                    $manifest = Get-Content $manifestPath | ConvertFrom-Json
                    if ($manifest.artifacts.Count -gt 0) {
                        $artifact = $manifest.artifacts[0]
                        $snapshotArtifactPath = Join-Path $latestSnapshot.FullName $artifact.relativePath
                        if (Test-Path $snapshotArtifactPath) {
                            # Backup and corrupt
                            $backupPath = "$snapshotArtifactPath.backup"
                            if (Test-Path $backupPath) {
                                Remove-Item -Path $backupPath -Force -ErrorAction SilentlyContinue
                            }
                            Copy-Item -Path $snapshotArtifactPath -Destination $backupPath -Force
                            $bytes = [System.IO.File]::ReadAllBytes($snapshotArtifactPath)
                            $bytes[0] = 0xFF
                            [System.IO.File]::WriteAllBytes($snapshotArtifactPath, $bytes)
                            $script:scenarioBackups["scenario04"] = $backupPath
                            Write-Host "  Corrupted snapshot artifact: $($artifact.logicalName)" -ForegroundColor Yellow
                        }
                    }
                }
            }
        }
    } `
    -TestScript {
        # Run rollback script (electron should be compiled by orchestrator)
        $logPath = $script:currentScenarioLogFile
        if ($logPath) {
            node scripts\run-rollback.ts --instance $InstanceId --verbose --logPath $logPath 2>&1
        } else {
            node scripts\run-rollback.ts --instance $InstanceId --verbose 2>&1
        }
    } `
    -CleanupScript {
        # Restore snapshot artifact
        if ($script:scenarioBackups.ContainsKey("scenario04")) {
            $backupPath = $script:scenarioBackups["scenario04"]
            $artifactPath = $backupPath -replace '\.backup$', ''
            if (Test-Path $backupPath) {
                if (Test-Path $artifactPath) {
                    Remove-Item -Path $artifactPath -Force -ErrorAction SilentlyContinue
                }
                Copy-Item -Path $backupPath -Destination $artifactPath -Force
                Remove-Item -Path $backupPath -Force -ErrorAction SilentlyContinue
                Write-Host "  Restored snapshot artifact" -ForegroundColor Gray
            }
        }
    }

# Scenario 05: Promote failure simulated
$scenario05Dir = Join-Path $evidenceRoot "scenario-05-promote-failure-simulated"
New-Item -ItemType Directory -Path $scenario05Dir -Force | Out-Null

$scenario05Result = Run-Scenario -ScenarioName "Promote Failure Simulated" -ScenarioDir $scenario05Dir -InstanceRoot $instanceRoot -LogFile $LogPath -ExpectedExitCode 1 `
    -SetupScript {
        # Simulate promote failure by creating a locked file in the target directory
        # This is safer than changing ACLs which requires special privileges
        $mcDir = Join-Path $instanceRoot ".minecraft"
        if (Test-Path $mcDir) {
            $versionsDir = Join-Path $mcDir "versions"
            if (Test-Path $versionsDir) {
                # Create a lock file that will prevent writes
                $lockFile = Join-Path $versionsDir ".rollback-lock-test"
                try {
                    $fileStream = [System.IO.File]::Create($lockFile)
                    $script:scenarioBackups["scenario05"] = @{
                        lockFile = $lockFile
                        fileStream = $fileStream
                    }
                    Write-Host "  Created lock file to simulate promote failure" -ForegroundColor Yellow
                } catch {
                    Write-Host "  WARNING: Could not create lock file: $_" -ForegroundColor Yellow
                    Write-Host "  Scenario 05 may not properly simulate promote failure" -ForegroundColor Yellow
                }
            }
        }
    } `
    -TestScript {
        # Run rollback script (electron should be compiled by orchestrator)
        $logPath = $script:currentScenarioLogFile
        if ($logPath) {
            node scripts\run-rollback.ts --instance $InstanceId --verbose --logPath $logPath 2>&1
        } else {
            node scripts\run-rollback.ts --instance $InstanceId --verbose 2>&1
        }
    } `
    -CleanupScript {
        # Release lock file
        if ($script:scenarioBackups.ContainsKey("scenario05")) {
            $backup = $script:scenarioBackups["scenario05"]
            try {
                if ($backup.fileStream) {
                    $backup.fileStream.Close()
                    $backup.fileStream.Dispose()
                }
                if (Test-Path $backup.lockFile) {
                    Remove-Item -Path $backup.lockFile -Force -ErrorAction SilentlyContinue
                }
                Write-Host "  Released lock file" -ForegroundColor Gray
            } catch {
                Write-Host "  WARNING: Could not release lock file: $_" -ForegroundColor Yellow
            }
        }
    }

# Create master summary
$allResults = @($scenario01Result, $scenario02Result, $scenario03Result, $scenario04Result, $scenario05Result)
# Count passed/failed explicitly from scenario statuses
$passedCount = 0
$failedCount = 0
foreach ($result in $allResults) {
    if ($result.Passed -eq $true) {
        $passedCount++
    } else {
        $failedCount++
    }
}

$masterSummary = @{
    timestamp = $timestamp
    instanceId = $InstanceId
    snapshotId = if ($SnapshotId) { $SnapshotId } else { "latest" }
    logFile = if ($LogPath) { $LogPath } else { "not found" }
    evidenceRoot = $evidenceRoot
    scenarios = $allResults | ForEach-Object {
        @{
            name = $_.Name
            passed = $_.Passed
            exitCode = $_.ExitCode
            summaryPath = Join-Path "scenario-$(($allResults.IndexOf($_) + 1).ToString('00'))-*" "summary.json"
        }
    }
    summary = @{
        total = $allResults.Count
        passed = $passedCount
        failed = $failedCount
        allPassed = $failedCount -eq 0
    }
}

$masterSummary | ConvertTo-Json -Depth 10 | Out-File -FilePath (Join-Path $evidenceRoot "summary.json") -Encoding UTF8

$dateStr = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
$snapshotStr = if ($SnapshotId) { $SnapshotId } else { "latest (auto-select)" }
$passEmoji = [char]0x2705  # ✅
$failEmoji = [char]0x274C  # ❌
# Status display: PASS with exit code != 0 is marked as "PASS (expected)"
$s01Status = if ($scenario01Result.Passed) { if ($scenario01Result.ExitCode -ne 0) { "$passEmoji PASS (expected)" } else { "$passEmoji PASS" } } else { "$failEmoji FAIL" }
$s02Status = if ($scenario02Result.Passed) { if ($scenario02Result.ExitCode -ne 0) { "$passEmoji PASS (expected)" } else { "$passEmoji PASS" } } else { "$failEmoji FAIL" }
$s03Status = if ($scenario03Result.Passed) { if ($scenario03Result.ExitCode -ne 0) { "$passEmoji PASS (expected)" } else { "$passEmoji PASS" } } else { "$failEmoji FAIL" }
$s04Status = if ($scenario04Result.Passed) { if ($scenario04Result.ExitCode -ne 0) { "$passEmoji PASS (expected)" } else { "$passEmoji PASS" } } else { "$failEmoji FAIL" }
$s05Status = if ($scenario05Result.Passed) { if ($scenario05Result.ExitCode -ne 0) { "$passEmoji PASS (expected)" } else { "$passEmoji PASS" } } else { "$failEmoji FAIL" }
$snapshotParam = if ($SnapshotId) { "-SnapshotId $SnapshotId" } else { "" }
$verboseParam = if ($ShowVerbose) { "-ShowVerbose" } else { "" }

$masterSummaryMd = "# Rollback Evidence Collection Summary" + [Environment]::NewLine + [Environment]::NewLine +
    "**Date**: $dateStr" + [Environment]::NewLine +
    "**Instance**: $InstanceId" + [Environment]::NewLine +
    "**Snapshot**: $snapshotStr" + [Environment]::NewLine +
    "**Evidence Directory**: ``$evidenceRoot``" + [Environment]::NewLine + [Environment]::NewLine +
    "## Results" + [Environment]::NewLine + [Environment]::NewLine +
    "| Scenario | Status | Exit Code | Summary |" + [Environment]::NewLine +
    "|----------|--------|-----------|---------|" + [Environment]::NewLine +
    "| Happy Path | $s01Status | $($scenario01Result.ExitCode) | [summary.md](scenario-01-happy/summary.md) |" + [Environment]::NewLine +
    "| No Snapshots | $s02Status | $($scenario02Result.ExitCode) | [summary.md](scenario-02-no-snapshots/summary.md) |" + [Environment]::NewLine +
    "| Corrupt Snapshot Manifest | $s03Status | $($scenario03Result.ExitCode) | [summary.md](scenario-03-corrupt-snapshot-manifest/summary.md) |" + [Environment]::NewLine +
    "| Snapshot Checksum Mismatch | $s04Status | $($scenario04Result.ExitCode) | [summary.md](scenario-04-snapshot-checksum-mismatch/summary.md) |" + [Environment]::NewLine +
    "| Promote Failure Simulated | $s05Status | $($scenario05Result.ExitCode) | [summary.md](scenario-05-promote-failure-simulated/summary.md) |" + [Environment]::NewLine + [Environment]::NewLine +
    "**Total**: $($allResults.Count) scenarios, $passedCount passed, $failedCount failed" + [Environment]::NewLine + [Environment]::NewLine +
    "## Evidence Files" + [Environment]::NewLine + [Environment]::NewLine +
    "Each scenario folder contains:" + [Environment]::NewLine +
    "- ``console.txt`` - Full stdout/stderr output" + [Environment]::NewLine +
    "- ``rollback-log-extract.txt`` - Filtered rollback log events" + [Environment]::NewLine +
    "- ``pre-hashes.txt`` - SHA256 hashes of lock.json and manifest before" + [Environment]::NewLine +
    "- ``post-hashes.txt`` - SHA256 hashes of lock.json and manifest after" + [Environment]::NewLine +
    "- ``dir-tree-before.txt`` - Directory tree before rollback" + [Environment]::NewLine +
    "- ``dir-tree-after.txt`` - Directory tree after rollback" + [Environment]::NewLine +
    "- ``quarantine-list.txt`` - Quarantine directory listing" + [Environment]::NewLine +
    "- ``staging-list.txt`` - Staging directory listing" + [Environment]::NewLine +
    "- ``rollback-list.txt`` - Rollback directory listing" + [Environment]::NewLine +
    "- ``summary.json`` - Machine-readable summary" + [Environment]::NewLine +
    "- ``summary.md`` - Human-readable summary" + [Environment]::NewLine + [Environment]::NewLine +
    "## Command Used" + [Environment]::NewLine + [Environment]::NewLine +
    "``````powershell" + [Environment]::NewLine +
    "powershell -ExecutionPolicy Bypass -File scripts/validation/capture-rollback-evidence.ps1 -InstanceId $InstanceId $snapshotParam $verboseParam" + [Environment]::NewLine +
    "``````"

# Write with UTF-8 encoding (no BOM for better compatibility)
[System.IO.File]::WriteAllText((Join-Path $evidenceRoot "summary.md"), $masterSummaryMd, [System.Text.UTF8Encoding]::new($false))

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "Total scenarios: $($allResults.Count)" -ForegroundColor White
Write-Host "Passed: $passedCount" -ForegroundColor Green
Write-Host "Failed: $failedCount" -ForegroundColor $(if ($failedCount -gt 0) { "Red" } else { "Green" })
Write-Host ""
Write-Host "Evidence saved to: $evidenceRoot" -ForegroundColor Yellow
Write-Host ""

# Exit with non-zero if any scenario failed
if ($failedCount -gt 0) {
    exit 1
} else {
    exit 0
}

