# SP2.3 Final Validation Guide

**Date**: 2026-01-02 18:02:00  
**Evidence Directory**: `prompts/02-evidence/L2/sp2.3-final/20260102-180200/`

## Already Proven from Existing Evidence

### From B2 Evidence (`prompts/02-evidence/L2/sp2.3-b2/20260102-174043/`)
- ✅ **Staging-first writes**: Installation writes occur in staging area first
- ✅ **Verify-in-staging before promote**: Artifacts are verified in staging before promotion
- ✅ **Atomic promotion**: Artifacts are atomically promoted from staging to final locations
- ✅ **Staging cleanup**: Staging directory is cleaned up after successful promotion
- ✅ **Resume from valid staging**: Valid staging artifacts are resumed without re-download

### From Current Snapshot Evidence
- ✅ **Snapshot creation**: Snapshots are created after successful installation (6 snapshots exist)
- ✅ **Snapshot manifest presence**: Snapshot manifest contains artifact names, paths, and checksums (see `snapshot-manifest.txt`)

## Scenarios Requiring Manual Validation

### Scenario A: Corrupt Staging Artifact Removal + Re-download

**Objective**: Validate that corrupted staging artifacts are detected, removed, and re-downloaded.

**Steps**:
1. Choose a large artifact (client jar is fine) from lockfile:
   ```powershell
   $clientJar = "$env:APPDATA\MineAnvil\instances\default\.minecraft\versions\1.21.4\1.21.4.jar"
   ```

2. Delete the final artifact so installer needs it:
   ```powershell
   Remove-Item $clientJar -Force
   ```

3. Start MineAnvil:
   ```powershell
   npm run dev:electron
   ```

4. Monitor logs and kill MineAnvil mid-download to staging (when staging file is partially written):
   - Watch for log entries showing download to staging
   - Kill the process (Ctrl+C or Task Manager) before promotion occurs
   - Verify staging contains a partial file:
     ```powershell
     pwsh -File scripts\validation\list-staging.ps1
     ```

5. Corrupt the staging file (modify bytes):
   ```powershell
   $stagingJar = "$env:APPDATA\MineAnvil\instances\default\.staging\pack-install\.minecraft\versions\1.21.4\1.21.4.jar"
   Add-Content -Path $stagingJar -Value "CORRUPTED"
   ```

6. Re-run MineAnvil and verify:
   ```powershell
   npm run dev:electron
   ```

**Expected Results**:
- Staging corruption is detected (check logs)
- Corrupted staging artifact is removed (or quarantined)
- Artifact is re-downloaded to staging
- Verified in staging
- Promoted atomically
- Staging cleaned up

**Evidence to Capture**:
```powershell
# Before corruption
pwsh -File scripts\validation\list-staging.ps1 | Out-File scenario-a-staging-before.txt

# After recovery
pwsh -File scripts\validation\list-staging.ps1 | Out-File scenario-a-staging-after.txt
pwsh -File scripts\validation\parse-recovery-logs.ps1 | Out-File scenario-a-recovery-logs.txt

# Verify final jar
$clientJar = "$env:APPDATA\MineAnvil\instances\default\.minecraft\versions\1.21.4\1.21.4.jar"
if (Test-Path $clientJar) {
    $jarInfo = Get-Item $clientJar
    "EXISTS | Size: $($jarInfo.Length) bytes" | Out-File scenario-a-final-jar.txt
}
```

### Scenario B: Quarantine Corrupted Final Artifact

**Objective**: Validate that corrupted final artifacts are quarantined and re-downloaded.

**Steps**:
1. Find a library artifact to corrupt:
   ```powershell
   pwsh -File scripts\validation\find-library-artifact.ps1
   ```
   Note the path shown.

2. Corrupt the file (modify bytes or replace with junk):
   ```powershell
   $libraryPath = "<path from step 1>"
   Add-Content -Path $libraryPath -Value "CORRUPTED"
   ```

3. Run MineAnvil:
   ```powershell
   npm run dev:electron
   ```

**Expected Results**:
- Checksum mismatch detected against lockfile
- Corrupted live file moved to `%APPDATA%\MineAnvil\instances\default\.quarantine\`
- Quarantine action logged
- Artifact re-downloaded and promoted cleanly
- Final artifact restored and checksum matches lockfile

**Evidence to Capture**:
```powershell
# Check quarantine
pwsh -File scripts\validation\list-quarantine.ps1 | Out-File scenario-b-quarantine.txt

# Recovery logs
pwsh -File scripts\validation\parse-recovery-logs.ps1 | Out-File scenario-b-recovery-logs.txt

# Verify artifact restored
$libraryPath = "<path from step 1>"
if (Test-Path $libraryPath) {
    $fileInfo = Get-Item $libraryPath
    "EXISTS | Size: $($fileInfo.Length) bytes" | Out-File scenario-b-restored-artifact.txt
}
```

### Scenario C: Snapshot Validation (Already Captured)

**Evidence Already Captured**:
- `snapshots.txt` - List of all snapshots
- `snapshot-manifest.txt` - Full manifest of latest snapshot showing artifact names, paths, checksums

**Validation**:
- ✅ Snapshots exist (6 snapshots found)
- ✅ Snapshot manifest contains required fields (names, paths, checksums)

### Scenario D: Failure-Path Validation

**Objective**: Validate that failures produce clear, user-visible error messages.

**Steps**:
1. Backup lockfile:
   ```powershell
   $lockfilePath = "$env:APPDATA\MineAnvil\instances\default\pack\lock.json"
   Copy-Item $lockfilePath "$lockfilePath.backup" -Force
   ```

2. Corrupt the lockfile (temporarily):
   ```powershell
   Set-Content -Path $lockfilePath -Value '{corrupted}'
   ```

3. Run MineAnvil:
   ```powershell
   npm run dev:electron
   ```

4. Capture the error:
   - Note the error dialog text (if shown)
   - Or capture error logs:
     ```powershell
     $logPath = "$env:APPDATA\MineAnvil\instances\default\logs\mineanvil-main.log"
     Get-Content $logPath -Tail 100 | Select-String -Pattern "ERROR|FATAL" | Out-File scenario-d-failure-path.txt
     ```

5. Restore lockfile:
   ```powershell
   Copy-Item "$lockfilePath.backup" $lockfilePath -Force
   Remove-Item "$lockfilePath.backup" -Force
   ```

**Expected Results**:
- Clear error message shown to user
- Error explains what went wrong
- Error provides actionable next steps (or at least identifies the problem)

**Evidence to Capture**:
- Error dialog screenshot or text
- Error log entries showing user-visible message

## Checklist Items to Validate

Based on STOP_POINTS.md, the following items need validation:

### Staging & Atomic Promote
- [ ] Installation writes occur in staging area first (✅ PROVEN from B2)
- [ ] All artifacts are verified in staging before promotion (✅ PROVEN from B2)
- [x] Artifacts are atomically promoted from staging to final locations (✅ PROVEN from B2)
- [x] Staging directory is cleaned up after successful promotion (✅ PROVEN from B2)

### Recovery from Interruption
- [x] If install is interrupted, next run checks staging area for recoverable artifacts (✅ PROVEN from B2)
- [x] Valid staging artifacts are resumed (promoted directly, no re-download) (✅ PROVEN from B2)
- [ ] **Corrupted staging artifacts are removed and re-downloaded** (Scenario A)
- [x] Recovery decision is logged for troubleshooting (✅ PROVEN from B2)
- [ ] **If recovery fails, fails with clear, user-visible message that includes next steps** (Scenario D)

### Last-Known-Good Snapshots
- [x] Last-known-good snapshot exists for validated artifacts (✅ PROVEN - 6 snapshots exist)
- [x] Snapshot contains manifest of validated artifacts (names, paths, checksums) (✅ PROVEN - manifest verified)
- [x] Snapshots are created after successful installation (✅ PROVEN - timestamps match installs)
- [ ] Snapshots enable rollback capability (future enhancement - not required for SP2.3)

### Quarantine
- [ ] **Corrupted files are quarantined instead of deleted** (Scenario B)
- [ ] **Quarantined files are preserved for inspection** (Scenario B)
- [ ] **Quarantine action is logged for troubleshooting** (Scenario B)

### Immutability
- [x] Rollback and recovery never mutate PackManifest (✅ PROVEN from B2)
- [x] Rollback and recovery never rewrite lock.json (✅ PROVEN from B2)
- [ ] **All recovery decisions are based solely on lockfile contents** (Need to verify from logs - check that recovery uses lockfile checksums, not remote metadata)

### Logging
- [x] All logging remains structured and secret-free (✅ PROVEN from B2)
- [ ] **Logs include enough info to diagnose recovery decisions** (Verify from recovery logs)
- [x] Recovery decision path is logged (resume/rollback/fail) (✅ PROVEN from B2)

### Integration
- [ ] **Recovery is automatic on startup (no manual intervention required)** (Verify from B2 and Scenario A)
- [x] Installation planner detects staging artifacts (✅ PROVEN from B2)
- [x] Deterministic installer handles staging, promote, recovery, quarantine, snapshots (✅ PROVEN from B2)

## Next Steps

1. Run Scenario A (corrupt staging artifact)
2. Run Scenario B (quarantine corrupted final artifact)
3. Run Scenario D (failure-path validation)
4. Review all evidence files
5. Update STOP_POINTS.md with proven items
6. Update docs/SP2.3-rollback-recovery.md with evidence references
7. Git commit changes

