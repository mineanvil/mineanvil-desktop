# Stop Point 2.2 — Deterministic Install (Hardening)

## Overview

Stop Point 2.2 implements deterministic installation of a Minecraft Java environment using an immutable install lockfile. The lockfile declares all required Minecraft artefacts and checksums, ensuring the same manifest+lockfile always produces the same on-disk result. Re-running installation with the same lockfile produces no changes, and launch does not perform uncontrolled downloads.

**Note**: SP2.2 deterministic install covers Minecraft artefacts only. Managed Java runtime installation is deferred until a future stop point with pinned URL+checksum. Java runtime remains externally resolved/validated (per Layer 1) until then.

## Implementation

### Pack Lockfile

**File**: `electron/src/main/pack/packLockfile.ts`

The lockfile is an immutable, complete list of all artefacts required for deterministic installation:

- **Schema Version**: Always "1" for PackLockfile v1
- **Minecraft Version**: Pinned version ID (not "latest")
- **Artifacts**: Complete list of all required Minecraft artefacts with:
  - `name`: Stable identifier
  - `kind`: Type of artefact (version_json, client_jar, asset_index, asset, library, native)
  - `url`: Download URL
  - `path`: Relative path from instance root
  - `checksum`: SHA-1 checksum (from lockfile, not remote metadata)
  - `size`: File size in bytes (optional)

**Note**: Runtime artifacts (`kind: "runtime"`) are not included in SP2.2 lockfile generation. If an existing lockfile contains runtime artifacts, MineAnvil fails with a clear error instructing the operator to delete the lockfile to regenerate without runtime.

### Lockfile Loader

**File**: `electron/src/main/pack/packLockfileLoader.ts`

The loader handles lockfile lifecycle:

- **Load Existing**: If lockfile exists, it is treated as authoritative
- **Generate New**: If missing, generates deterministically from upstream version metadata (Minecraft artefacts only, no runtime)
- **Validation**: Fails loudly if lockfile is corrupt, mismatched with manifest, or contains runtime artifacts
- **No Silent Regeneration**: Once written, lockfile is never regenerated silently

### Installation Planner

**File**: `electron/src/main/install/installPlanner.ts`

The planner analyzes the lockfile and current installation state:

- Checks each artefact in the lockfile
- Verifies files exist at expected paths
- Verifies checksums match lockfile values (not remote metadata)
- Generates a deterministic plan: same lockfile + same state = same plan

### Deterministic Installer

**File**: `electron/src/main/install/deterministicInstaller.ts`

The installer performs complete installation from the lockfile:

1. **Planning**: Uses `planInstallation()` to determine what needs to be done
2. **Artifact Installation** (Minecraft artefacts only):
   - **Version JSON**: Downloaded and verified against lockfile checksum
   - **Client Jar**: Downloaded and verified against lockfile checksum
   - **Libraries**: All required libraries downloaded and verified
   - **Natives**: Native JARs downloaded, verified, and extracted
   - **Asset Index**: Downloaded and verified
   - **Assets**: All required assets downloaded and verified
3. **Idempotency**: Re-running with the same lockfile produces no changes if everything is already installed correctly

**Note**: Runtime artifacts are not installed by SP2.2. If the lockfile contains runtime artifacts, installation fails with a clear error. Java runtime remains externally resolved/validated (per Layer 1).

### Integration

**File**: `electron/src/main/main.ts`

The deterministic installer is called automatically at startup:

1. Load or create PackManifest
2. Load or generate lockfile (if manifest has `minecraftVersion`)
3. Install from lockfile
4. If installation fails, startup is aborted with a clear error dialog

## Behavior

### Successful Installation

When a manifest with `minecraftVersion` is loaded:

1. Lockfile is loaded or generated deterministically (Minecraft artefacts only)
2. Planner checks current state against lockfile
3. All missing or unverified artefacts are installed/verified
4. All checksums are verified from lockfile (not remote metadata)
5. Complete Minecraft set is installed: version json, client jar, libraries, natives, assets
6. Installation completes successfully

### Idempotent Re-run

When MineAnvil is re-run with the same lockfile:

1. Planner detects all artefacts are already installed and verified
2. No downloads or writes occur
3. Installation completes immediately with "already satisfied" status

### Failure Cases

The installer fails loudly on any error:

- **Missing lockfile**: Generated deterministically (if manifest has minecraftVersion)
- **Corrupt lockfile**: Clear error, no silent regeneration
- **Lockfile mismatch**: Clear error if lockfile doesn't match manifest
- **Checksum mismatch**: Clear error with expected (from lockfile) vs actual checksum
- **Corrupt files**: Clear error explaining what's wrong
- **Network failures**: Clear error from download layer
- **Partial installs**: Installation stops immediately, no silent repair

All failures are logged with structured JSON and shown to the user via error dialog.

## Verification

### Checksum Verification

All downloaded Minecraft artefacts are verified against lockfile checksums:

- **Version JSON**: SHA-1 from lockfile
- **Client Jar**: SHA-1 from lockfile
- **Libraries**: SHA-1 from lockfile
- **Natives**: SHA-1 from lockfile
- **Asset Index**: SHA-1 from lockfile
- **Assets**: SHA-1 from lockfile (asset hash)

**Critical**: Checksums come from the lockfile, not remote metadata. Once the lockfile exists, it is the sole source of truth for checksums.

### Installation State

The planner checks installation state by:

- Verifying files exist at expected paths (from lockfile)
- Verifying checksums match lockfile values
- No reliance on timestamps or other non-deterministic metadata
- No queries to remote metadata for verification

## Constraints

### No Lockfile Mutation

The installer **never** modifies the lockfile. It only reads from it.

### No Silent Regeneration

The installer **never** silently regenerates a lockfile. If a lockfile exists but is corrupt or mismatched, installation fails with a clear error.

### No Manifest Mutation

The installer **never** modifies the PackManifest. It only reads from it.

### No Silent Repair

The installer **never** attempts to repair or fix broken installs silently. All failures are user-visible.

### No Rollback

The installer **never** attempts rollback or recovery. If installation fails, it stops immediately.

### Controlled Directories Only

All installation writes occur only under:

- `%APPDATA%\MineAnvil\instances\<instanceId>\.minecraft\` — Minecraft files

No writes occur outside this controlled directory. Java runtime files remain externally managed (per Layer 1).

### Complete Installation

The installer installs the complete set of Minecraft artefacts needed for launch:

- Version JSON and client jar
- All required libraries
- All required natives (extracted)
- Asset index and all required assets

Launch does not perform uncontrolled downloads for these Minecraft artefacts. Java runtime remains externally resolved/validated (per Layer 1).

## Testing

### Clean Windows Machine

1. Start with a clean Windows VM (no `%APPDATA%\MineAnvil`)
2. Ensure PackManifest exists with `minecraftVersion` set
3. Run MineAnvil
4. Verify:
   - `lock.json` is created under `instances\default\pack\`
   - Installation completes
   - `.minecraft` contains version folder, libraries, natives, assets populated
   - No further downloads occur during launch for these artefacts

### Repeat Run

1. Re-run MineAnvil with no changes
2. Verify:
   - Installer reports "already satisfied"
   - No files are modified (other than logs)
   - `lock.json` is unchanged

### Failure Cases

Test scenarios:

- **Corrupt lock.json**: MineAnvil fails with clear error; no silent regeneration
- **Lockfile contains runtime artifacts**: MineAnvil fails with clear error instructing to delete lock.json to regenerate without runtime
- **Checksum mismatch**: MineAnvil fails loudly with expected (from lockfile) vs actual
- **Delete one library file**: MineAnvil re-downloads that one file and verifies checksum from lockfile
- **Network interruption mid-download**: MineAnvil fails loudly, leaving partial file cleaned up or clearly detected next run

Expected behavior: Clear, parent-readable error; no silent repair; no rollback.

## Files Changed

- `electron/src/main/pack/packLockfile.ts` — Lockfile structure and type definitions
- `electron/src/main/pack/packLockfileLoader.ts` — Lockfile loader and generator
- `electron/src/main/install/installPlanner.ts` — Updated to use lockfile
- `electron/src/main/install/deterministicInstaller.ts` — Updated to install all artefacts from lockfile
- `electron/src/main/main.ts` — Integrated lockfile loading and installation
- `scripts/print-pack-lockfile.ts` — Helper script to print lockfile
- `docs/SP2.2-deterministic-install.md` — This file

## Notes

- The lockfile is generated deterministically from upstream version metadata
- Once generated, the lockfile is immutable and authoritative
- All checksums come from the lockfile, not remote metadata
- Complete installation ensures launch does not perform uncontrolled downloads
- All logs are structured JSON, secret-free, and suitable for troubleshooting
