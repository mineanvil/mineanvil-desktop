# Orchestrator script for SP2.3 rollback evidence collection
# Usage: .\scripts\validation\run-sp2.3-rollback-evidence.ps1 -InstanceId <id> [-ShowVerbose]
#
# This script handles all prerequisites and runs the evidence collection:
# 1. Verifies node/npm
# 2. Builds electron code (npm run build:electron)
# 3. Ensures snapshot exists (creates one if needed)
# 4. Runs evidence collection script
# 5. Prints results

param(
    [Parameter(Mandatory=$false)]
    [string]$InstanceId = "default",
    
    [switch]$ShowVerbose
)

$ErrorActionPreference = "Continue"

# Helper function for verbose output
function Write-VerboseOutput {
    param([string]$Message)
    if ($ShowVerbose) {
        Write-Host $Message -ForegroundColor Gray
    }
}

# Function to write orchestrator evidence files
function Write-OrchestratorFiles {
    param(
        [string]$EvidenceRoot,
        [hashtable]$ExecutionState,
        [hashtable]$EnvInfo,
        [string]$FullCommandLine,
        [datetime]$StartTimestamp,
        [string]$InstanceId
    )
    
    # Write orchestrator-run.txt
    $runInfo = @()
    $runInfo += "=== Orchestrator Run Information ==="
    $runInfo += ""
    $runInfo += "Timestamp: $($StartTimestamp.ToString('yyyy-MM-dd HH:mm:ss'))"
    $runInfo += "InstanceId: $InstanceId"
    $runInfo += "Full Command Line: $FullCommandLine"
    $runInfo += ""
    $runInfo += "Build Step:"
    $runInfo += "  Status: $($ExecutionState.buildStatus)"
    $runInfo += "  Exit Code: $(if ($ExecutionState.buildExitCode -ne $null) { $ExecutionState.buildExitCode } else { 'N/A' })"
    $runInfo += ""
    $runInfo += "Snapshot Precheck:"
    $runInfo += "  Results Path: $(if ($ExecutionState.snapshotPrecheckPath) { $ExecutionState.snapshotPrecheckPath } else { 'N/A' })"
    $runInfo += "  Snapshot Created: $($ExecutionState.snapshotCreated)"
    if ($ExecutionState.snapshotCreateExitCode -ne $null) {
        $runInfo += "  Snapshot Create Exit Code: $($ExecutionState.snapshotCreateExitCode)"
    }
    $runInfo += ""
    $runInfo += "Capture Script:"
    $runInfo += "  Command Line: $(if ($ExecutionState.captureScriptCommand) { $ExecutionState.captureScriptCommand } else { 'N/A' })"
    $runInfo += "  Exit Code: $(if ($ExecutionState.captureExitCode -ne $null) { $ExecutionState.captureExitCode } else { 'N/A' })"
    $runInfo += ""
    $runInfo += "Final Overall Exit Code: $(if ($ExecutionState.overallExitCode -ne $null) { $ExecutionState.overallExitCode } else { 'N/A' })"
    
    $runInfoPath = Join-Path $EvidenceRoot "orchestrator-run.txt"
    [System.IO.File]::WriteAllText($runInfoPath, ($runInfo -join [Environment]::NewLine), [System.Text.UTF8Encoding]::new($false))
    
    # Write orchestrator-env.json
    $envInfoPath = Join-Path $EvidenceRoot "orchestrator-env.json"
    $EnvInfo | ConvertTo-Json -Depth 10 | Out-File -FilePath $envInfoPath -Encoding UTF8
}

# Capture full command line
$fullCommandLine = "powershell -ExecutionPolicy Bypass -File scripts/validation/run-sp2.3-rollback-evidence.ps1 -InstanceId $InstanceId"
if ($ShowVerbose) {
    $fullCommandLine += " -ShowVerbose"
}

# Get repo root (assume we're in repo root, or find it)
$repoRoot = Get-Location
try {
    $gitRoot = git rev-parse --show-toplevel 2>&1
    if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($gitRoot)) {
        $repoRoot = $gitRoot
    }
} catch {
    # Use current directory if git command fails
}

# Get git commit hash
$gitCommitHash = "unknown"
try {
    $commitHash = git rev-parse HEAD 2>&1
    if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($commitHash)) {
        $gitCommitHash = $commitHash.Trim()
    }
} catch {
    # Leave as "unknown"
}

# Create timestamp for evidence folder
$startTimestamp = Get-Date
$timestamp = $startTimestamp.ToString('yyyyMMdd-HHmmss')
$evidenceRoot = Join-Path $repoRoot "prompts\02-evidence\L2\sp2.3-rollback-execution\$timestamp"
New-Item -ItemType Directory -Path $evidenceRoot -Force | Out-Null

# Track execution state
$executionState = @{
    buildStatus = "not_started"
    buildExitCode = $null
    snapshotPrecheckPath = $null
    snapshotCreated = $false
    snapshotCreateExitCode = $null
    captureScriptCommand = $null
    captureExitCode = $null
    overallExitCode = $null
}

Write-Host "=== SP2.3 Rollback Evidence Orchestrator ===" -ForegroundColor Cyan
Write-Host "Instance: $InstanceId" -ForegroundColor White
Write-Host "Evidence will be saved to: $evidenceRoot" -ForegroundColor Yellow
Write-Host ""

# Step 1: Verify node/npm
Write-Host "Step 1: Verifying node/npm..." -ForegroundColor Cyan
try {
    $nodeVersion = (node --version 2>&1).ToString().Trim()
    $npmVersion = (npm --version 2>&1).ToString().Trim()
    Write-Host "  Node: $nodeVersion" -ForegroundColor Green
    Write-Host "  npm: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Node/npm not found. Please install Node.js." -ForegroundColor Red
    $executionState.overallExitCode = 1
    Write-OrchestratorFiles -EvidenceRoot $evidenceRoot -ExecutionState $executionState -EnvInfo $envInfo -FullCommandLine $fullCommandLine -StartTimestamp $startTimestamp -InstanceId $InstanceId
    Write-Host ""
    Write-Host "Evidence folder: $evidenceRoot" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Store environment info
$envInfo = @{
    nodeVersion = $nodeVersion
    npmVersion = $npmVersion
    gitCommitHash = $gitCommitHash
    repoRootPath = $repoRoot
    appDataPath = $env:APPDATA
    instancePath = Join-Path $env:APPDATA "MineAnvil\instances\$InstanceId"
}

# Step 2: Build electron code
Write-Host "Step 2: Building electron code..." -ForegroundColor Cyan
$buildLogPath = Join-Path $evidenceRoot "build-electron-console.txt"
$buildOutput = @()
$buildOutput += "=== Build Electron Code ==="
$buildOutput += "Started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$buildOutput += "Command: npm run build:electron"
$buildOutput += ""

try {
    $buildResult = npm run build:electron 2>&1 | Tee-Object -Variable buildOutputLines
    $buildOutput += $buildOutputLines
    $buildExitCode = $LASTEXITCODE
    
    $buildOutput += ""
    $buildOutput += "Ended: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    $buildOutput += "Exit code: $buildExitCode"
    
    $buildOutput | Out-File -FilePath $buildLogPath -Encoding UTF8
    
    $executionState.buildStatus = if ($buildExitCode -eq 0) { "success" } else { "failed" }
    $executionState.buildExitCode = $buildExitCode
    
    if ($buildExitCode -ne 0) {
        Write-Host "  ❌ Build failed (exit code: $buildExitCode)" -ForegroundColor Red
        Write-Host "  Build logs saved to: $buildLogPath" -ForegroundColor Yellow
        
        # Save to build-failed folder
        $buildFailedDir = Join-Path $evidenceRoot "build-failed"
        New-Item -ItemType Directory -Path $buildFailedDir -Force | Out-Null
        Copy-Item -Path $buildLogPath -Destination (Join-Path $buildFailedDir "build-electron-console.txt") -Force
        
        $executionState.overallExitCode = $buildExitCode
        Write-OrchestratorFiles -EvidenceRoot $evidenceRoot -ExecutionState $executionState -EnvInfo $envInfo -FullCommandLine $fullCommandLine -StartTimestamp $startTimestamp -InstanceId $InstanceId
        Write-Host ""
        Write-Host "Evidence folder: $evidenceRoot" -ForegroundColor Yellow
        exit $buildExitCode
    }
    
    Write-Host "  ✅ Build completed successfully" -ForegroundColor Green
    Write-Host "  Build logs saved to: $buildLogPath" -ForegroundColor Gray
} catch {
    $buildOutput += "Build error: $($_.Exception.Message)"
    $buildOutput | Out-File -FilePath $buildLogPath -Encoding UTF8
    
    $executionState.buildStatus = "exception"
    $executionState.buildExitCode = 1
    
    Write-Host "  ❌ Build failed with exception: $($_.Exception.Message)" -ForegroundColor Red
    
    # Save to build-failed folder
    $buildFailedDir = Join-Path $evidenceRoot "build-failed"
    New-Item -ItemType Directory -Path $buildFailedDir -Force | Out-Null
    Copy-Item -Path $buildLogPath -Destination (Join-Path $buildFailedDir "build-electron-console.txt") -Force
    
    $executionState.overallExitCode = 1
    Write-OrchestratorFiles -EvidenceRoot $evidenceRoot -ExecutionState $executionState -EnvInfo $envInfo -FullCommandLine $fullCommandLine -StartTimestamp $startTimestamp -InstanceId $InstanceId
    Write-Host ""
    Write-Host "Evidence folder: $evidenceRoot" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Step 3: Check for snapshot
Write-Host "Step 3: Checking for snapshot..." -ForegroundColor Cyan
$rollbackPath = Join-Path $env:APPDATA "MineAnvil\instances\$InstanceId\.rollback"
$snapshotPrecheckPath = Join-Path $evidenceRoot "snapshot-precheck.txt"
$snapshotPrecheckOutput = @()
$snapshotPrecheckOutput += "=== Snapshot Precheck ==="
$snapshotPrecheckOutput += "Instance: $InstanceId"
$snapshotPrecheckOutput += "Rollback directory: $rollbackPath"
$snapshotPrecheckOutput += ""

$snapshotExists = $false
if (Test-Path $rollbackPath) {
    $snapshots = Get-ChildItem -Path $rollbackPath -Directory -ErrorAction SilentlyContinue
    $snapshotPrecheckOutput += "Found $($snapshots.Count) snapshot directory(ies):"
    foreach ($snapshot in $snapshots) {
        $v1ManifestPath = Join-Path $snapshot.FullName "snapshot.v1.json"
        $legacyManifestPath = Join-Path $snapshot.FullName "snapshot.json"
        $hasV1Manifest = Test-Path $v1ManifestPath
        $hasLegacyManifest = Test-Path $legacyManifestPath
        $manifestType = if ($hasV1Manifest) { "v1" } elseif ($hasLegacyManifest) { "legacy" } else { "none" }
        $snapshotPrecheckOutput += "  - $($snapshot.Name) (manifest: $manifestType)"
        if ($hasV1Manifest) {
            $snapshotExists = $true
        }
    }
} else {
    $snapshotPrecheckOutput += "Rollback directory does not exist"
}

$snapshotPrecheckOutput | Out-File -FilePath $snapshotPrecheckPath -Encoding UTF8
$executionState.snapshotPrecheckPath = $snapshotPrecheckPath

if ($snapshotExists) {
    Write-Host "  ✅ Snapshot found" -ForegroundColor Green
    Write-Host "  Snapshot precheck saved to: $snapshotPrecheckPath" -ForegroundColor Gray
} else {
    Write-Host "  ⚠️  No snapshot found. Creating one..." -ForegroundColor Yellow
    Write-Host ""
    
    # Step 3a: Create snapshot
    Write-Host "Step 3a: Creating snapshot..." -ForegroundColor Cyan
    $snapshotCreateLogPath = Join-Path $evidenceRoot "snapshot-create-console.txt"
    $snapshotCreateOutput = @()
    $snapshotCreateOutput += "=== Create Snapshot ==="
    $snapshotCreateOutput += "Started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    $snapshotCreateOutput += "Command: node scripts/create-snapshot-for-instance.cjs --instance $InstanceId"
    $snapshotCreateOutput += ""
    
    try {
        $snapshotCreateResult = node scripts/create-snapshot-for-instance.cjs --instance $InstanceId 2>&1 | Tee-Object -Variable snapshotCreateOutputLines
        $snapshotCreateOutput += $snapshotCreateOutputLines
        $snapshotCreateExitCode = $LASTEXITCODE
        
        $snapshotCreateOutput += ""
        $snapshotCreateOutput += "Ended: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
        $snapshotCreateOutput += "Exit code: $snapshotCreateExitCode"
        
        $snapshotCreateOutput | Out-File -FilePath $snapshotCreateLogPath -Encoding UTF8
        
        $executionState.snapshotCreated = $true
        $executionState.snapshotCreateExitCode = $snapshotCreateExitCode
        
        if ($snapshotCreateExitCode -ne 0) {
            Write-Host "  ❌ Snapshot creation failed (exit code: $snapshotCreateExitCode)" -ForegroundColor Red
            Write-Host "  Snapshot creation logs saved to: $snapshotCreateLogPath" -ForegroundColor Yellow
            
            # Save to snapshot-create-failed folder
            $snapshotCreateFailedDir = Join-Path $evidenceRoot "snapshot-create-failed"
            New-Item -ItemType Directory -Path $snapshotCreateFailedDir -Force | Out-Null
            Copy-Item -Path $snapshotCreateLogPath -Destination (Join-Path $snapshotCreateFailedDir "snapshot-create-console.txt") -Force
            
            $executionState.overallExitCode = $snapshotCreateExitCode
            Write-OrchestratorFiles -EvidenceRoot $evidenceRoot -ExecutionState $executionState -EnvInfo $envInfo -FullCommandLine $fullCommandLine -StartTimestamp $startTimestamp -InstanceId $InstanceId
            Write-Host ""
            Write-Host "Evidence folder: $evidenceRoot" -ForegroundColor Yellow
            exit $snapshotCreateExitCode
        }
        
        Write-Host "  ✅ Snapshot created successfully" -ForegroundColor Green
        Write-Host "  Snapshot creation logs saved to: $snapshotCreateLogPath" -ForegroundColor Gray
        
        # Step 3b: Validate snapshot files
        Write-Host ""
        Write-Host "Step 3b: Validating snapshot files..." -ForegroundColor Cyan
        $rollbackDir = Join-Path $envInfo.instancePath ".rollback"
        if (Test-Path $rollbackDir) {
            $snapshots = Get-ChildItem -Path $rollbackDir -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending
            $newestSnapshot = $snapshots | Select-Object -First 1
            if ($newestSnapshot) {
                $snapshotId = Split-Path -Leaf $newestSnapshot.FullName
                $validateOutput = node scripts/validation/validate-snapshot-files.ts --instance $InstanceId --snapshot $snapshotId --verbose 2>&1
                $validateExitCode = $LASTEXITCODE
                
                $snapshotCreateOutput += ""
                $snapshotCreateOutput += "=== Snapshot File Validation ==="
                $snapshotCreateOutput += "Snapshot ID: $snapshotId"
                $snapshotCreateOutput += "Command: node scripts/validation/validate-snapshot-files.ts --instance $InstanceId --snapshot $snapshotId --verbose"
                $snapshotCreateOutput += ""
                $snapshotCreateOutput += $validateOutput
                $snapshotCreateOutput += ""
                $snapshotCreateOutput += "Exit code: $validateExitCode"
                $snapshotCreateOutput | Out-File -FilePath $snapshotCreateLogPath -Encoding UTF8 -Append
                
                if ($validateExitCode -ne 0) {
                    Write-Host "  ❌ Snapshot file validation failed (exit code: $validateExitCode)" -ForegroundColor Red
                    Write-Host "  Validation output:" -ForegroundColor Yellow
                    $validateOutput | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
                    
                    # Save to snapshot-create-failed folder
                    $snapshotCreateFailedDir = Join-Path $evidenceRoot "snapshot-create-failed"
                    New-Item -ItemType Directory -Path $snapshotCreateFailedDir -Force | Out-Null
                    Copy-Item -Path $snapshotCreateLogPath -Destination (Join-Path $snapshotCreateFailedDir "snapshot-create-console.txt") -Force
                    
                    $executionState.overallExitCode = $validateExitCode
                    Write-OrchestratorFiles -EvidenceRoot $evidenceRoot -ExecutionState $executionState -EnvInfo $envInfo -FullCommandLine $fullCommandLine -StartTimestamp $startTimestamp -InstanceId $InstanceId
                    Write-Host ""
                    Write-Host "Evidence folder: $evidenceRoot" -ForegroundColor Yellow
                    exit $validateExitCode
                }
                
                Write-Host "  ✅ Snapshot files validated successfully" -ForegroundColor Green
            }
        }
    } catch {
        $snapshotCreateOutput += "Snapshot creation error: $($_.Exception.Message)"
        $snapshotCreateOutput | Out-File -FilePath $snapshotCreateLogPath -Encoding UTF8
        
        $executionState.snapshotCreated = $false
        $executionState.snapshotCreateExitCode = 1
        
        Write-Host "  ❌ Snapshot creation failed with exception: $($_.Exception.Message)" -ForegroundColor Red
        
        # Save to snapshot-create-failed folder
        $snapshotCreateFailedDir = Join-Path $evidenceRoot "snapshot-create-failed"
        New-Item -ItemType Directory -Path $snapshotCreateFailedDir -Force | Out-Null
        Copy-Item -Path $snapshotCreateLogPath -Destination (Join-Path $snapshotCreateFailedDir "snapshot-create-console.txt") -Force
        
        $executionState.overallExitCode = 1
        Write-OrchestratorFiles
        exit 1
    }
}
Write-Host ""

# Step 4: Run evidence collection
Write-Host "Step 4: Running evidence collection..." -ForegroundColor Cyan
Write-Host ""

$evidenceScriptPath = Join-Path $repoRoot "scripts\validation\capture-rollback-evidence.ps1"

# Build capture script command line
$captureCommand = "powershell -ExecutionPolicy Bypass -File scripts/validation/capture-rollback-evidence.ps1 -InstanceId $InstanceId -EvidenceDir `"$evidenceRoot`""
if ($ShowVerbose) {
    $captureCommand += " -ShowVerbose"
}
$executionState.captureScriptCommand = $captureCommand

try {
    if ($ShowVerbose) {
        $evidenceResult = & $evidenceScriptPath -InstanceId $InstanceId -EvidenceDir $evidenceRoot -ShowVerbose
    } else {
        $evidenceResult = & $evidenceScriptPath -InstanceId $InstanceId -EvidenceDir $evidenceRoot
    }
    $evidenceExitCode = $LASTEXITCODE
    $executionState.captureExitCode = $evidenceExitCode
    $executionState.overallExitCode = $evidenceExitCode
    
    Write-Host ""
    Write-Host "=== Evidence Collection Complete ===" -ForegroundColor Cyan
    
    if ($evidenceExitCode -eq 0) {
        Write-Host "✅ All scenarios PASSED" -ForegroundColor Green
    } else {
        Write-Host "❌ Some scenarios FAILED (exit code: $evidenceExitCode)" -ForegroundColor Red
    }
    
    Write-OrchestratorFiles -EvidenceRoot $evidenceRoot -ExecutionState $executionState -EnvInfo $envInfo -FullCommandLine $fullCommandLine -StartTimestamp $startTimestamp -InstanceId $InstanceId
    
    Write-Host ""
    Write-Host "Evidence folder: $evidenceRoot" -ForegroundColor Yellow
    Write-Host "Summary: $evidenceRoot\summary.md" -ForegroundColor Yellow
    Write-Host ""
    
    # Exit with the evidence script's exit code
    exit $evidenceExitCode
} catch {
    $executionState.captureExitCode = 1
    $executionState.overallExitCode = 1
    
    Write-Host ""
    Write-Host "❌ Evidence collection failed with exception: $($_.Exception.Message)" -ForegroundColor Red
    
    Write-OrchestratorFiles -EvidenceRoot $evidenceRoot -ExecutionState $executionState -EnvInfo $envInfo -FullCommandLine $fullCommandLine -StartTimestamp $startTimestamp -InstanceId $InstanceId
    
    Write-Host ""
    Write-Host "Evidence folder: $evidenceRoot" -ForegroundColor Yellow
    exit 1
}
