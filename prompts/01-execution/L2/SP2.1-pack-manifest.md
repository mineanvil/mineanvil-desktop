# MineAnvil Work Ticket

If any instruction conflicts with context/00-guardrails.md, guardrails win.
---

## Objective
Introduce a minimal, declarative Pack Manifest that becomes the authoritative source of truth for a managed Minecraft Java environment.

---

## Layer
2

---

## Stop Point
SP2.1 — Pack Manifest

---

## Acceptance Criteria
- [ ] A PackManifest v1 structure is defined and versioned
- [ ] A manifest.json file is created deterministically on first run
- [ ] Existing runs load and trust the manifest as authoritative
- [ ] Manifest contents are stable across repeated runs on the same machine
- [ ] No installation, mutation, or rollback logic is introduced

---

## Non-Goals
- Do NOT implement pack installation
- Do NOT implement rollback or recovery
- Do NOT add UI or invite-code integration

---

## Files Expected to Change
- electron/src/main/pack/packManifest.ts
- electron/src/main/pack/packManifestLoader.ts
- electron/src/main/main.ts
- scripts/print-pack-manifest.ts
- docs/SP2.1-pack-manifest.md

(No surprises allowed)

---

## Implementation Notes
- Manifest must be declarative, not imperative
- Treat the manifest as immutable once written for this stop point
- Technical details (paths, versions) may be logged but not shown to users
- All helper scripts must support verbose output (--verbose or -vvv)
- Assume a Docker-based dev environment for any tooling or scripts

---

## Test Plan

### Clean Windows Machine
1. Start with a clean Windows VM (no %APPDATA%\MineAnvil directory)
2. Launch MineAnvil
3. Verify that:
   - `%APPDATA%\MineAnvil\instances\default\pack\manifest.json` is created
   - Manifest contents match pinned values
   - No other files are mutated unexpectedly

### Repeat Run
1. Restart MineAnvil
2. Verify:
   - Existing manifest is loaded
   - No fields are changed
   - No duplicate manifests are created

### Failure Cases
- Corrupt or missing manifest file:
  - App must fail safely with a clear error
  - No silent regeneration is allowed in this stop point

---

## Stop Point Update
Upon completion, update STOP_POINTS.md to mark:

- Layer 2
  - [done] SP2.1 — Pack Manifest defined and persisted deterministically
