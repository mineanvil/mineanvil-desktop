You are implementing Stop Point 1.2 — Deterministic Re-run.

BOOT
Follow /.context/BOOT_PROMPT.md.
If any instruction conflicts with 00-guardrails.md, guardrails win.
Never modify STOP_POINTS.md items marked [done].

STOP POINT
SP1.2 — Deterministic Re-run

TASK
Audit all filesystem-creating or mutating code paths to confirm they are safe to re-run.

REQUIREMENTS
1) Identify all paths that:
   - create directories
   - write files
   - extract archives
   - download or install content
2) For each path, determine:
   - safe on second run?
   - overwrites vs duplicates?
   - partial-failure recovery?
3) If unsafe behaviour exists:
   - apply the smallest possible fix
4) If everything is already safe:
   - state explicitly: “No changes required”.

FILES TO INSPECT
- electron/src/main/instances/**
- electron/src/main/minecraft/**
- electron/src/main/ipc.ts

OUT OF SCOPE
- Ownership logic
- Launch lifecycle changes
- UI changes

OUTPUT
- Bullet list of findings
- Code diff only if required
