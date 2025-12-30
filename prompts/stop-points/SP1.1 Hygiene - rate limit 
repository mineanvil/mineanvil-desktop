You are implementing a small, contained improvement in MineAnvil Desktop.

BOOT
Follow /.context/BOOT_PROMPT.md.
If any instruction conflicts with 00-guardrails.md, guardrails win.

STOP POINT
SP1.1 — Clean Machine Launch

TASK
Add rate-limiting and caching to Minecraft ownership checks performed via
IPC_CHANNELS.authGetStatus.

AUTHORITATIVE CONSTRAINTS
- Do NOT bypass Mojang/Microsoft allow-list restrictions
- Do NOT change ownership semantics or states
- Do NOT log tokens, headers, or raw HTTP responses
- Minimal diff; keep existing logic intact

REQUIREMENTS
1) Prevent repeated calls to:
   - getMinecraftAccessToken()
   - getEntitlements()
   - getProfile()
   when authGetStatus is called frequently.
2) Deduplicate concurrent ownership checks (in-flight promise reuse).
3) Apply conservative caching:
   - OWNED → cache ~60s
   - NOT_OWNED → cache ~5min
   - UNVERIFIED_APP_NOT_APPROVED → cache ~5min
   - UNVERIFIED_TEMPORARY → exponential backoff (cap ~60s)
4) Cache must reset on sign-out or token refresh.
5) Behaviour and IPC response shape must not change.

FILES ALLOWED TO CHANGE
- electron/src/main/ipc.ts

OUT OF SCOPE
- UI changes
- STOP_POINTS.md updates
- Launch lifecycle work

OUTPUT
- Code changes only
- No refactors outside authGetStatus
