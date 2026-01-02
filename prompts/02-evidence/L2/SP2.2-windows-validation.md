# MineAnvil Validation Task

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

This task does NOT permit repository exploration or implementation changes.
This is evidence collection only.

---

## Objective
Validate Stop Point 2.2 (Deterministic Install) on a clean Windows machine by exercising real downloads, re-runs, and failure scenarios, and produce an evidence record suitable for audit.

---

## Layer
2

---

## Stop Point
SP2.2 — Deterministic Install (Validation)

---

## Scope
This task:
- Observes behavior
- Collects logs and artefacts
- Documents outcomes

This task does NOT:
- Modify code
- Add rollback or recovery logic
- Prepare SP2.3
- Change STOP_POINTS.md

---

## Validation Plan

### Environment Setup (Manual)
You (the operator) will:
1. Prepare a clean Windows VM
2. Ensure `%APPDATA%\MineAnvil` does not exist
3. Launch MineAnvil normally and interact with the UI as required

Cursor should assume:
- All user interaction is manual
- Cursor observes filesystem state, logs, and generated files

---

### Validation Steps

#### Step 1 — First Run (Full Download)
Observe and record:
- Creation of PackManifest
- Creation of lock.json
- Download of:
  - version json
  - client jar
  - libraries
  - natives
  - asset index
  - assets
  - Java runtime
- Completion without error

Cursor should:
- List all files created under:
  `%APPDATA%\MineAnvil\instances\default`
  `%APPDATA%\MineAnvil\runtimes`
- Capture relevant log excerpts (no secrets)

---

#### Step 2 — Repeat Run (Idempotency)
After closing and reopening MineAnvil:
- Confirm no downloads occur
- Confirm installer reports “already satisfied”
- Confirm lock.json is unchanged

Cursor should:
- Diff directory tree (excluding logs)
- Note zero changes

---

#### Step 3 — Targeted Corruption Test
Operator will manually:
- Delete one library JAR or one asset file

Then re-run MineAnvil and observe:
- Detection of missing file
- Re-download of exactly that artefact
- Checksum verification
- No regeneration of lockfile

Cursor should:
- Record which artefact was deleted
- Record which artefact was re-downloaded
- Capture log evidence

---

#### Step 4 — Network Failure Test (Optional)
If feasible:
- Interrupt network during a download
- Re-run MineAnvil

Expected:
- Clear, parent-readable failure
- No partial silent success
- Next run detects incomplete state

Cursor should:
- Capture error message text
- Capture relevant log lines

---

## Evidence to Collect

Cursor should produce:
- Final directory tree (paths only, no file contents)
- Lockfile summary (schemaVersion, artifact count, version)
- Confirmation that all verification uses lockfile checksums
- Log file paths and excerpts (redacted if needed)

---

## Output
Produce a single document:

`docs/SP2.2-windows-validation.md`

Containing:
- Environment details (Windows version, VM type)
- Validation steps and results
- Evidence references (logs, paths)
- Any anomalies or surprises (explicitly noted)

Do NOT recommend fixes unless validation fails.
Do NOT implement changes.

---

## Completion Criteria
This validation task is complete when:
- Deterministic install is observed to work
- Idempotency is proven
- Targeted corruption is detected and handled correctly
- Evidence document is written
