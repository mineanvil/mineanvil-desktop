# Stop Point 2.3 — Rollback & Recovery (Hardening)

## Overview

Stop Point 2.3 implements rollback and recovery for deterministic installs, enabling MineAnvil to safely recover from partial or corrupt installs of lockfile-declared artefacts without manual intervention. Installation writes occur in a staging area first, then are atomically promoted to final locations. If an install is interrupted, the next run can resume from staging, rollback to last-known-good, or fail with clear next steps.

**Note**: SP2.3 builds on SP2.2 deterministic install. All installation behavior from SP2.2 remains unchanged, with the addition of staging, atomic promote, recovery, and rollback capabilities.

## Implementation

### Staging Area

**Location**: `%APPDATA%\MineAnvil\instances\<instanceId>\.staging\pack-install\`

All installation writes occur in the staging area first:

- Artifacts are downloaded to staging paths that mirror final paths
- Checksums are verified in staging before promotion
- Staging preserves the relative path structure (`.minecraft/`, `runtimes/`, etc.)
- Staging directory is cleaned up after successful promotion

### Atomic Promote

After verification in staging, artifacts are atomically promoted to final locations:

- Uses atomic rename where possible (Windows)
- Falls back to copy-then-delete if rename fails (e.g., file in use)
- Ensures no half-written files exist in final locations
- All artifacts are promoted in a single pass after all staging writes complete

### Last-Known-Good Snapshots

**Location**: `%APPDATA%\MineAnvil\instances\<instanceId>\.rollback\<timestamp>-<version>\`

Snapshots are created after successful installation:

- Contains a manifest (`snapshot.json`) listing all validated artifacts
- Includes artifact names, paths, and checksums
- Timestamped and versioned for identification
- Used for rollback if recovery fails

**Note**: Snapshots are metadata-only. Actual artifact files remain in their final locations. Rollback would restore from lockfile using snapshot metadata.

### Quarantine

**Location**: `%APPDATA%\MineAnvil\instances\<instanceId>\.quarantine\`

Corrupted files are quarantined instead of deleted:

- Files with checksum mismatches are moved to quarantine
- Quarantine paths include timestamp and artifact name
- Quarantined files are preserved for inspection
- Installation proceeds with fresh download after quarantine

### Recovery Logic

The installer automatically recovers from interrupted installs:

1. **Check Staging**: On startup, checks staging area for recoverable artifacts
2. **Verify Staging**: Validates checksums of staging artifacts
3. **Resume or Reinstall**:
   - If staging artifact is valid: resume from staging (promote directly)
   - If staging artifact is corrupted: remove and reinstall
   - If no staging artifact: install fresh
4. **Recovery Decision**: Logs recovery decision path for troubleshooting

### Installation Planner Updates

**File**: `electron/src/main/install/installPlanner.ts`

The planner now checks staging area:

- Detects artifacts in staging that can be resumed
- Verifies staging artifacts match lockfile checksums
- Marks staging artifacts for promotion instead of reinstall
- Handles corrupted staging artifacts (remove and reinstall)

### Deterministic Installer Updates

**File**: `electron/src/main/install/deterministicInstaller.ts`

The installer now uses staging and recovery:

1. **Recovery Phase**: Checks staging area for recoverable artifacts
2. **Planning**: Uses updated planner that detects staging artifacts
3. **Installation to Staging**: Downloads to staging (or resumes from staging)
4. **Verification**: Verifies checksums in staging
5. **Atomic Promote**: Promotes all staged artifacts atomically
6. **Snapshot**: Creates last-known-good snapshot of validated artifacts
7. **Cleanup**: Removes staging directory after successful promotion

### Path Utilities

**File**: `electron/src/main/paths.ts`

Added utility functions:

- `stagingDir(instanceId)`: Returns staging directory path
- `rollbackDir(instanceId)`: Returns rollback directory path
- `quarantineDir(instanceId)`: Returns quarantine directory path

## Behavior

### Successful Installation

When installation completes successfully:

1. All artifacts downloaded to staging
2. All checksums verified in staging
3. All artifacts promoted atomically to final locations
4. Last-known-good snapshot created
5. Staging directory cleaned up
6. Installation completes successfully

### Interrupted Install Recovery

When MineAnvil is re-run after an interrupted install:

1. **Staging Check**: Detects artifacts in staging area
2. **Verification**: Validates staging artifacts against lockfile
3. **Resume**: If valid, promotes from staging (no re-download)
4. **Reinstall**: If corrupted, removes staging and re-downloads
5. **Continue**: Completes installation of remaining artifacts
6. **Snapshot**: Creates snapshot after successful completion

### Corruption Recovery

When a corrupted artifact is detected:

1. **Detection**: Checksum mismatch during verification
2. **Quarantine**: Moves corrupted file to quarantine directory
3. **Reinstall**: Downloads fresh copy to staging
4. **Promote**: Atomically promotes from staging to final location
5. **Logging**: Logs quarantine action for troubleshooting

### Failure Cases

The installer fails loudly on unrecoverable errors:

- **Staging Recovery Failure**: Clear error if staging recovery fails
- **Promotion Failure**: Clear error if atomic promote fails
- **Snapshot Failure**: Warning logged, but installation continues
- **Network Failures**: Clear error from download layer
- **Lockfile Mismatch**: Clear error (no recovery from lockfile issues)

All failures are logged with structured JSON and shown to the user via error dialog.

## Constraints

### No Lockfile Mutation

The installer **never** modifies the lockfile. It only reads from it.

### No Manifest Mutation

The installer **never** modifies the PackManifest. It only reads from it.

### No Silent Repair

The installer **never** attempts to repair or fix broken installs silently outside the recovery contract. All recovery decisions are logged.

### Controlled Directories Only

All installation writes occur only under:

- `%APPDATA%\MineAnvil\instances\<instanceId>\.minecraft\` — Final Minecraft files
- `%APPDATA%\MineAnvil\instances\<instanceId>\.staging\pack-install\` — Staging area
- `%APPDATA%\MineAnvil\instances\<instanceId>\.rollback\` — Snapshots
- `%APPDATA%\MineAnvil\instances\<instanceId>\.quarantine\` — Quarantined files

No writes occur outside these controlled directories.

### Recovery Contract

Recovery behavior is deterministic:

- **Resume**: If staging artifact is valid, resume from staging
- **Rollback**: If recovery fails, rollback to last-known-good (future enhancement)
- **Fail Clearly**: If recovery is impossible, fail with clear next steps

## Testing

### Clean Windows Machine

1. Start with a clean Windows VM (no `%APPDATA%\MineAnvil`)
2. Ensure PackManifest exists with `minecraftVersion` set
3. Run MineAnvil
4. Verify:
   - Installation completes successfully
   - All artifacts in final locations
   - Staging directory cleaned up
   - Last-known-good snapshot created
   - No writes outside controlled directories

### Interrupted Install Recovery

1. Start installation
2. Kill MineAnvil process mid-download (simulate interruption)
3. Re-launch MineAnvil
4. Verify:
   - Staging artifacts detected
   - Valid staging artifacts resumed (no re-download)
   - Corrupted staging artifacts removed and re-downloaded
   - Installation completes successfully
   - Recovery decision logged

### Scenario B2: Resume from Valid Staging (No Re-download)

**Objective**: Prove that valid staging artifacts are resumed without re-download when MineAnvil is interrupted after staging is complete but before promotion.

**Prerequisites**:
- Client JAR or other large artifact deleted from final location
- Monitor script available: `scripts/validation/monitor-and-kill-download.ps1`

**Steps**:

1. **Prepare**: Delete a large artifact (e.g., client JAR) to force reinstall:
   ```powershell
   $clientJar = "$env:APPDATA\MineAnvil\instances\default\.minecraft\versions\1.21.4\1.21.4.jar"
   Remove-Item $clientJar -Force -ErrorAction SilentlyContinue
   ```

2. **Start monitoring** (in one PowerShell window):
   ```powershell
   pwsh -File scripts\validation\monitor-and-kill-download.ps1 -KillOn "promote" -WaitSeconds 120 -Verbose
   ```
   Or use `-KillOn "verified"` to kill when staging recovery completes with recoverable artifacts.

3. **Launch MineAnvil** (in another window or let the monitor script start it):
   ```powershell
   npm run dev:electron
   ```

4. **Wait for trigger**: The monitor script will kill MineAnvil when:
   - `-KillOn "promote"`: Log shows `"promoting artifacts from staging to final location"`
   - `-KillOn "verified"`: Log shows `"staging recovery complete"` with `recoverableCount > 0`

5. **Verify staging contains complete artifact**:
   ```powershell
   pwsh -File scripts\validation\list-staging.ps1 -Verbose
   ```
   **Pass condition**: Staging contains a full-size artifact (not partial). For client JAR, expect ~27 MB.

6. **Relaunch MineAnvil** normally:
   ```powershell
   npm run dev:electron
   ```

7. **Verify recovery logs**:
   ```powershell
   pwsh -File scripts\validation\parse-recovery-logs.ps1 -Verbose
   ```

**Pass/Fail Evidence Requirements**:

✅ **PASS** if:
- Logs show `"checking staging area for recoverable artifacts"`
- Logs show `"recoverable artifact found in staging"` or `"staging recovery complete"` with `recoverableCount > 0`
- Logs show `"resuming from staging area"` (if recoverable artifacts found)
- Logs show `"promoting artifacts from staging to final location"` (no download before promote)
- Logs do NOT show `"downloading artifact to staging"` for the recovered artifact
- Logs show `"artifact promoted from staging"` for the recovered artifact
- Final location contains the artifact after promotion
- Staging directory is cleaned up after success

❌ **FAIL** if:
- Logs show `"downloading artifact to staging"` for an artifact that exists in staging
- Staging artifact is removed and re-downloaded when it should be valid
- Final location does not contain the artifact after recovery
- Recovery decision is not logged

**Evidence Collection**:
```powershell
# Capture recovery logs
pwsh -File scripts\validation\parse-recovery-logs.ps1 -Verbose | Out-File scenario-b2-recovery-logs.txt

# Capture staging status before recovery
pwsh -File scripts\validation\list-staging.ps1 -Verbose | Out-File scenario-b2-staging-before.txt

# Capture staging status after recovery (should be empty)
# (Run after MineAnvil completes)
pwsh -File scripts\validation\list-staging.ps1 -Verbose | Out-File scenario-b2-staging-after.txt

# Verify final location
$clientJar = "$env:APPDATA\MineAnvil\instances\default\.minecraft\versions\1.21.4\1.21.4.jar"
if (Test-Path $clientJar) {
    $size = (Get-Item $clientJar).Length / 1MB
    "Client JAR exists: $([math]::Round($size, 2)) MB" | Out-File scenario-b2-final-location.txt
} else {
    "Client JAR does not exist" | Out-File scenario-b2-final-location.txt
}
```

### Corruption Recovery

1. Replace a library JAR with junk bytes
2. Re-launch MineAnvil
3. Verify:
   - Corrupted file detected during verification
   - Corrupted file quarantined
   - Fresh copy downloaded to staging
   - Staging artifact promoted atomically
   - Quarantine action logged

### Repeat Run

1. Re-run MineAnvil with no changes
2. Verify:
   - Installer reports "already satisfied"
   - No files are modified (other than logs)
   - `lock.json` is unchanged
   - No staging artifacts (clean state)

### Failure Cases

Test scenarios:

- **Staging Recovery Failure**: Clear error logged
- **Promotion Failure**: Clear error, staging artifacts preserved
- **Snapshot Failure**: Warning logged, installation continues
- **Network Interruption**: Clear error, staging artifacts preserved for next run

Expected behavior: Clear, parent-readable error; recovery attempted; staging preserved for next run.

## Files Changed

- `electron/src/main/paths.ts` — Added staging, rollback, quarantine directory utilities
- `electron/src/main/install/installPlanner.ts` — Updated to detect staging artifacts
- `electron/src/main/install/deterministicInstaller.ts` — Updated to use staging, atomic promote, recovery, quarantine, snapshots
- `electron/src/main/main.ts` — No changes (recovery is automatic in installer)
- `docs/SP2.3-rollback-recovery.md` — This file

## Validation Evidence

### Scenario B2: Resume-from-staging no re-download

**Date/Time**: 2026-01-02 17:45:48  
**Evidence Path**: `prompts/02-evidence/L2/sp2.3-b2/20260102-174043/`

**Summary**: Validation confirmed that when MineAnvil is interrupted after a staging artifact is fully downloaded and verified, the next run successfully resumes from staging without re-download. All checks passed: staging area was checked, artifact was resumed from staging, artifacts were promoted atomically, staging directory was cleaned up, no re-download occurred, final jar exists, and both manifest and lockfile remained immutable. Recovery decision path was logged throughout the process.

**Proven Checklist Items**:
- ✅ Installation writes occur in staging area first
- ✅ All artifacts are verified in staging before promotion
- ✅ Artifacts are atomically promoted from staging to final locations
- ✅ Staging directory is cleaned up after successful promotion
- ✅ If install is interrupted, next run checks staging area for recoverable artifacts
- ✅ Valid staging artifacts are resumed (promoted directly, no re-download)
- ✅ Recovery decision is logged for troubleshooting
- ✅ Rollback and recovery never mutate PackManifest
- ✅ Rollback and recovery never rewrite lock.json
- ✅ Recovery is automatic on startup (no manual intervention required)
- ✅ Installation planner detects staging artifacts
- ✅ Deterministic installer handles staging, promote, recovery

### Final Validation: Snapshots and Remaining Scenarios

**Date/Time**: 2026-01-02 18:02:00  
**Evidence Path**: `prompts/02-evidence/L2/sp2.3-final/20260102-180200/`

**Summary**: Validation of snapshot creation and structure, plus preparation for remaining manual validation scenarios.

**Proven Checklist Items**:
- ✅ Last-known-good snapshot exists for validated artifacts (6 snapshots found)
- ✅ Snapshot contains manifest of validated artifacts (names, paths, checksums verified)
- ✅ Snapshots are created after successful installation (timestamps match installs)

**Pending Manual Validation** (see `VALIDATION-GUIDE.md` for instructions):
- ⏳ Corrupted staging artifacts are removed and re-downloaded (Scenario A)
- ⏳ Corrupted files are quarantined instead of deleted (Scenario B)
- ⏳ Quarantined files are preserved for inspection (Scenario B)
- ⏳ Quarantine action is logged for troubleshooting (Scenario B)
- ⏳ If recovery fails, fails with clear, user-visible message that includes next steps (Scenario D)
- ⏳ All recovery decisions are based solely on lockfile contents (needs log verification)
- ⏳ Logs include enough info to diagnose recovery decisions (needs review)

## Notes

- Staging area ensures no half-written files in final locations
- Atomic promote ensures consistency
- Recovery enables safe resume from interruptions
- Quarantine preserves corrupted files for inspection
- Snapshots enable rollback (future enhancement)
- All recovery decisions are logged for troubleshooting
- All logs are structured JSON, secret-free, and suitable for troubleshooting

