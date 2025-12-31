You are completing Stop Point 1.2 — Deterministic Re-run.

BOOT
Follow /.context/BOOT_PROMPT.md.
If any instruction conflicts with 00-guardrails.md, guardrails win.
Never modify STOP_POINTS.md items marked [done].

STOP POINT
SP1.2 — Deterministic Re-run

TASK
Execute the repeatability validation plan and record results.

REQUIREMENTS
1) Run MineAnvil multiple times on the same machine.
2) Verify:
   - No duplicated files
   - No corrupted state
   - Behaviour matches expectations
3) Record results clearly.

OUTPUT
- Markdown validation report in docs/
- Reference the existing test plan
- No code changes
