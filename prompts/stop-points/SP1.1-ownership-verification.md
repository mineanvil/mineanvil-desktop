# MineAnvil Work Ticket — SP1.1 Ownership Verification

Follow /.context/BOOT_PROMPT.md.

If any instruction conflicts with `00-guardrails.md`, guardrails win.

---

## Objective
Make Minecraft ownership verification authoritative for Stop Point 1.1 by enforcing it as a hard gate. If the logged-in Microsoft account does not own Minecraft Java Edition, MineAnvil must block launch-related actions and show a clear, user-safe error.

---

## Layer
1

---

## Stop Point
Stop Point 1.1 — Clean Machine Launch (Identity & Ownership)

---

## Acceptance Criteria

### Ownership Verification
- [ ] Ownership status is determined from the existing ownership chain (entitlements / ownership check)
- [ ] `minecraftOwned === true` is required before any launch can proceed
- [ ] Ownership failure is detected and blocked (no partial launch attempt)
- [ ] Clear, user-safe error shown on ownership failure
  - [ ] Message explains: account is signed in but does not own Minecraft Java Edition (or cannot be verified)
  - [ ] Message contains actionable next steps (purchase / correct account / retry)
- [ ] No tokens or secrets written to logs
  - [ ] No access tokens, refresh tokens, Authorization headers, XBL/XSTS tokens, Minecraft access tokens
  - [ ] Errors must be redacted/sanitised

### Launch Gating Integration
- [ ] Any existing launch trigger is blocked when `minecraftOwned !== true`
- [ ] Any placeholder/dummy launch auth must be removed or prevented from being used in “real launch” mode
  - [ ] If a launch stub exists for diagnostics, it must be clearly labelled as diagnostic-only and must not be confused with a real Minecraft launch

---

## Non-Goals
- No new OAuth flows
- No launch lifecycle/stderr/stdout capture work in this ticket
- No Java bundling/download changes
- No UI polish beyond user-safe error messaging required to satisfy Stop Point 1.1

---

## Files Expected to Change (No surprises allowed)
- electron/src/main/minecraft/minecraftAuth.ts (only if needed to harden/redact logging)
- electron/src/main/minecraft/minecraftServices.ts (only if needed to harden/redact logging)
- electron/src/main/ipc.ts (to enforce gating and return clear ownership state)
- src/App.tsx (only if needed to disable/hide launch action when not owned, and surface user-safe error)
- docs/STOP_POINTS.md (tick Identity & Ownership items only after Windows verification)

(If additional files are required, they must be justified against Stop Point 1.1 and kept minimal.)

---

## Implementation Notes
- Ownership verification already exists; the work here is to make it enforced and user-safe.
- Ensure error handling does not leak secrets. Sanitize errors at the boundary where they are logged or returned to the renderer.
- Renderer/UI may show a simple blocking dialog or banner; do not add complex UX.

---

## Test Plan (Windows)
- [ ] Sign in with a Minecraft-owned account:
  - [ ] Ownership status indicates owned
  - [ ] Launch action becomes enabled (or not blocked)
- [ ] Sign in with a non-owned account (or simulate ownership failure):
  - [ ] Ownership status indicates not owned (or cannot verify)
  - [ ] Launch action is blocked
  - [ ] User-safe error is shown
  - [ ] No tokens/secrets appear in logs
- [ ] Repeat runs (close/reopen app) confirm deterministic behaviour

---

## Stop Point Update
After Windows verification, tick the following in `docs/STOP_POINTS.md`:

Identity & Ownership:
- [ ] Minecraft ownership is verified
- [ ] Ownership failure is detected and blocked
- [ ] Clear, user-safe error shown on ownership failure
- [ ] No tokens or secrets written to logs
