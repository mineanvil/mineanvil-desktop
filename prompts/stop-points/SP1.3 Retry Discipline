You are refining retry behaviour for MineAnvil.

BOOT
Follow /.context/BOOT_PROMPT.md.
If any instruction conflicts with 00-guardrails.md, guardrails win.

STOP POINT
SP1.3 — Failure Transparency

TASK
Ensure retry is offered only when meaningful.

REQUIREMENTS
1) Verify retries are offered for:
   - UNVERIFIED_TEMPORARY
   - Transient auth failures
2) Verify retries are NOT encouraged for:
   - NOT_OWNED
   - UNVERIFIED_APP_NOT_APPROVED
3) Confirm UI and dialogs align with this behaviour.

FILES TO INSPECT
- src/App.tsx
- electron/src/main/ipc.ts

OUTPUT
- Confirmed behaviour or minimal fixes

GIT
- Commit updates to git.