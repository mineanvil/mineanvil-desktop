You are validating MineAnvil stability across repeated runs.

BOOT
Follow /.context/BOOT_PROMPT.md.
If any instruction conflicts with 00-guardrails.md, guardrails win.
Never modify STOP_POINTS.md items marked [done].

STOP POINT
SP1.2 — Deterministic Re-run

TASK
Define and execute a stability verification checklist for repeated runs.

REQUIREMENTS
1) Define what “state” means for MineAnvil:
   - Instance directory layout
   - Installed versions
   - Config files
   - Logs
2) Define expected invariants across:
   - First run
   - Second run
   - Third run
3) Identify any state that is allowed to change (e.g. timestamps).

OUTPUT
- Short markdown note documenting:
  - Invariants
  - Allowed changes
  - Any violations observed
- No code changes
