# Scenario: Corrupt Snapshot Manifest

**Status**: ✅ PASS
**Exit Code**: 1
**Started**: 2026-01-03 18:33:16

## Results

- Lockfile changed: ✅ NO
- Manifest changed: ✅ NO
- Log metadata authority: SKIPPED (rollback not executed)
- Log metadata remoteMetadataUsed: SKIPPED (rollback not executed)

- Artifact restored: ✅ YES (SHA256 matches original)
  - Path: `C:\Users\admin\AppData\Roaming\MineAnvil\instances\default\.minecraft\versions\1.21.11\1.21.11.jar`
  - Source: client_jar_candidate
  - Original SHA256: `1473C9489AC50FDA...`
  - Restored SHA256: `1473C9489AC50FDA...`

## Errors

## Files

- Console output: `console.txt`
- Log extract: `rollback-log-extract.txt`
- Pre-hashes: `pre-hashes.txt`
- Post-hashes: `post-hashes.txt`
- Directory trees: `dir-tree-before.txt`, `dir-tree-after.txt`
- Directory listings: `quarantine-list.txt`, `staging-list.txt`, `rollback-list.txt`