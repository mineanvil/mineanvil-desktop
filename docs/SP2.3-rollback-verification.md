# Stop Point 2.3 — Rollback Execution Verification

## Overview

This document provides step-by-step verification instructions for rollback execution functionality, including expected logs and evidence requirements.

## Prerequisites

- MineAnvil has been run at least once and created snapshots
- At least one snapshot exists in `.rollback` directory
- PowerShell available for running validation scripts

## Verification Steps

### Step 1: Verify Snapshots Exist

**Command**:
```powershell
pwsh -File scripts\validation\list-snapshots.ps1
```

**Expected Output**:
- Rollback directory exists
- At least one snapshot directory listed
- Each snapshot shows:
  - Created timestamp
  - Minecraft version
  - Artifact count

**Pass Condition**: At least one snapshot with valid manifest exists.

### Step 2: Verify Snapshot Structure

**Command**:
```powershell
pwsh -File scripts\validation\read-snapshot.ps1 -SnapshotId <snapshotId>
```

**Expected Output**:
- Snapshot manifest loads successfully
- Manifest contains:
  - `snapshotId`
  - `createdAt`
  - `minecraftVersion`
  - `authority: "lockfile"`
  - `artifactCount`
  - `artifacts` array with entries containing:
    - `logicalName`
    - `relativePath`
    - `checksum: { algo, value }`
    - `size`

**Pass Condition**: Manifest structure is valid and contains all required fields.

### Step 3: Verify Snapshot Artifact Files

**Command**:
```powershell
$snapshotId = "<snapshotId>"
$snapshotDir = "$env:APPDATA\MineAnvil\instances\default\.rollback\$snapshotId"
Get-ChildItem -Path $snapshotDir -Recurse -File | Select-Object FullName, Length
```

**Expected Output**:
- Artifact files exist in snapshot directory
- Files match paths in manifest
- File sizes match manifest `size` values

**Pass Condition**: All artifacts listed in manifest have corresponding files in snapshot directory.

### Step 4: Execute Rollback (Latest Snapshot)

**Command**:
```powershell
node scripts\run-rollback.ts --instance default --verbose
```

**Expected Output**:
- Rollback starts successfully
- Latest snapshot is selected automatically
- Artifacts are verified in snapshot
- Artifacts are copied to rollback staging
- Artifacts are promoted to final locations
- Rollback completes successfully

**Pass Condition**: Rollback completes without errors, artifacts restored.

### Step 5: Execute Rollback (Specific Snapshot)

**Command**:
```powershell
node scripts\run-rollback.ts --instance default --snapshot <snapshotId> --verbose
```

**Expected Output**:
- Specified snapshot is selected
- Rollback proceeds as in Step 4

**Pass Condition**: Rollback completes using specified snapshot.

### Step 6: Verify Rollback Logs

**Command**:
```powershell
# Check logs for rollback events
Get-Content "$env:APPDATA\MineAnvil\instances\default\logs\*.log" | Select-String "rollback"
```

**Expected Log Events**:
1. `rollback_start`: Rollback initiated
2. `rollback_snapshot_selected`: Snapshot selected
3. `rollback_verify_start`: Verification started
4. `rollback_verify_ok`: Verification completed
5. `rollback_promote_start`: Promotion started
6. `rollback_promote_ok`: Promotion completed
7. `rollback_complete`: Rollback completed

**Expected Log Metadata**:
- All rollback logs include `meta.authority="snapshot_manifest"`
- All rollback logs include `meta.remoteMetadataUsed=false`
- Verification logs include expected/observed checksum prefixes

**Pass Condition**: All expected log events present with correct metadata.

### Step 7: Verify Artifact Restoration

**Command**:
```powershell
# Check that artifacts exist in final locations
$manifest = Get-Content "$env:APPDATA\MineAnvil\instances\default\.rollback\<snapshotId>\snapshot.json" | ConvertFrom-Json
foreach ($artifact in $manifest.artifacts) {
    $finalPath = "$env:APPDATA\MineAnvil\instances\default\$($artifact.relativePath)"
    if (Test-Path $finalPath) {
        $size = (Get-Item $finalPath).Length
        Write-Host "$($artifact.logicalName): $size bytes (expected: $($artifact.size))"
    } else {
        Write-Host "$($artifact.logicalName): MISSING" -ForegroundColor Red
    }
}
```

**Expected Output**:
- All artifacts exist in final locations
- File sizes match manifest sizes

**Pass Condition**: All artifacts restored to correct locations with correct sizes.

### Step 8: Test Rollback with Corrupted Artifacts

**Setup**:
1. Corrupt an artifact in final location (modify bytes)
2. Run rollback

**Command**:
```powershell
# Corrupt an artifact
$artifactPath = "$env:APPDATA\MineAnvil\instances\default\.minecraft\versions\1.21.4\1.21.4.jar"
$bytes = [System.IO.File]::ReadAllBytes($artifactPath)
$bytes[0] = 0xFF
[System.IO.File]::WriteAllBytes($artifactPath, $bytes)

# Run rollback
node scripts\run-rollback.ts --instance default --verbose
```

**Expected Behavior**:
- Corrupted artifact is detected
- Corrupted artifact is quarantined
- Artifact is restored from snapshot
- Rollback completes successfully

**Pass Condition**: Corrupted artifact quarantined and restored.

### Step 9: Test Rollback Failure Cases

#### 9a: No Snapshots

**Command**:
```powershell
# Temporarily rename rollback directory
$rollbackDir = "$env:APPDATA\MineAnvil\instances\default\.rollback"
$backupDir = "$rollbackDir.backup"
Move-Item $rollbackDir $backupDir -ErrorAction SilentlyContinue

# Try rollback
node scripts\run-rollback.ts --instance default

# Restore
Move-Item $backupDir $rollbackDir -ErrorAction SilentlyContinue
```

**Expected Output**:
- Error message: "No snapshots found"
- Clear next steps provided
- Exit code non-zero

**Pass Condition**: Fails with clear error message.

#### 9b: Corrupted Snapshot Manifest

**Command**:
```powershell
# Corrupt a snapshot manifest
$manifestPath = "$env:APPDATA\MineAnvil\instances\default\.rollback\<snapshotId>\snapshot.json"
$content = Get-Content $manifestPath -Raw
$corrupted = $content.Substring(0, 100) # Truncate
Set-Content $manifestPath $corrupted

# Try rollback
node scripts\run-rollback.ts --instance default --snapshot <snapshotId>
```

**Expected Output**:
- Error message: "Snapshot manifest is invalid or corrupted"
- Does NOT proceed with rollback
- Exit code non-zero

**Pass Condition**: Fails loud, does not proceed.

#### 9c: Missing Snapshot Artifact

**Command**:
```powershell
# Delete an artifact from snapshot
$artifactPath = "$env:APPDATA\MineAnvil\instances\default\.rollback\<snapshotId>\.minecraft\versions\1.21.4\1.21.4.jar"
Remove-Item $artifactPath -Force

# Try rollback
node scripts\run-rollback.ts --instance default --snapshot <snapshotId>
```

**Expected Output**:
- Error message: "Snapshot artifact missing: <artifactName>"
- Does NOT proceed with rollback
- Exit code non-zero

**Pass Condition**: Fails loud, does not proceed.

## Evidence Collection

### Required Evidence Files

1. **Snapshot List**: `snapshots.txt`
   ```powershell
   pwsh -File scripts\validation\list-snapshots.ps1 | Out-File snapshots.txt
   ```

2. **Snapshot Manifest**: `snapshot-manifest.txt`
   ```powershell
   pwsh -File scripts\validation\read-snapshot.ps1 -SnapshotId <snapshotId> | Out-File snapshot-manifest.txt
   ```

3. **Rollback Logs**: `rollback-logs.txt`
   ```powershell
   Get-Content "$env:APPDATA\MineAnvil\instances\default\logs\*.log" | Select-String "rollback" | Out-File rollback-logs.txt
   ```

4. **Rollback Execution Output**: `rollback-execution.txt`
   ```powershell
   node scripts\run-rollback.ts --instance default --verbose 2>&1 | Out-File rollback-execution.txt
   ```

5. **Artifact Verification**: `rollback-artifacts.txt`
   ```powershell
   # Use command from Step 7
   | Out-File rollback-artifacts.txt
   ```

### Log Verification Checklist

- [ ] `rollback_start` event logged
- [ ] `rollback_snapshot_selected` event logged with snapshotId
- [ ] `rollback_verify_start` event logged
- [ ] `rollback_verify_ok` event logged with verifiedCount
- [ ] `rollback_promote_start` event logged
- [ ] `rollback_promote_ok` event logged with promotedCount
- [ ] `rollback_complete` event logged with restoredCount
- [ ] All rollback logs include `meta.authority="snapshot_manifest"`
- [ ] All rollback logs include `meta.remoteMetadataUsed=false`
- [ ] No manifest/lockfile mutation occurred
- [ ] Corrupted artifacts quarantined (if applicable)

## Test Script

A test script is available for automated verification:

```powershell
pwsh -File scripts\validation\test-rollback.ps1 -InstanceId default -Verbose
```

This script:
- Lists available snapshots
- Executes rollback
- Reports success/failure
- Exits with appropriate code

## Troubleshooting

### Rollback Fails: "No snapshots found"

**Cause**: No snapshots exist in rollback directory.

**Solution**: Run MineAnvil installation first to create snapshots.

### Rollback Fails: "Snapshot manifest is invalid"

**Cause**: Snapshot manifest file is corrupted or missing.

**Solution**: Delete corrupted snapshot directory, run installation to create new snapshot.

### Rollback Fails: "Snapshot artifact missing"

**Cause**: Artifact file missing from snapshot directory.

**Solution**: Delete incomplete snapshot directory, run installation to create new snapshot.

### Rollback Fails: "Checksum mismatch"

**Cause**: Snapshot artifact checksum doesn't match manifest.

**Solution**: Delete corrupted snapshot directory, run installation to create new snapshot.

### Rollback Fails: "Failed to promote artifact"

**Cause**: File system error during promotion (e.g., file in use).

**Solution**: Close applications using Minecraft files, retry rollback.


