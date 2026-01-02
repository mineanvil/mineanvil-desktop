# Scenario B: Quarantine Corrupted Final Artifact

**Date**: 2026-01-02 19:36:49  
**Instance**: default  
**Library**: library-com-fasterxml-jackson-core-jackson-core-2-13-4

## Results

| Check | Status | Evidence |
|-------|--------|----------|
| Checksum mismatch detected | âœ… PASS | 4 log entry(ies) found |
| File quarantined | âœ… PASS | File found in quarantine directory |
| Quarantine action logged | âœ… PASS | 2 log entry(ies) found |
| Artifact re-downloaded | âœ… PASS | 4 download log(s) found |
| Artifact promoted | âœ… PASS | 4 promotion log(s) found |
| Artifact restored | âœ… PASS | File exists |
| Checksum matches | âœ… PASS | Size matches expected |

## Evidence Files

- scenario-b-quarantine-before.txt - Quarantine state before corruption
- scenario-b-quarantine-after.txt - Quarantine state after recovery
- scenario-b-artifact-before.txt - Artifact state before corruption
- scenario-b-artifact-after-corruption.txt - Artifact state after corruption
- scenario-b-artifact-after-recovery.txt - Artifact state after recovery
- scenario-b-checksum-logs.txt - Checksum mismatch log entries
- scenario-b-quarantine-logs.txt - Quarantine action log entries
- scenario-b-download-logs.txt - Download log entries
- scenario-b-promotion-logs.txt - Promotion log entries
- scenario-b-library-info.json - Library artifact information

## Conclusion

âœ… **PASS**: All checks passed. Corrupted final artifact was detected, quarantined, re-downloaded, and restored with correct checksum.

