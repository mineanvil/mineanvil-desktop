# Lockfile-only Authority Validation

**Date**: 2026-01-02 20:50:11  
**Instance**: default  
**Log File**: C:\Users\admin\AppData\Roaming\MineAnvil\instances\default\logs\mineanvil-main.log  
**Evidence Directory**: C:\Users\admin\Development\MineAnvil\mineanvil-desktop\prompts\02-evidence\L2\sp2.3-final\20260102-205008

## Results

| Check | Status | Evidence |
|-------|--------|----------|
| Recovery decision logs found | âœ… PASS | 2 log entry(ies) |
| All decisions use lockfile authority | âœ… PASS | 2 / 2 entries |
| No remote metadata used | âœ… PASS | 2 / 2 entries |
| Expected values from lockfile | âœ… PASS | All entries include meta.expected from lockfile |
| Observed values from filesystem | âœ… PASS | All entries include meta.observed from filesystem |

## Decision Types Found

- ****: 2 occurrence(s)

## Evidence Files

- lockfile-only-recovery-decisions-raw.txt - Raw JSON log entries
- lockfile-only-recovery-decisions-formatted.txt - Formatted decision entries with metadata
- lockfile-only-authority-validation-summary.md - This file

## Validation

To verify lockfile-only authority, check that:
1. All recovery decision logs include meta.authority = "lockfile"
2. All recovery decision logs include meta.remoteMetadataUsed = false
3. All logs include meta.expected with values from lockfile artifact
4. All logs include meta.observed with values computed from local filesystem

## Conclusion

âœ… **PASS**: All recovery decisions are based solely on lockfile contents. No remote metadata is used.
