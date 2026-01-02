# MineAnvil Validation Task (Operator-in-the-Loop)

If any instruction conflicts with 00-guardrails.md, guardrails win.

This validation MUST be conducted using the canonical boot prompt:
- context/BOOT_PROMPT.md

All other authoritative context applies:
- context/00-guardrails.md
- context/01-exec-summary.md
- context/02-execution-map.md
- context/03-what-needs-built.md
- context/04-project-summary.md
- context/05-development-plan.md

This task does NOT permit implementation changes.
This is evidence collection and verification only.

This task MUST NOT explore the repository beyond the explicitly named files/paths below.

---

## Objective
Verify SP2.2 deterministic install after SP2.2.2 patch by:
- forcing lockfile regeneration (operator deletes lock.json)
- confirming lockfile contains ZERO runtime artifacts
- confirming deterministic install completes
- proving idempotency on second run
- performing one targeted corruption test and verifying only that artifact is restored

Cursor must perform all non-interactive checks: file existence, counts, diffs, hashes, and log excerpts.

---

## Environment Assumptions
- Windows machine/VM
- Base paths:
  - INSTANCE_ROOT = %APPDATA%\MineAnvil\instances\default
  - PACK_DIR = %APPDATA%\MineAnvil\instances\default\pack
  - LOCKFILE = %APPDATA%\MineAnvil\instances\default\pack\lock.json
  - MINECRAFT_DIR = %APPDATA%\MineAnvil\instances\default\.minecraft
  - LOG_MAIN = %APPDATA%\MineAnvil\instances\default\logs\mineanvil-main.log

---

## Phase 0 — Baseline Capture (Cursor)
Cursor must capture and record:
- Whether LOCKFILE exists
- LOCKFILE size and last-modified timestamp (if present)
- Directory tree summary counts:
  - total files under MINECRAFT_DIR
  - total files under MINECRAFT_DIR\libraries
  - total files under MINECRAFT_DIR\assets\objects
- A short log excerpt showing latest startup/installer activity (last ~200 lines)

Write results into: docs/SP2.2-windows-validation.md under a section "Phase 0".

---

## Phase 1 — Lockfile Regeneration + Install (Operator + Cursor)

### Operator actions (manual)
1. Close MineAnvil completely
2. Delete LOCKFILE (pack\lock.json)
3. Re-launch MineAnvil and wait for startup/install to finish

### Cursor responsibilities (after install completes)
1. Confirm LOCKFILE exists
2. Parse LOCKFILE and record:
   - schemaVersion
   - minecraftVersion
   - total artifact count
   - runtime artifact count (MUST be 0)
3. Fail the validation report if runtime artifact count != 0
4. Capture post-install directory counts:
   - total files under MINECRAFT_DIR
   - libraries file count
   - assets objects file count
5. Capture log excerpt that shows:
   - lockfile generated/loaded
   - installation plan summary
   - installation completed successfully

Write results into docs/SP2.2-windows-validation.md under "Phase 1".

---

## Phase 2 — Idempotency Re-run (Operator + Cursor)

### Operator actions (manual)
1. Close MineAnvil completely
2. Re-launch MineAnvil and wait for startup to finish

### Cursor responsibilities
1. Confirm LOCKFILE is unchanged byte-for-byte:
   - compute and record a SHA-256 hash of LOCKFILE after Phase 1 and after Phase 2 and compare
2. Re-capture directory counts and compare to Phase 1 (excluding logs):
   - total files under MINECRAFT_DIR
   - libraries count
   - assets objects count
3. Extract log excerpt showing “already satisfied” / “no actions” behavior:
   - evidence that no downloads or installs occurred

Write results into docs/SP2.2-windows-validation.md under "Phase 2".

---

## Phase 3 — Targeted Corruption (Operator + Cursor)

### Operator actions (manual)
1. Choose exactly ONE artifact listed in LOCKFILE that is a library JAR (kind == "library")
2. Delete that one file from disk at its lockfile path (relative to INSTANCE_ROOT or MINECRAFT_DIR)
3. Re-launch MineAnvil and wait for startup/install to finish

### Cursor responsibilities
1. Record which artifact was selected (name, kind, path, checksum)
2. Confirm the file was missing before re-run (exists=false)
3. After re-run, confirm:
   - file exists again
   - file checksum matches the lockfile checksum
4. Confirm no other artifacts were modified:
   - directory counts remain consistent aside from restoring the deleted file
5. Capture log excerpt showing:
   - missing artifact detected
   - re-download performed
   - checksum verified

Write results into docs/SP2.2-windows-validation.md under "Phase 3".

---

## Output Requirements
Update docs/SP2.2-windows-validation.md with:
- PASS/FAIL per phase
- All recorded counts, hashes, and timestamps
- Lockfile runtime count (must be 0)
- Log excerpts (redacted if needed, no secrets)

Cursor must NOT:
- Change code
- Suggest fixes unless a phase fails (then only describe failure)
- Modify STOP_POINTS.md

---

## Completion Criteria
This validation task is complete when Phase 1, Phase 2, and Phase 3 are PASS with runtime artifact count == 0.
