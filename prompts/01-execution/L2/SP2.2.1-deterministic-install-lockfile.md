# MineAnvil Work Ticket

If any instruction conflicts with 00-guardrails.md, guardrails win.

This ticket MUST be executed using the canonical boot prompt:
- context/BOOT_PROMPT.md

All other authoritative context applies:
- context/00-guardrails.md
- context/01-exec-summary.md
- context/02-execution-map.md
- context/03-what-needs-built.md
- context/04-project-summary.md
- context/05-development-plan.md

This ticket does NOT permit repository exploration or discovery unless explicitly stated.

---

## Objective
Make SP2.2 truly deterministic by introducing an immutable install lockfile that declares all required artefacts and checksums, and by expanding deterministic install to include libraries, assets, and natives so launch does not perform uncontrolled downloads.

---

## Layer
2

---

## Stop Point
SP2.2 — Deterministic Install (Hardening)

---

## Acceptance Criteria
- [ ] A lockfile is created at `%APPDATA%\MineAnvil\instances\<instanceId>\pack\lock.json` (atomic write)
- [ ] The lockfile contains a complete, pinned list of vanilla artefacts required on Windows:
      version json, client jar, asset index, assets, libraries, natives, and runtime archive (if managed)
- [ ] All downloads are verified against checksums declared in the lockfile (not remote metadata at verification time)
- [ ] Deterministic install installs the full set from the lockfile (no “download on launch” for these artefacts)
- [ ] Re-running install with the same manifest+lockfile produces no changes (idempotent)
- [ ] If lockfile exists, it is treated as authoritative. If it is corrupt or mismatched, fail loudly. No silent regeneration.
- [ ] PackManifest remains immutable. Do not modify manifest fields to “fill in” lock data.

---

## Non-Goals
- Do NOT implement rollback or last-known-good snapshots (SP2.3)
- Do NOT add UI flows or invite code integration (Layer 3)
- Do NOT refactor unrelated code

---

## Files Expected to Change
- electron/src/main/install/installPlanner.ts
- electron/src/main/install/deterministicInstaller.ts
- electron/src/main/pack/packManifestLoader.ts
- electron/src/main/pack/packLockfile.ts (new)
- electron/src/main/pack/packLockfileLoader.ts (new)
- scripts/print-pack-manifest.ts
- scripts/print-pack-lockfile.ts (new)
- docs/SP2.2-deterministic-install.md

(No surprises allowed)

---

## Implementation Notes
- Lockfile format: JSON with `schemaVersion`, `packId`, `packVersion`, `minecraftVersion`, `generatedAt`, and an `artifacts[]` list.
- Each artifact entry must include:
  - `name` (stable identifier)
  - `kind` ("version_json" | "client_jar" | "asset_index" | "asset" | "library" | "native" | "runtime")
  - `url`
  - `path` (relative to instance root or runtime root)
  - `checksum` { algo: "sha1" | "sha256", value: string }
  - `size` (optional but recommended)
- Deterministic generation:
  - If lock.json is missing, generate it deterministically from upstream version metadata for the pinned version and write it atomically.
  - If lock.json exists, do NOT regenerate it. Use it.
- Verification rule:
  - When downloading or validating an existing file, verify checksum against lockfile entry.
  - Do not use remote metadata as the source of truth once lockfile exists.
- Install scope (Windows):
  - Must install all libraries + natives needed for vanilla launch for that version
  - Must install asset index and required assets (as defined by index)
  - Must install version json + client jar
- Verbose output:
  - Any script must support `--verbose` and `-vvv`
  - Log plan steps and verification results at verbose levels
- Logging:
  - Keep logs structured JSON, secret-free
  - Do not log full URLs with tokens (should not exist, but be safe)

---

## Test Plan

### Clean Windows Machine
1. Start with clean Windows VM (no %APPDATA%\MineAnvil)
2. Ensure PackManifest exists and pins a specific Minecraft version (not "latest")
3. Run MineAnvil
4. Verify:
   - lock.json is created under `instances\default\pack\`
   - install completes
   - `.minecraft` contains version folder, libraries, natives, assets populated
   - no further downloads occur during launch for these artefacts

### Repeat Run
1. Re-run MineAnvil
2. Verify:
   - installer reports “already satisfied”
   - no files are modified (other than logs)
   - lock.json is unchanged

### Failure Cases
- Corrupt lock.json:
  - MineAnvil fails with clear error; no silent regeneration
- Checksum mismatch on an artefact:
  - MineAnvil fails loudly with expected vs actual
- Delete one library file:
  - MineAnvil re-downloads that one file and verifies checksum
- Network interruption mid-download:
  - MineAnvil fails loudly, leaving partial file cleaned up or clearly detected next run

---

## Stop Point Update
Do NOT mark SP2.2 as [done] until all Acceptance Criteria above pass.
Once complete, update STOP_POINTS.md to confirm SP2.2 is fully satisfied, specifically:
- “All downloaded artefacts are verified against declared checksums”
- “Same manifest always produces the same on-disk result (no on-demand downloads)”
