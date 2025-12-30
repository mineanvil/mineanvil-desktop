You are implementing UX hygiene in MineAnvil Desktop.

BOOT
Follow /.context/BOOT_PROMPT.md.
If any instruction conflicts with 00-guardrails.md, guardrails win.

STOP POINT
SP1.3 — Failure Transparency

TASK
Rate-limit launch-blocking error dialogs shown by IPC handlers.

AUTHORITATIVE CONTEXT
- Launch must remain hard-blocked unless ownershipState === OWNED
- dialog.showErrorBox() is currently called in:
  - installVanilla
  - getLaunchCommand
  - launchVanilla

REQUIREMENTS
1) Prevent repeated display of identical “Launch blocked” dialogs within a short window (e.g. 15s).
2) Always return { ok:false, error } even if dialog is suppressed.
3) No change to messaging text or ownership logic.
4) No renderer changes.

FILES ALLOWED TO CHANGE
- electron/src/main/ipc.ts

OUT OF SCOPE
- UI copy changes
- Ownership logic
- STOP_POINTS.md updates

OUTPUT
- Minimal diff
- No behavioural regressions
