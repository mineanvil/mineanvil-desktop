You are implementing Stop Point 1.3 — Failure Transparency.

BOOT
Follow /.context/BOOT_PROMPT.md.
If any instruction conflicts with 00-guardrails.md, guardrails win.

STOP POINT
SP1.3 — Failure Transparency

TASK
Audit all failure paths and ensure each maps cleanly to a failure category.

CATEGORIES
- Authentication failure
- Ownership failure
- Runtime failure
- Launch failure

REQUIREMENTS
1) Identify where each failure originates in code.
2) Confirm each produces:
   - A distinct ownershipState or error type
   - A clear user-facing message
3) Ensure temporary failures do NOT masquerade as permanent ones.

FILES TO INSPECT
- electron/src/main/ipc.ts
- electron/src/main/minecraft/*
- electron/src/main/auth/*
- src/App.tsx

OUTPUT
- Bullet list mapping failure → category → user message
- Note any ambiguities or overlaps
