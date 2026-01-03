# Rollback Evidence Collection Summary

**Date**: 2026-01-03 18:33:22
**Instance**: default
**Snapshot**: latest (auto-select)
**Evidence Directory**: `C:\Users\admin\Development\MineAnvil\mineanvil-desktop\prompts\02-evidence\L2\sp2.3-rollback-execution\20260103-183226`

## Results

| Scenario | Status | Exit Code | Summary |
|----------|--------|-----------|---------|
| Happy Path | ✅ PASS | 0 | [summary.md](scenario-01-happy/summary.md) |
| No Snapshots | ✅ PASS (expected) | 1 | [summary.md](scenario-02-no-snapshots/summary.md) |
| Corrupt Snapshot Manifest | ✅ PASS (expected) | 1 | [summary.md](scenario-03-corrupt-snapshot-manifest/summary.md) |
| Snapshot Checksum Mismatch | ✅ PASS (expected) | 1 | [summary.md](scenario-04-snapshot-checksum-mismatch/summary.md) |
| Promote Failure Simulated | ✅ PASS (expected) | 1 | [summary.md](scenario-05-promote-failure-simulated/summary.md) |

**Total**: 5 scenarios, 5 passed, 0 failed

## Evidence Files

Each scenario folder contains:
- `console.txt` - Full stdout/stderr output
- `rollback-log-extract.txt` - Filtered rollback log events
- `pre-hashes.txt` - SHA256 hashes of lock.json and manifest before
- `post-hashes.txt` - SHA256 hashes of lock.json and manifest after
- `dir-tree-before.txt` - Directory tree before rollback
- `dir-tree-after.txt` - Directory tree after rollback
- `quarantine-list.txt` - Quarantine directory listing
- `staging-list.txt` - Staging directory listing
- `rollback-list.txt` - Rollback directory listing
- `summary.json` - Machine-readable summary
- `summary.md` - Human-readable summary

## Command Used

```powershell
powershell -ExecutionPolicy Bypass -File scripts/validation/capture-rollback-evidence.ps1 -InstanceId default  
```