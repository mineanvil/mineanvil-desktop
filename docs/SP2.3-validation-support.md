# Stop Point 2.3 — Validation Support

## Stop Point Targeted

**Stop Point 2.3 — Rollback & Recovery**

This document provides validation support materials to assist operators in verifying SP2.3 implementation.

---

## 1. Static Code Path Analysis

### File: `electron/src/main/paths.ts`

**Functions Added:**
- `stagingDir(instanceId)`: Returns `%APPDATA%\MineAnvil\instances\<instanceId>\.staging\pack-install\`
- `rollbackDir(instanceId)`: Returns `%APPDATA%\MineAnvil\instances\<instanceId>\.rollback\`
- `quarantineDir(instanceId)`: Returns `%APPDATA%\MineAnvil\instances\<instanceId>\.quarantine\`

**Evidence:** These functions are exported and used by the installer.

---

### File: `electron/src/main/install/installPlanner.ts`

**Key Functions:**

1. **`checkArtifact(artifact, instanceId)`** (lines 102-171)
   - Checks final location first (priority)
   - If final exists and is valid: returns `{ installed: true, verified: true, inStaging: false }`
   - If final doesn't exist, checks staging area
   - If staging exists and is valid: returns `{ installed: false, verified: false, inStaging: true }`
   - If staging is corrupted: returns `{ installed: false, verified: false, inStaging: false }`
   - **Log signals:**
     - `"artifact check (final location)"` - when final file exists
     - `"artifact found in staging and verified"` - when staging artifact is valid
     - `"artifact found in staging but corrupted"` - when staging artifact is invalid
     - `"artifact not found"` - when neither exists

2. **`planInstallation(lockfile, instanceId)`** (lines 179-235)
   - Calls `checkArtifact` for each artifact
   - Creates `ArtifactPlan` with `needsInstall`, `needsVerification`, `inStaging` flags
   - **Log signals:**
     - `"planning installation from lockfile"` - start of planning
     - `"installation plan complete"` - end of planning with counts

**Filesystem Evidence:**
- Planner checks staging directory structure
- Planner verifies checksums in staging before marking as recoverable

---

### File: `electron/src/main/install/deterministicInstaller.ts`

**Key Functions:**

1. **`recoverFromStaging(lockfile, instanceId)`** (lines 442-506)
   - Checks if staging directory exists
   - For each artifact, checks staging path and verifies checksum
   - Returns list of recoverable artifacts
   - **Log signals:**
     - `"checking staging area for recoverable artifacts"` - start of recovery
     - `"recoverable artifact found in staging"` - valid staging artifact (debug)
     - `"corrupted staging artifact removed"` - invalid staging artifact (warn)
     - `"staging recovery complete"` - end of recovery with count

2. **`installArtifactToStaging(artifact, instanceId)`** (lines 248-316)
   - Downloads artifact to staging path
   - Verifies checksum in staging
   - **Log signals:**
     - `"downloading artifact to staging"` - download start
     - `"artifact installation to staging failed"` - download/verify failure (error)

3. **`promoteArtifact(artifact, stagingPath, instanceId)`** (lines 322-427)
   - Checks if final file exists and is corrupted
   - Quarantines corrupted final files
   - Atomically promotes from staging to final
   - Extracts natives after promote
   - **Log signals:**
     - `"corrupted artifact detected, quarantining"` - quarantine action (warn)
     - `"artifact already valid, skipping promote"` - final file valid (debug)
     - `"artifact promoted from staging"` - successful promote (info)

4. **`quarantineFile(filePath, artifact, instanceId)`** (lines 92-127)
   - Moves corrupted file to quarantine directory
   - **Log signals:**
     - `"artifact quarantined"` - successful quarantine (warn)
     - `"artifact quarantined (via copy)"` - quarantine via copy (warn)
     - `"failed to quarantine artifact"` - quarantine failure (error)

5. **`createLastKnownGoodSnapshot(lockfile, validatedArtifacts, instanceId)`** (lines 132-175)
   - Creates snapshot directory with timestamp
   - Writes `snapshot.json` manifest
   - **Log signals:**
     - `"last-known-good snapshot created"` - successful snapshot (info)
     - `"failed to create snapshot"` - snapshot failure (error)

6. **`installFromLockfile(lockfile, instanceId)`** (lines 523-684)
   - Main installation function
   - Calls recovery, planning, installation, promotion, snapshot creation
   - **Log signals:**
     - `"starting deterministic installation from lockfile"` - start
     - `"resuming from staging area"` - recovery found artifacts (info)
     - `"resuming artifact from staging"` - individual artifact resume (info)
     - `"installing artifact to staging"` - new download (info)
     - `"verifying artifact"` - verification phase (info)
     - `"corrupted artifact detected during verification, quarantining and reinstalling"` - corruption during verify (warn)
     - `"promoting artifacts from staging to final location"` - promote phase start (info)
     - `"staging directory cleaned up"` - cleanup (debug)
     - `"deterministic installation complete"` - success with counts (info)

**Filesystem Evidence:**
- Staging directory: `.staging/pack-install/` with artifact files
- Final locations: `.minecraft/` with promoted files
- Quarantine directory: `.quarantine/` with timestamped corrupted files
- Rollback directory: `.rollback/<timestamp>-<version>/` with `snapshot.json`

---

## 2. Validation Mapping Table

| Checklist Item | Trigger | Log Evidence | Filesystem Evidence | Operator Action |
|---------------|---------|--------------|---------------------|-----------------|
| Installation writes occur in staging area first | Fresh install | `"downloading artifact to staging"` | Files exist in `.staging/pack-install/.minecraft/...` | Run fresh install, check staging before completion |
| All artifacts are verified in staging before promotion | Download completes | `"artifact checksum verified"` (debug, if verbose) | Staging files match lockfile checksums | Enable verbose logging, verify checksums manually |
| Artifacts are atomically promoted from staging to final locations | After all staging writes complete | `"promoting artifacts from staging to final location"` then `"artifact promoted from staging"` | Files appear in final location, staging files removed | Monitor staging during install, verify atomicity |
| Staging directory is cleaned up after successful promotion | After all promotes complete | `"staging directory cleaned up"` (debug) | `.staging/pack-install/` directory removed | Check staging directory after successful install |
| If install is interrupted, next run checks staging area | Startup with staging present | `"checking staging area for recoverable artifacts"` | Staging directory exists with files | Kill process mid-install, restart, check logs |
| Valid staging artifacts are resumed (promoted directly, no re-download) | Recovery finds valid staging | `"resuming from staging area"` then `"resuming artifact from staging"` | Staging files promoted without re-download | Kill process mid-download, restart, verify no re-download |
| Corrupted staging artifacts are removed and re-downloaded | Recovery finds corrupted staging | `"corrupted staging artifact removed"` (warn) then `"installing artifact to staging"` | Corrupted staging file removed, new download occurs | Corrupt staging file manually, restart, verify re-download |
| Recovery decision is logged for troubleshooting | Any recovery scenario | `"staging recovery complete"` with `recoverableCount` | Logs show recovery decision path | Review logs after recovery scenario |
| If recovery fails, fails with clear, user-visible message | Recovery error | Error dialog + `"Failed to recover from staging: ..."` | Error shown to user | Simulate recovery failure, verify error message |
| Last-known-good snapshot exists for validated artifacts | After successful install | `"last-known-good snapshot created"` with `snapshotId` | `.rollback/<timestamp>-<version>/snapshot.json` exists | Complete install, check rollback directory |
| Snapshot contains manifest of validated artifacts | Snapshot created | Snapshot JSON contains `artifacts` array with names, paths, checksums | `snapshot.json` readable, contains artifact list | Read snapshot.json file |
| Snapshots are created after successful installation | Install completes | `"last-known-good snapshot created"` before `"deterministic installation complete"` | Snapshot directory created with timestamp | Complete install, verify snapshot timestamp |
| Corrupted files are quarantined instead of deleted | Corruption detected | `"corrupted artifact detected, quarantining"` or `"artifact quarantined"` | File moved to `.quarantine/<timestamp>-<name>` | Corrupt a file, restart, check quarantine |
| Quarantined files are preserved for inspection | Quarantine action | Quarantine directory contains timestamped files | Files exist in quarantine with original names | Inspect quarantine directory contents |
| Quarantine action is logged for troubleshooting | Quarantine occurs | `"artifact quarantined"` with `name`, `originalPath`, `quarantinePath` | Logs show quarantine details | Review logs after corruption |
| Rollback and recovery never mutate PackManifest | Any operation | No writes to manifest file | `pack/manifest.json` unchanged | Verify manifest file timestamp |
| Rollback and recovery never rewrite lock.json | Any operation | No writes to lockfile | `pack/lock.json` unchanged | Verify lockfile file timestamp |
| All recovery decisions are based solely on lockfile contents | Recovery operations | Logs reference lockfile checksums, not remote metadata | Recovery uses lockfile checksums | Verify recovery uses lockfile |
| All logging remains structured and secret-free | Any operation | All logs are JSON with no secrets | Log files contain structured JSON | Review log files |
| Logs include enough info to diagnose recovery decisions | Recovery scenarios | Logs show recovery decision path with artifact names | Logs contain recovery context | Review logs after recovery |
| Recovery decision path is logged (resume/rollback/fail) | Recovery operations | `"resuming from staging area"` or `"staging recovery complete"` with counts | Logs show decision path | Review logs for decision path |
| Recovery is automatic on startup (no manual intervention) | Startup | Recovery happens automatically in `installFromLockfile` | No manual steps required | Restart after interruption |
| Installation planner detects staging artifacts | Planning phase | `"artifact found in staging and verified"` (debug) | Planner checks staging paths | Enable verbose logging |
| Deterministic installer handles staging, promote, recovery, quarantine, snapshots | All operations | Multiple log signals for each operation type | Filesystem evidence for each operation | Complete full install cycle |

---

## 3. Helper Scripts

See `scripts/validation/` directory for read-only validation helper scripts.

---

## 4. Failure Injection Guidance

### Interrupted Install Mid-Download

**Operator Action:**
1. Start MineAnvil installation
2. Wait for download to start (observe logs showing `"downloading artifact to staging"`)
3. Kill MineAnvil process (Task Manager or `taskkill /F /IM MineAnvil.exe`)
4. Verify staging directory contains partial files: `%APPDATA%\MineAnvil\instances\default\.staging\pack-install\`
5. Re-launch MineAnvil

**Expected System Behavior:**
- On startup, logs show `"checking staging area for recoverable artifacts"`
- If staging files are valid: `"resuming from staging area"` with count, then `"resuming artifact from staging"` for each
- If staging files are corrupted: `"corrupted staging artifact removed"` then `"installing artifact to staging"` (re-download)
- Installation completes successfully
- Staging directory cleaned up after promotion

**Evidence:**
- Logs show recovery decision
- Staging files either promoted (if valid) or removed and re-downloaded (if corrupted)
- Final installation completes

---

### Valid Staging Artifact Resume

**Operator Action:**
1. Complete a partial install (some artifacts in staging)
2. Ensure staging artifacts are valid (match lockfile checksums)
3. Re-launch MineAnvil

**Expected System Behavior:**
- Logs show `"resuming from staging area"` with `recoverableCount > 0`
- Logs show `"resuming artifact from staging"` for each recoverable artifact
- No `"downloading artifact to staging"` for recovered artifacts
- Artifacts promoted directly from staging
- Installation completes

**Evidence:**
- Logs show resume actions, not downloads
- Staging files promoted without re-download
- Network activity only for non-recoverable artifacts

---

### Corrupt Artifact Quarantine

**Operator Action:**
1. Complete a successful install
2. Corrupt a library JAR: Replace file contents with junk bytes
3. Re-launch MineAnvil

**Expected System Behavior:**
- During verification, logs show `"corrupted artifact detected during verification, quarantining and reinstalling"`
- Corrupted file moved to `.quarantine/<timestamp>-<name>`
- Logs show `"artifact quarantined"` with quarantine path
- Fresh copy downloaded to staging
- Staging artifact promoted to final location
- Installation completes

**Evidence:**
- Quarantine directory contains corrupted file with timestamp
- Logs show quarantine action
- Fresh file in final location with correct checksum
- Quarantine file preserved for inspection

---

### Snapshot Creation After Success

**Operator Action:**
1. Complete a successful installation
2. Check rollback directory

**Expected System Behavior:**
- Logs show `"last-known-good snapshot created"` with `snapshotId` and `artifactCount`
- Rollback directory contains `<timestamp>-<version>/` directory
- Snapshot directory contains `snapshot.json` with manifest
- Snapshot manifest lists all validated artifacts with names, paths, checksums

**Evidence:**
- Rollback directory exists with timestamped snapshot
- `snapshot.json` readable and contains artifact manifest
- Snapshot timestamp matches installation completion time
- All validated artifacts listed in snapshot

---

## 5. Evidence Checklist

This checklist corresponds 1:1 with `docs/STOP_POINTS.md` SP2.3 section.

### Staging & Atomic Promote

- [ ] **Installation writes occur in staging area first**
  - Evidence: Files exist in `.staging/pack-install/.minecraft/...` during install
  - Log: `"downloading artifact to staging"`
  - Script: `scripts/validation/list-staging.ps1`

- [ ] **All artifacts are verified in staging before promotion**
  - Evidence: Staging files match lockfile checksums (verify manually or with script)
  - Log: `"artifact checksum verified"` (debug, if verbose enabled)
  - Script: `scripts/validation/verify-staging-checksums.ps1`

- [ ] **Artifacts are atomically promoted from staging to final locations**
  - Evidence: Files appear in final location, staging files removed atomically
  - Log: `"promoting artifacts from staging to final location"` then `"artifact promoted from staging"`
  - Script: `scripts/validation/check-atomic-promote.ps1`

- [ ] **Staging directory is cleaned up after successful promotion**
  - Evidence: `.staging/pack-install/` directory removed after install
  - Log: `"staging directory cleaned up"` (debug)
  - Script: `scripts/validation/list-staging.ps1` (should return empty)

### Recovery from Interruption

- [ ] **If install is interrupted, next run checks staging area**
  - Evidence: Logs show recovery check on startup
  - Log: `"checking staging area for recoverable artifacts"`
  - Action: Kill process mid-install, restart, check logs

- [ ] **Valid staging artifacts are resumed (promoted directly, no re-download)**
  - Evidence: Staging files promoted without network activity
  - Log: `"resuming from staging area"` then `"resuming artifact from staging"`
  - Action: Kill process mid-download, restart, verify no re-download

- [ ] **Corrupted staging artifacts are removed and re-downloaded**
  - Evidence: Corrupted staging file removed, new download occurs
  - Log: `"corrupted staging artifact removed"` (warn) then `"installing artifact to staging"`
  - Action: Corrupt staging file manually, restart, verify re-download

- [ ] **Recovery decision is logged for troubleshooting**
  - Evidence: Logs show recovery decision path
  - Log: `"staging recovery complete"` with `recoverableCount`
  - Script: `scripts/validation/parse-recovery-logs.ps1`

- [ ] **If recovery fails, fails with clear, user-visible message**
  - Evidence: Error dialog shown to user
  - Log: `"Failed to recover from staging: ..."`
  - Action: Simulate recovery failure, verify error message

### Last-Known-Good Snapshots

- [ ] **Last-known-good snapshot exists for validated artifacts**
  - Evidence: `.rollback/<timestamp>-<version>/snapshot.json` exists
  - Log: `"last-known-good snapshot created"` with `snapshotId`
  - Script: `scripts/validation/list-snapshots.ps1`

- [ ] **Snapshot contains manifest of validated artifacts**
  - Evidence: `snapshot.json` contains `artifacts` array with names, paths, checksums
  - Log: Snapshot created with `artifactCount`
  - Script: `scripts/validation/read-snapshot.ps1`

- [ ] **Snapshots are created after successful installation**
  - Evidence: Snapshot timestamp matches installation completion
  - Log: `"last-known-good snapshot created"` before `"deterministic installation complete"`
  - Script: `scripts/validation/list-snapshots.ps1`

### Quarantine

- [ ] **Corrupted files are quarantined instead of deleted**
  - Evidence: File moved to `.quarantine/<timestamp>-<name>`
  - Log: `"corrupted artifact detected, quarantining"` or `"artifact quarantined"`
  - Script: `scripts/validation/list-quarantine.ps1`

- [ ] **Quarantined files are preserved for inspection**
  - Evidence: Files exist in quarantine with original names
  - Log: Quarantine path logged
  - Script: `scripts/validation/list-quarantine.ps1`

- [ ] **Quarantine action is logged for troubleshooting**
  - Evidence: Logs show quarantine details
  - Log: `"artifact quarantined"` with `name`, `originalPath`, `quarantinePath`
  - Script: `scripts/validation/parse-quarantine-logs.ps1`

### Immutability

- [ ] **Rollback and recovery never mutate PackManifest**
  - Evidence: `pack/manifest.json` file timestamp unchanged
  - Log: No writes to manifest file
  - Script: `scripts/validation/check-manifest-immutability.ps1`

- [ ] **Rollback and recovery never rewrite lock.json**
  - Evidence: `pack/lock.json` file timestamp unchanged
  - Log: No writes to lockfile
  - Script: `scripts/validation/check-lockfile-immutability.ps1`

- [ ] **All recovery decisions are based solely on lockfile contents**
  - Evidence: Recovery uses lockfile checksums, not remote metadata
  - Log: Recovery references lockfile checksums
  - Script: `scripts/validation/verify-recovery-source.ps1`

### Logging

- [ ] **All logging remains structured and secret-free**
  - Evidence: Log files contain structured JSON, no secrets
  - Log: All logs are JSON format
  - Script: `scripts/validation/check-log-format.ps1`

- [ ] **Logs include enough info to diagnose recovery decisions**
  - Evidence: Logs contain recovery context with artifact names
  - Log: Recovery logs show decision path
  - Script: `scripts/validation/parse-recovery-logs.ps1`

- [ ] **Recovery decision path is logged (resume/rollback/fail)**
  - Evidence: Logs show decision path clearly
  - Log: `"resuming from staging area"` or `"staging recovery complete"` with counts
  - Script: `scripts/validation/parse-recovery-logs.ps1`

### Integration

- [ ] **Recovery is automatic on startup (no manual intervention)**
  - Evidence: Recovery happens automatically, no manual steps
  - Log: Recovery logs appear on startup
  - Action: Restart after interruption, verify automatic recovery

- [ ] **Installation planner detects staging artifacts**
  - Evidence: Planner checks staging paths
  - Log: `"artifact found in staging and verified"` (debug, if verbose)
  - Action: Enable verbose logging, verify planner checks staging

- [ ] **Deterministic installer handles staging, promote, recovery, quarantine, snapshots**
  - Evidence: All operations occur during install
  - Log: Multiple log signals for each operation type
  - Action: Complete full install cycle, verify all operations

---

## Explicit Confirmation

- ✅ **No STOP_POINTS.md items were modified** - This document only provides validation support
- ✅ **No future-layer work performed** - Only validation support materials created
- ✅ **No code changes made** - Only inspection and documentation
- ✅ **Only read-only helper scripts created** - Scripts in `scripts/validation/` are read-only

