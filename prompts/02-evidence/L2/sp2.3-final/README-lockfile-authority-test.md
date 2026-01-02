# Lockfile-only Authority Runtime Evidence Test

## Quick Test Instructions

1. **File is already corrupted** (if you ran the setup script)
   - Client JAR at `%APPDATA%\MineAnvil\instances\default\.minecraft\versions\1.21.4\1.21.4.jar` has been corrupted

2. **Run MineAnvil**:
   ```powershell
   npm run dev:electron
   ```

3. **Wait for recovery to complete** - MineAnvil should:
   - Detect the corrupted file
   - Quarantine it
   - Re-download it
   - Verify it against lockfile
   - Promote it

4. **Parse evidence**:
   ```powershell
   .\scripts\validation\parse-lockfile-authority-logs.ps1
   ```

5. **Check evidence directory**:
   - Evidence will be in `prompts/02-evidence/L2/sp2.3-final/<timestamp>/`
   - Look for `lockfile-only-authority-validation-summary.md`

## What to Look For

The evidence should show:
- ✅ Recovery decision logs with `meta.authority = "lockfile"`
- ✅ All logs with `meta.remoteMetadataUsed = false`
- ✅ `meta.expected` values from lockfile
- ✅ `meta.observed` values from filesystem

## Automated Test Script

For a complete automated test:
```powershell
.\scripts\validation\test-lockfile-authority.ps1
```

Then after running MineAnvil:
```powershell
.\scripts\validation\test-lockfile-authority.ps1 -ParseOnly
```

## Manual Test Steps

If you want to test manually:

1. **Corrupt a file**:
   ```powershell
   $jar = "$env:APPDATA\MineAnvil\instances\default\.minecraft\versions\1.21.4\1.21.4.jar"
   $bytes = [System.IO.File]::ReadAllBytes($jar)
   $bytes[0] = 0xFF
   $bytes[1] = 0xFF
   $bytes[2] = 0xFF
   [System.IO.File]::WriteAllBytes($jar, $bytes)
   ```

2. **Run MineAnvil** and wait for recovery

3. **Parse logs**:
   ```powershell
   .\scripts\validation\parse-lockfile-authority-logs.ps1
   ```

## Expected Log Structure

Each recovery decision log should look like:
```json
{
  "timestamp": "...",
  "level": "warn",
  "area": "install.deterministic",
  "message": "corrupted artifact detected, quarantining",
  "meta": {
    "decision": "quarantine_then_redownload",
    "reason": "checksum_mismatch",
    "expected": {
      "algo": "sha1",
      "hashPrefix": "abc12345",
      "size": 28345678
    },
    "observed": {
      "algo": "sha1",
      "hashPrefix": "def67890",
      "size": 28345678
    },
    "authority": "lockfile",
    "remoteMetadataUsed": false
  }
}
```

## Validation Checklist

- [ ] Recovery decision logs found
- [ ] All logs have `authority: "lockfile"`
- [ ] All logs have `remoteMetadataUsed: false`
- [ ] All logs include `expected` from lockfile
- [ ] All logs include `observed` from filesystem
- [ ] No logs use remote metadata

