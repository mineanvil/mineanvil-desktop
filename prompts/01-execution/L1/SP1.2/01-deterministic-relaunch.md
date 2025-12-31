You are completing SP1.2 on Windows.

BOOT
Follow /.context/BOOT_PROMPT.md.
If any instruction conflicts with 00-guardrails.md, guardrails win.
Never modify STOP_POINTS.md items marked [done].

STOP POINT
SP1.2 — Deterministic Re-run

TASK
Execute the SP1.2 repeatability validation plan on Windows and record outcomes.

REQUIREMENTS
1) Perform at least 3 consecutive runs.
2) Validate:
   - instance directory layout is stable
   - no duplicated files/directories
   - no corrupted state across runs
3) Reference the existing SP1.2 plan/checklist/report templates in docs/.

OUTPUT
- docs/SP1.2-windows-repeatability-report.md
- No code changes unless a real defect is discovered.
