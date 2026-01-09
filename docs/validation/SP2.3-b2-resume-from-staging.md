# SP2.3 Validation B2: Resume From Staging (No Re-Download)

**Stop Point**: 2.3 — Rollback & Recovery  
**Scenario**: B2 — Resume from staging without re-download  
**Validation Type**: Evidence Capture

---

## Operator Steps

### Prerequisites
- MineAnvil repository checked out
- PowerShell (pwsh) available
- Node.js and npm available
- Clean instance state (or willing to delete final jar)

### Phase 1: Create Staging Artifact and Kill Before Promote

1. Open PowerShell in the repository root
2. Run the orchestrator script:
   ```powershell
   pwsh -ExecutionPolicy Bypass -File scripts/validation/sp2.3-b2-run.ps1 -InstanceId default -McVersion 1.21.4 -Verbose -vvv
   ```
3. The script will:
   - Stop any running MineAnvil processes
   - Delete the final client jar (`1.21.4.jar`)
   - Start MineAnvil
   - Monitor logs and wait for staging file to be full size
   - Kill MineAnvil before promotion occurs
   - Capture evidence to `evidence/sp2.3-b2/<timestamp>/`
4. Wait for the script to complete
5. Note the evidence directory path shown at the end

### Phase 2: Resume and Verify

1. Run MineAnvil again:
   ```powershell
   npm run dev:electron
   ```
2. Wait for installation to complete (MineAnvil should resume from staging)
3. Close MineAnvil
4. Run the assertion script (use the evidence directory from Phase 1):
   ```powershell
   pwsh -ExecutionPolicy Bypass -File scripts/validation/sp2.3-b2-assert.ps1 -InstanceId default -McVersion 1.21.4 -EvidenceDir "evidence/sp2.3-b2/<timestamp>" -Verbose -vvv
   ```
5. Review the validation summary in the evidence directory

---

## What PASS Looks Like

### Phase 1 Success Criteria
- ✅ Final jar is deleted
- ✅ MineAnvil starts and begins installation
- ✅ Staging file is created and reaches full size (~27MB for 1.21.4.jar)
- ✅ MineAnvil is killed before promotion
- ✅ Final jar does NOT exist after kill
- ✅ Staging directory contains the client jar

### Phase 2 Success Criteria
- ✅ Log contains "checking staging area for recoverable artifacts"
- ✅ Log contains "resuming artifact from staging" for the client jar
- ✅ Log contains "promoting artifacts from staging to final location"
- ✅ Log contains "staging directory cleaned up"
- ✅ Log does NOT contain "downloading artifact to staging" for the client jar (no re-download)
- ✅ Final jar exists after resume
- ✅ Staging directory is empty or removed after cleanup
- ✅ Manifest and lockfile exist (immutability verified by git)

---

## Evidence Pack Contents

The evidence directory (`evidence/sp2.3-b2/<timestamp>/`) contains:

### Filesystem Evidence
- `staging-before.txt` - Staging directory listing before Phase 1
- `staging-after.txt` - Staging directory listing after Phase 1 (kill)
- `staging-after-resume.txt` - Staging directory listing after Phase 2 (resume)
- `final-jar-check.txt` - Final jar existence check after Phase 1
- `final-jar-check-after-resume.txt` - Final jar existence check after Phase 2

### Log Evidence
- `log-excerpts-phase1.txt` - All relevant log entries from Phase 1
- `recovery-log-excerpts.txt` - Recovery-related log entries from Phase 2
- `resume-log-excerpts.txt` - Resume-specific log entries from Phase 2
- `download-log-excerpts.txt` - Download log entries (should be empty for B2)

### Immutability Checks
- `immutability-checks.txt` - Manifest and lockfile hash checks

### Summary
- `validation-summary.md` - Complete validation summary with results table

---

## Expected Log Signals

### Recovery Phase
```
{"ts":"...","level":"info","area":"install.deterministic","message":"checking staging area for recoverable artifacts",...}
```

### Resume Phase
```
{"ts":"...","level":"info","area":"install.deterministic","message":"resuming artifact from staging","meta":{"name":"1.21.4.jar","kind":"client",...}}
```

### Promotion Phase
```
{"ts":"...","level":"info","area":"install.deterministic","message":"promoting artifacts from staging to final location","meta":{"stagedCount":1,...}}
```

### Cleanup Phase
```
{"ts":"...","level":"debug","area":"install.deterministic","message":"staging directory cleaned up"}
```

### Absence Check (Should NOT appear for client jar on resume)
```
{"ts":"...","level":"info","area":"install.deterministic","message":"downloading artifact to staging","meta":{"name":"1.21.4.jar","kind":"client",...}}
```

---

## Failure Cases

### Staging is Partial
- **Symptom**: Staging file size < expected minimum (~25MB)
- **Action**: Script should detect and mark "B2 not ready", advise rerun
- **Resolution**: Wait longer before killing, or check network/download issues

### Promotion Already Happened
- **Symptom**: Final jar exists, staging absent after Phase 1
- **Action**: Script marks "killed too late"
- **Resolution**: Kill earlier, or check timing in logs

### Logs Rotated
- **Symptom**: Recovery signals not found in current log
- **Action**: Script should search rotated logs or widen lookback window
- **Resolution**: Check for rotated log files in logs directory

### Re-Download Occurred
- **Symptom**: "downloading artifact to staging" found in Phase 2 logs
- **Action**: Validation fails, evidence captured
- **Resolution**: Check why staging recovery didn't work (corruption, checksum mismatch, etc.)

---

## Validation Report Template

After running both phases, the `validation-summary.md` file will contain:

```markdown
# SP2.3 Validation B2: Resume From Staging (No Re-Download)

**Date**: YYYY-MM-DD HH:MM:SS  
**Instance**: default  
**Minecraft Version**: 1.21.4

## Results

| Check | Status | Evidence |
|-------|--------|----------|
| Checking staging area | ✅ PASS | Log entry found |
| Resuming artifact from staging | ✅ PASS | Log entry found |
| Promoting artifacts from staging | ✅ PASS | Log entry found |
| Staging directory cleaned up | ✅ PASS | Log entry found |
| No re-download occurred | ✅ PASS | No download logs found |
| Final jar exists | ✅ PASS | File exists |
| Manifest immutability | ✅ PASS | Hash: ... |
| Lockfile immutability | ✅ PASS | Hash: ... |

## Conclusion

✅ **PASS**: All checks passed. Resume from staging occurred without re-download.
```

Copy this summary into `docs/SP2.3-rollback-recovery.md` or a dedicated validation report file.

---

## Notes

- This validation does NOT modify STOP_POINTS.md
- This validation does NOT change core installer logic
- Evidence is captured read-only (no files are modified)
- All scripts are read-only except for evidence directory creation
- Immutability checks verify existence; actual immutability is enforced by git

---

## Related Files

- `scripts/validation/sp2.3-b2-run.ps1` - Phase 1 orchestrator
- `scripts/validation/sp2.3-b2-assert.ps1` - Phase 2 assertion script
- `scripts/validation/parse-recovery-logs.ps1` - Log parser (read-only helper)
- `electron/src/main/install/deterministicInstaller.ts` - Core installer logic
- `docs/SP2.3-rollback-recovery.md` - Stop Point 2.3 documentation




