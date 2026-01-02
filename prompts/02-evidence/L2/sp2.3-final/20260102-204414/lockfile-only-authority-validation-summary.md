# Lockfile-only Authority Validation

**Date**: 2026-01-02 20:44:17  
**Instance**: default  
**Log File**: C:\Users\admin\AppData\Roaming\MineAnvil\instances\default\logs\mineanvil-main.log  
**Evidence Directory**: C:\Users\admin\Development\MineAnvil\mineanvil-desktop\prompts\02-evidence\L2\sp2.3-final\20260102-204414

## Results

| Check | Status | Evidence |
|-------|--------|----------|
| Recovery decision logs found | âŒ FAIL | 0 log entry(ies) |
| All decisions use lockfile authority | âŒ FAIL | 0 / 0 entries |
| No remote metadata used | âŒ FAIL | 0 / 0 entries |
| Expected values from lockfile | âŒ FAIL | All entries include meta.expected from lockfile |
| Observed values from filesystem | âŒ FAIL | All entries include meta.observed from filesystem |

## Decision Types Found

None found

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

âš ï¸ **NO EVIDENCE**: No recovery decision logs found. Run MineAnvil with a recovery scenario (corrupt a file) to generate evidence.
