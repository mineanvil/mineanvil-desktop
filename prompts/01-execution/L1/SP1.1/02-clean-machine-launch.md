You are performing SP1.1 environment validation on Windows.

BOOT
Follow /.context/BOOT_PROMPT.md.
If any instruction conflicts with 00-guardrails.md, guardrails win.
Never modify STOP_POINTS.md items marked [done].

STOP POINT
SP1.1 — Clean Machine Launch

TASK
Execute and document a clean-state Windows validation run for MineAnvil.

REQUIREMENTS
1) Ensure clean state:
   - No existing MineAnvil userData (document the path and whether it existed)
2) Start MineAnvil.
3) Perform Microsoft sign-in.
4) Observe ownership state.
   - If Mojang allow-list not granted: expect UNVERIFIED_APP_NOT_APPROVED and launch blocked.
5) Confirm:
   - Launch is blocked when ownershipState !== OWNED
   - Messaging is clear and truthful
   - Logs exist and contain no secrets
6) Repeat the run at least 3 times and confirm behaviour is stable.

OUTPUT
- docs/SP1.1-windows-validation.md with:
  - machine details
  - steps
  - results (including ownershipState values)
  - log location(s)
  - repeated-run notes
- No code changes unless the run reveals a genuine defect.
