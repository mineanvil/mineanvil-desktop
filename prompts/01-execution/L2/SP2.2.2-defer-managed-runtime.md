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
Defer managed Java runtime installation in SP2.2 deterministic install so deterministic installation and lockfile generation cover Minecraft artefacts only. Java remains externally resolved/validated (per Layer 1) until a later stop point introduces a real pinned runtime URL+checksum.

---

## Layer
2

---

## Stop Point
SP2.2 — Deterministic Install (Patch: Defer Managed Runtime)

---

## Acceptance Criteria
- [ ] Lockfile generation does NOT include any `kind: "runtime"` artefacts
- [ ] Deterministic installer does NOT attempt to install `kind: "runtime"` artefacts
- [ ] If an existing lockfile contains `kind: "runtime"`, MineAnvil fails clearly with an actionable error instructing the operator to delete/regenerate the lockfile (no silent regeneration)
- [ ] Deterministic install still installs and verifies: version json, client jar, asset index, assets, libraries, natives
- [ ] Startup no longer fails with “Managed runtime is not configured yet” when using deterministic install
- [ ] TypeScript build is clean: remove/resolve unused imports/vars reported in packLockfileLoader.ts

---

## Non-Goals
- Do NOT implement real managed runtime download URLs or checksums
- Do NOT add rollback/recovery logic
- Do NOT introduce new UI flows

---

## Files Expected to Change
- electron/src/main/pack/packLockfileLoader.ts
- electron/src/main/install/deterministicInstaller.ts
- electron/src/main/install/installPlanner.ts
- docs/SP2.2-deterministic-install.md

(No surprises allowed)

---

## Implementation Notes
- Treat runtime as “external” for now.
- Lockfile schema may keep `kind: "runtime"` as a supported enum for future work, but SP2.2 generation must not emit runtime entries.
- Backward-compat rule:
  - If lockfile contains runtime entries, fail loudly with message:
    - “This MineAnvil build does not support managed runtime installation yet. Delete pack/lock.json to regenerate without runtime, or configure MINEANVIL_JAVA_PATH.”
- Do not silently modify or regenerate a present lockfile.
- Ensure errors remain parent-readable and do not leak technical stack traces to users.

---

## Test Plan

### Clean Windows Machine
1. Delete `%APPDATA%\MineAnvil` (or use clean VM snapshot)
2. Ensure manifest pins minecraftVersion (e.g., 1.21.4)
3. Start MineAnvil
4. Verify:
   - lock.json created
   - NO runtime artifacts present
   - deterministic install completes
   - no “managed runtime not configured” error
   - launch still uses the externally resolved Java path from Layer 1 behavior

### Existing Lockfile With Runtime Entry
1. Take an existing lock.json that contains a runtime artifact
2. Start MineAnvil
3. Verify:
   - MineAnvil fails with clear message instructing to delete lock.json to regenerate (no silent regeneration)

### Repeat Run (Idempotency)
1. Restart MineAnvil
2. Verify:
   - no downloads
   - “already satisfied” behavior
   - lock.json unchanged byte-for-byte

---

## Stop Point Update
Do NOT mark new stop points as complete.
This patch exists to allow SP2.2 validation to complete without managed runtime.

Update docs/SP2.2-deterministic-install.md to explicitly state:
- SP2.2 deterministic install covers Minecraft artefacts only
- Managed runtime installation is deferred until a future stop point with pinned URL+checksum
