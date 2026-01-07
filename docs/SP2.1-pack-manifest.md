# Stop Point 2.1 — Pack Manifest

## Objective

Introduce a minimal, declarative Pack Manifest that becomes the authoritative source of truth for a managed Minecraft Java environment.

## Implementation Summary

### PackManifest v1 Structure

The Pack Manifest v1 is defined in `electron/src/main/pack/packManifest.ts`:

```typescript
type PackManifestV1 = {
  manifestVersion: "1";
  createdAt: string;        // ISO timestamp, stable across runs
  instanceId: string;       // Instance identifier
  packId: string | null;    // Reserved for future use
  packVersion: string | null; // Reserved for future use
};
```

### Manifest Location

The manifest is stored at:
- **Windows**: `%APPDATA%\MineAnvil\instances\<instanceId>\pack\manifest.json`
- **Default instance**: `%APPDATA%\MineAnvil\instances\default\pack\manifest.json`

### Manifest Lifecycle

1. **First Run**: Manifest is created deterministically when MineAnvil starts
2. **Subsequent Runs**: Existing manifest is loaded and trusted as authoritative
3. **Corruption Handling**: If manifest exists but is invalid, app fails with clear error (no silent regeneration)

### Integration Points

- **Startup**: Manifest is loaded in `electron/src/main/main.ts` after instance directories are ensured
- **Failure**: If manifest cannot be loaded or created, app exits with user-friendly error dialog
- **Logging**: Manifest load is logged (without sensitive details) for debugging

## Files Created/Modified

### New Files

1. **`electron/src/main/pack/packManifest.ts`**
   - Defines `PackManifestV1` type
   - Provides `isPackManifestV1()` type guard for validation

2. **`electron/src/main/pack/packManifestLoader.ts`**
   - `loadOrCreatePackManifest()`: Main function to load or create manifest
   - `packManifestPath()`: Resolves manifest file path
   - Atomic write operations for safety
   - Validation and error handling

3. **`scripts/print-pack-manifest.ts`**
   - Helper script to print manifest contents
   - Supports `--verbose` or `-vvv` for debugging
   - Supports `--instance-id <id>` for non-default instances
   - Docker-friendly (uses environment variables when available)

### Modified Files

1. **`electron/src/main/main.ts`**
   - Added manifest loading after instance directories are ensured
   - Added error handling for manifest load failures
   - Added logging for successful manifest load

## Behavior

### Deterministic Creation

The manifest is created with:
- `manifestVersion: "1"` (fixed)
- `createdAt`: ISO timestamp generated on first creation (stable thereafter)
- `instanceId`: Matches the instance being initialized
- `packId: null` (reserved for Layer 2)
- `packVersion: null` (reserved for Layer 2)

### Stability Across Runs

- Once created, the manifest is **immutable** for this stop point
- The `createdAt` timestamp remains constant across runs
- No fields are modified after initial creation
- Manifest is loaded and trusted as-is

### Error Handling

- **Missing manifest**: Created automatically on first run
- **Corrupt manifest**: App fails with clear error message, no silent regeneration
- **Invalid structure**: Type guard validation ensures structure integrity
- **Instance ID mismatch**: Detected and reported as error

## Testing

### Clean Windows Machine Test

1. Start with a clean Windows VM (no `%APPDATA%\MineAnvil` directory)
2. Launch MineAnvil
3. Verify:
   - `%APPDATA%\MineAnvil\instances\default\pack\manifest.json` is created
   - Manifest contents match expected structure
   - No other files are mutated unexpectedly

### Repeat Run Test

1. Restart MineAnvil
2. Verify:
   - Existing manifest is loaded
   - No fields are changed
   - No duplicate manifests are created

### Failure Case Test

1. Corrupt the manifest file (invalid JSON)
2. Launch MineAnvil
3. Verify:
   - App fails safely with clear error dialog
   - No silent regeneration occurs

## Helper Script Usage

```bash
# Print manifest (default instance)
node scripts/print-pack-manifest.js

# Print with verbose output
node scripts/print-pack-manifest.js --verbose

# Print for specific instance
node scripts/print-pack-manifest.js --instance-id custom-instance

# Docker environment (set path explicitly)
MINEANVIL_MANIFEST_PATH=/path/to/manifest.json node scripts/print-pack-manifest.js
```

## Non-Goals (Explicitly Not Implemented)

- ❌ Pack installation logic
- ❌ Rollback or recovery mechanisms
- ❌ UI or invite-code integration
- ❌ Manifest mutation after creation
- ❌ Silent regeneration of corrupt manifests

## Future Work (Layer 2+)

The manifest structure reserves fields for future use:
- `packId`: Will be populated when pack installation is implemented
- `packVersion`: Will track installed pack version
- Additional fields may be added in future manifest versions

## Notes

- Manifest is **declarative**, not imperative
- Manifest is treated as **immutable** once written (for this stop point)
- Technical details (paths, versions) may be logged but not shown to users
- All helper scripts support verbose output (`--verbose` or `-vvv`)
- Docker-based dev environment is assumed for tooling/scripts




