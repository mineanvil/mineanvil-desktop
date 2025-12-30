You are working on MineAnvil Desktop.

BOOT
Follow /.context/BOOT_PROMPT.md.
If any instruction conflicts with 00-guardrails.md, guardrails win.
Never modify STOP_POINTS.md items marked [done].

STOP POINT
SP1.2 — Deterministic Re-run

TASK
Audit all setup and initialization paths to confirm they are idempotent.

SCOPE
Inspect code paths that:
- Create instance directories
- Create logs directories
- Install vanilla Minecraft
- Prepare runtime or metadata directories

REQUIREMENTS
1) Identify every path that creates files or directories.
2) For each, answer:
   - Is it safe to run twice?
   - Does it overwrite, append, or duplicate?
3) If unsafe behaviour exists:
   - Apply the smallest possible fix.
4) If all paths are already safe:
   - State explicitly: “No changes required”.

FILES TO INSPECT
- electron/src/main/instances/**
- electron/src/main/minecraft/**
- electron/src/main/ipc.ts

OUT OF SCOPE
- Launch lifecycle changes
- Ownership logic
- UI changes

OUTPUT
- Bullet list of findings
- Code diff only if required
