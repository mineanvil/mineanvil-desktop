# Rollback Execution Evidence Capture Guide

**Stop Point**: SP2.3 "Snapshots enable rollback capability"  
**Date**: 2026-01-02  
**Evidence Directory**: `prompts/02-evidence/L2/sp2.3-rollback-execution/<timestamp>/`

## Overview

This guide provides step-by-step instructions for capturing evidence that proves rollback execution functionality is working correctly.

## Prerequisites

1. MineAnvil has been run at least once and created snapshots
2. At least one snapshot exists in `.rollback` directory
3. PowerShell available for running validation scripts

## Evidence Scenarios

### Scenario R1: Successful Rollback from Latest Snapshot

**Objective**: Prove that rollback can restore artifacts from the latest snapshot.

**Steps**:

1. **List available snapshots**:
   ```powershell
   pwsh -File scripts\validation\list-snapshots.ps1 | Out-File scenario-r1-snapshots-before.txt
   ```

2. **Corrupt an artifact** (to create a state that needs rollback):
   ```powershell
   $artifactPath = "$env:APPDATA\MineAnvil\instances\default\.minecraft\versions\1.21.4\1.21.4.jar"
   $bytes = [System.IO.File]::ReadAllBytes($artifactPath)
   $originalSize = $bytes.Length
   $bytes[0] = 0xFF
   [System.IO.File]::WriteAllBytes($artifactPath, $bytes)
   "Original size: $originalSize" | Out-File scenario-r1-artifact-before-corruption.txt
   Get-Item $artifactPath | Select-Object Name, Length | Out-File -Append scenario-r1-artifact-before-corruption.txt
   ```

3. **Execute rollback**:
   ```powershell
   node scripts\run-rollback.ts --instance default --verbose 2>&1 | Out-File scenario-r1-rollback-execution.txt
   ```

4. **Verify artifact restored**:
   ```powershell
   $artifactPath = "$env:APPDATA\MineAnvil\instances\default\.minecraft\versions\1.21.4\1.21.4.jar"
   Get-Item $artifactPath | Select-Object Name, Length | Out-File scenario-r1-artifact-after-rollback.txt
   ```

5. **Capture rollback logs**:
   ```powershell
   Get-Content "$env:APPDATA\MineAnvil\instances\default\logs\*.log" | Select-String "rollback" | Out-File scenario-r1-rollback-logs.txt
   ```

**Expected Evidence**:
- `scenario-r1-snapshots-before.txt`: Shows available snapshots
- `scenario-r1-artifact-before-corruption.txt`: Shows artifact before corruption
- `scenario-r1-rollback-execution.txt`: Shows rollback execution output with success message
- `scenario-r1-artifact-after-rollback.txt`: Shows artifact restored with correct size
- `scenario-r1-rollback-logs.txt`: Contains rollback log events:
  - `rollback_start`
  - `rollback_snapshot_selected`
  - `rollback_verify_start`
  - `rollback_verify_ok`
  - `rollback_promote_start`
  - `rollback_promote_ok`
  - `rollback_complete`

**Pass Condition**: Rollback completes successfully, artifact restored, all log events present.

---

### Scenario R2: Rollback from Specific Snapshot

**Objective**: Prove that rollback can restore from a specific snapshot ID.

**Steps**:

1. **List snapshots and select one**:
   ```powershell
   pwsh -File scripts\validation\list-snapshots.ps1 | Out-File scenario-r2-snapshots.txt
   # Note the snapshot ID to use
   $snapshotId = "<selected-snapshot-id>"
   ```

2. **Read snapshot manifest**:
   ```powershell
   pwsh -File scripts\validation\read-snapshot.ps1 -SnapshotId $snapshotId | Out-File scenario-r2-snapshot-manifest.txt
   ```

3. **Corrupt multiple artifacts**:
   ```powershell
   # Corrupt client JAR
   $jarPath = "$env:APPDATA\MineAnvil\instances\default\.minecraft\versions\1.21.4\1.21.4.jar"
   $bytes = [System.IO.File]::ReadAllBytes($jarPath)
   $bytes[0] = 0xFF
   [System.IO.File]::WriteAllBytes($jarPath, $bytes)
   
   # Corrupt a library
   $libPath = "$env:APPDATA\MineAnvil\instances\default\.minecraft\libraries\com\mojang\patchy\1.3.9\patchy-1.3.9.jar"
   if (Test-Path $libPath) {
       $bytes = [System.IO.File]::ReadAllBytes($libPath)
       $bytes[0] = 0xFF
       [System.IO.File]::WriteAllBytes($libPath, $bytes)
   }
   ```

4. **Execute rollback with specific snapshot**:
   ```powershell
   node scripts\run-rollback.ts --instance default --snapshot $snapshotId --verbose 2>&1 | Out-File scenario-r2-rollback-execution.txt
   ```

5. **Verify artifacts restored**:
   ```powershell
   $jarPath = "$env:APPDATA\MineAnvil\instances\default\.minecraft\versions\1.21.4\1.21.4.jar"
   Get-Item $jarPath | Select-Object Name, Length | Out-File scenario-r2-artifacts-after-rollback.txt
   
   $libPath = "$env:APPDATA\MineAnvil\instances\default\.minecraft\libraries\com\mojang\patchy\1.3.9\patchy-1.3.9.jar"
   if (Test-Path $libPath) {
       Get-Item $libPath | Select-Object Name, Length | Out-File -Append scenario-r2-artifacts-after-rollback.txt
   }
   ```

6. **Capture rollback logs**:
   ```powershell
   Get-Content "$env:APPDATA\MineAnvil\instances\default\logs\*.log" | Select-String "rollback" | Out-File scenario-r2-rollback-logs.txt
   ```

**Expected Evidence**:
- `scenario-r2-snapshots.txt`: Shows available snapshots
- `scenario-r2-snapshot-manifest.txt`: Shows selected snapshot manifest
- `scenario-r2-rollback-execution.txt`: Shows rollback execution with specified snapshot
- `scenario-r2-artifacts-after-rollback.txt`: Shows all artifacts restored
- `scenario-r2-rollback-logs.txt`: Contains rollback log events with correct snapshotId

**Pass Condition**: Rollback completes using specified snapshot, all artifacts restored.

---

### Scenario R3: Rollback Log Verification

**Objective**: Prove that rollback logs contain all required structured metadata.

**Steps**:

1. **Execute rollback**:
   ```powershell
   node scripts\run-rollback.ts --instance default --verbose 2>&1 | Out-File scenario-r3-rollback-execution.txt
   ```

2. **Extract rollback logs**:
   ```powershell
   Get-Content "$env:APPDATA\MineAnvil\instances\default\logs\*.log" | Select-String "rollback" | Out-File scenario-r3-rollback-logs-raw.txt
   ```

3. **Parse and format logs**:
   ```powershell
   $logs = Get-Content scenario-r3-rollback-logs-raw.txt
   $formatted = @()
   foreach ($log in $logs) {
       try {
           $json = $log | ConvertFrom-Json
           if ($json.event -match "rollback") {
               $formatted += $json | ConvertTo-Json -Depth 10
           }
       } catch {
           # Not JSON, skip
       }
   }
   $formatted | Out-File scenario-r3-rollback-logs-formatted.txt
   ```

4. **Verify log structure**:
   ```powershell
   # Check for required events
   $requiredEvents = @("rollback_start", "rollback_snapshot_selected", "rollback_verify_start", "rollback_verify_ok", "rollback_promote_start", "rollback_promote_ok", "rollback_complete")
   $foundEvents = @()
   foreach ($event in $requiredEvents) {
       if (Select-String -Path scenario-r3-rollback-logs-raw.txt -Pattern $event) {
           $foundEvents += $event
       }
   }
   "Required events: $($requiredEvents -join ', ')" | Out-File scenario-r3-log-verification.txt
   "Found events: $($foundEvents -join ', ')" | Out-File -Append scenario-r3-log-verification.txt
   
   # Check for metadata
   $authorityCount = (Select-String -Path scenario-r3-rollback-logs-raw.txt -Pattern '"authority":"snapshot_manifest"').Count
   $remoteMetadataCount = (Select-String -Path scenario-r3-rollback-logs-raw.txt -Pattern '"remoteMetadataUsed":false').Count
   "Authority='snapshot_manifest' count: $authorityCount" | Out-File -Append scenario-r3-log-verification.txt
   "remoteMetadataUsed=false count: $remoteMetadataCount" | Out-File -Append scenario-r3-log-verification.txt
   ```

**Expected Evidence**:
- `scenario-r3-rollback-execution.txt`: Shows rollback execution
- `scenario-r3-rollback-logs-raw.txt`: Contains all rollback log entries
- `scenario-r3-rollback-logs-formatted.txt`: Formatted JSON logs
- `scenario-r3-log-verification.txt`: Verification results showing:
  - All required events present
  - All logs include `authority="snapshot_manifest"`
  - All logs include `remoteMetadataUsed=false`

**Pass Condition**: All required events present, all logs have correct metadata.

---

### Scenario R4: Rollback Failure Cases

**Objective**: Prove that rollback fails safely with clear error messages.

#### R4a: No Snapshots

**Steps**:

1. **Temporarily rename rollback directory**:
   ```powershell
   $rollbackDir = "$env:APPDATA\MineAnvil\instances\default\.rollback"
   $backupDir = "$rollbackDir.backup"
   if (Test-Path $rollbackDir) {
       Move-Item $rollbackDir $backupDir -Force
   }
   ```

2. **Attempt rollback**:
   ```powershell
   node scripts\run-rollback.ts --instance default 2>&1 | Out-File scenario-r4a-no-snapshots-error.txt
   ```

3. **Restore rollback directory**:
   ```powershell
   if (Test-Path $backupDir) {
       Move-Item $backupDir $rollbackDir -Force
   }
   ```

**Expected Evidence**:
- `scenario-r4a-no-snapshots-error.txt`: Shows error message "No snapshots found" with clear next steps
- Exit code is non-zero

**Pass Condition**: Fails with clear error message, does not proceed.

#### R4b: Corrupted Snapshot Manifest

**Steps**:

1. **List snapshots**:
   ```powershell
   pwsh -File scripts\validation\list-snapshots.ps1 | Out-File scenario-r4b-snapshots.txt
   $snapshotId = "<first-snapshot-id>"
   ```

2. **Corrupt manifest**:
   ```powershell
   $manifestPath = "$env:APPDATA\MineAnvil\instances\default\.rollback\$snapshotId\snapshot.json"
   $content = Get-Content $manifestPath -Raw
   $corrupted = $content.Substring(0, 100) # Truncate
   $original = Get-Content $manifestPath -Raw
   Set-Content $manifestPath $corrupted
   ```

3. **Attempt rollback**:
   ```powershell
   node scripts\run-rollback.ts --instance default --snapshot $snapshotId 2>&1 | Out-File scenario-r4b-corrupted-manifest-error.txt
   ```

4. **Restore manifest**:
   ```powershell
   Set-Content $manifestPath $original
   ```

**Expected Evidence**:
- `scenario-r4b-snapshots.txt`: Shows available snapshots
- `scenario-r4b-corrupted-manifest-error.txt`: Shows error "Snapshot manifest is invalid or corrupted"
- Exit code is non-zero

**Pass Condition**: Fails loud, does not proceed.

#### R4c: Missing Snapshot Artifact

**Steps**:

1. **List snapshots and select one**:
   ```powershell
   pwsh -File scripts\validation\list-snapshots.ps1 | Out-File scenario-r4c-snapshots.txt
   $snapshotId = "<selected-snapshot-id>"
   ```

2. **Read manifest to find an artifact**:
   ```powershell
   $manifestPath = "$env:APPDATA\MineAnvil\instances\default\.rollback\$snapshotId\snapshot.json"
   $manifest = Get-Content $manifestPath | ConvertFrom-Json
   $artifact = $manifest.artifacts[0]
   $artifactPath = "$env:APPDATA\MineAnvil\instances\default\.rollback\$snapshotId\$($artifact.relativePath)"
   ```

3. **Delete artifact from snapshot**:
   ```powershell
   $backupPath = "$artifactPath.backup"
   if (Test-Path $artifactPath) {
       Copy-Item $artifactPath $backupPath
       Remove-Item $artifactPath -Force
   }
   ```

4. **Attempt rollback**:
   ```powershell
   node scripts\run-rollback.ts --instance default --snapshot $snapshotId 2>&1 | Out-File scenario-r4c-missing-artifact-error.txt
   ```

5. **Restore artifact**:
   ```powershell
   if (Test-Path $backupPath) {
       Copy-Item $backupPath $artifactPath
       Remove-Item $backupPath
   }
   ```

**Expected Evidence**:
- `scenario-r4c-snapshots.txt`: Shows available snapshots
- `scenario-r4c-missing-artifact-error.txt`: Shows error "Snapshot artifact missing: <artifactName>"
- Exit code is non-zero

**Pass Condition**: Fails loud, does not proceed.

---

### Scenario R5: Quarantine During Rollback

**Objective**: Prove that corrupted live artifacts are quarantined before rollback.

**Steps**:

1. **List quarantine before**:
   ```powershell
   pwsh -File scripts\validation\list-quarantine.ps1 | Out-File scenario-r5-quarantine-before.txt
   ```

2. **Corrupt an artifact**:
   ```powershell
   $artifactPath = "$env:APPDATA\MineAnvil\instances\default\.minecraft\versions\1.21.4\1.21.4.jar"
   $bytes = [System.IO.File]::ReadAllBytes($artifactPath)
   $bytes[0] = 0xFF
   [System.IO.File]::WriteAllBytes($artifactPath, $bytes)
   "Corrupted artifact: $artifactPath" | Out-File scenario-r5-artifact-corrupted.txt
   ```

3. **Execute rollback**:
   ```powershell
   node scripts\run-rollback.ts --instance default --verbose 2>&1 | Out-File scenario-r5-rollback-execution.txt
   ```

4. **List quarantine after**:
   ```powershell
   pwsh -File scripts\validation\list-quarantine.ps1 | Out-File scenario-r5-quarantine-after.txt
   ```

5. **Check quarantine logs**:
   ```powershell
   Get-Content "$env:APPDATA\MineAnvil\instances\default\logs\*.log" | Select-String "quarantine" | Out-File scenario-r5-quarantine-logs.txt
   ```

**Expected Evidence**:
- `scenario-r5-quarantine-before.txt`: Shows quarantine directory before (may be empty)
- `scenario-r5-artifact-corrupted.txt`: Confirms artifact was corrupted
- `scenario-r5-rollback-execution.txt`: Shows rollback execution
- `scenario-r5-quarantine-after.txt`: Shows corrupted artifact in quarantine
- `scenario-r5-quarantine-logs.txt`: Contains "artifact quarantined before rollback" log entries

**Pass Condition**: Corrupted artifact quarantined, rollback completes successfully.

---

## Summary Checklist

After capturing evidence for all scenarios, create a summary:

```powershell
@"
# Rollback Execution Evidence Summary

**Date**: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
**Evidence Directory**: prompts/02-evidence/L2/sp2.3-rollback-execution/<timestamp>/

## Scenarios Completed

- [ ] R1: Successful Rollback from Latest Snapshot
- [ ] R2: Rollback from Specific Snapshot
- [ ] R3: Rollback Log Verification
- [ ] R4a: No Snapshots Failure
- [ ] R4b: Corrupted Snapshot Manifest Failure
- [ ] R4c: Missing Snapshot Artifact Failure
- [ ] R5: Quarantine During Rollback

## Proven Checklist Items

- [ ] Rollback can restore artifacts from snapshot
- [ ] Rollback is atomic (no half-rolled-back state)
- [ ] Rollback verifies restored artifacts against snapshot manifest
- [ ] Rollback never uses remote metadata
- [ ] Rollback never changes manifest/lockfile
- [ ] Rollback produces clear failure messages with next steps
- [ ] Rollback logs contain all required structured metadata
- [ ] Corrupted artifacts are quarantined before rollback
"@ | Out-File rollback-evidence-summary.md
```

## Log Verification Commands

### Extract Rollback Events

```powershell
Get-Content "$env:APPDATA\MineAnvil\instances\default\logs\*.log" | Select-String "rollback" | Out-File rollback-events.txt
```

### Verify Log Metadata

```powershell
# Count events with correct authority
$authorityCount = (Select-String -Path rollback-events.txt -Pattern '"authority":"snapshot_manifest"').Count
$remoteMetadataCount = (Select-String -Path rollback-events.txt -Pattern '"remoteMetadataUsed":false').Count

Write-Host "Events with authority='snapshot_manifest': $authorityCount"
Write-Host "Events with remoteMetadataUsed=false: $remoteMetadataCount"
```

### Extract Specific Events

```powershell
# Extract rollback_start
Select-String -Path rollback-events.txt -Pattern "rollback_start"

# Extract rollback_complete
Select-String -Path rollback-events.txt -Pattern "rollback_complete"

# Extract verification events
Select-String -Path rollback-events.txt -Pattern "rollback_verify"
```

## Notes

- All evidence files should be saved in timestamped directory: `prompts/02-evidence/L2/sp2.3-rollback-execution/<timestamp>/`
- Use descriptive file names with scenario prefix (e.g., `scenario-r1-*.txt`)
- Include both raw logs and formatted/parsed versions where helpful
- Verify all log entries include required metadata before marking scenario complete



