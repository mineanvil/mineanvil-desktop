# MineAnvil Work Ticket — SP1.1 Ownership Verification (Allow-List Aware)

Follow `context/BOOT_PROMPT.md`.

If any instruction conflicts with `00-guardrails.md`, guardrails win.

---

## Objective
Make Minecraft ownership verification authoritative for Stop Point 1.1 by enforcing it as a hard gate.

Because Mojang/Microsoft now require new third-party apps to be allow-listed for Java Edition game service APIs, MineAnvil must correctly handle the “app not approved” scenario without misleading the user, without leaking secrets, and while blocking launch.

---

## Layer
1

---

## Stop Point
Stop Point 1.1 — Clean Machine Launch (Identity & Ownership)

---

## Definitions
MineAnvil must represent ownership/verification as a state machine, not a single boolean.

### Ownership State Enum (required)
- `OWNED`  
  Verified that the signed-in account owns Minecraft: Java Edition.
- `NOT_OWNED`  
  Verified that the signed-in account does not own Minecraft: Java Edition.
- `UNVERIFIED_APP_NOT_APPROVED`  
  Verification cannot be performed because MineAnvil is not allow-listed for Java Edition game service APIs (typical signal: `mc.login_with_xbox` returns HTTP 403; also acceptable to classify a 403 from `mc.entitlements` / `mc.profile` the same way).
- `UNVERIFIED_TEMPORARY`  
  Verification cannot be performed due to transient conditions (network, service outage, timeouts, rate limiting).

### IPC Contract (required)
The renderer must not guess ownership from a boolean that collapses multiple failure modes.

- Replace/augment `AuthStatus.minecraftOwned?: boolean` with an explicit `ownershipState: OwnershipState` in `electron/src/shared/ipc-types.ts`.
- The UI must gate launch using `ownershipState === OWNED` (not `minecraftOwned === true`).

---

## Acceptance Criteria

### Ownership Verification
- [ ] MineAnvil computes an `ownershipState` using the existing auth chain:
  - [ ] `electron/src/main/minecraft/minecraftAuth.ts` (`mc.login_with_xbox`)
  - [ ] `electron/src/main/minecraft/minecraftServices.ts` (`mc.entitlements`, `mc.profile`, `checkJavaOwnership`)
- [ ] If `ownershipState !== OWNED`, MineAnvil blocks any real Minecraft launch (server-side hard gate).
- [ ] Ownership failure (including unverified states) is detected and blocked deterministically:
  - [ ] Same inputs => same `ownershipState`
  - [ ] No “fallback” that enables launch on uncertainty
- [ ] A clear, user-safe error is shown when blocked:
  - [ ] For `NOT_OWNED`: explain account does not own Minecraft: Java Edition; suggest purchasing or signing into the correct account.
  - [ ] For `UNVERIFIED_APP_NOT_APPROVED`: explain MineAnvil cannot verify ownership yet because Microsoft/Mojang requires new apps to be approved/allow-listed; user should use the official launcher for now.
  - [ ] For `UNVERIFIED_TEMPORARY`: suggest retrying and checking connectivity.
- [ ] No tokens or secrets written to logs:
  - [ ] No OAuth access/refresh tokens
  - [ ] No Authorization headers
  - [ ] No XBL/XSTS tokens
  - [ ] No Minecraft access token
  - [ ] No full HTTP response bodies that may contain sensitive data
- [ ] Log output is stable and non-spammy:
  - [ ] Repeated failures do not flood logs (rate limit or dedupe per session where appropriate)

### Launch Gating Integration
- [ ] Renderer launch actions are disabled/blocked unless `ownershipState === OWNED`.
- [ ] Electron main enforces the gate in IPC handlers (do not rely on renderer gating):
  - [ ] `mineanvil:installVanilla` blocks when `ownershipState !== OWNED`
  - [ ] `mineanvil:getLaunchCommand` blocks when `ownershipState !== OWNED`
  - [ ] `mineanvil:launchVanilla` blocks when `ownershipState !== OWNED`
- [ ] If a diagnostic “launch stub” exists (e.g. `getLaunchPlan` dry-run), it is explicitly labelled as diagnostic and cannot be confused with a real Minecraft launch command/launch.
- [ ] No dummy/placeholder auth values are used in “real launch” mode.

### API Surface (required)
- [ ] `electron/src/shared/ipc-types.ts` defines `OwnershipState` and returns it via `AuthStatus`.
- [ ] `electron/src/main/ipc.ts` computes `ownershipState` and returns it from `authGetStatus`.
- [ ] `src/App.tsx` uses `ownershipState` (not `minecraftOwned`) for gating and messaging.

---

## Non-Goals
- No attempt to bypass allow-listing requirements.
- No bundling Java in this ticket.
- No full Minecraft launch correctness work.
- No UI polish beyond the required user-safe messaging to satisfy Stop Point 1.1.

---

## Files Expected to Change (No surprises allowed)
- electron/src/main/minecraft/minecraftAuth.ts (only if needed to classify HTTP 403 as allow-list unverified)
- electron/src/main/minecraft/minecraftServices.ts (only if needed to classify HTTP 403 as allow-list unverified)
- electron/src/main/ipc.ts (return `ownershipState` via `authGetStatus` and use it in gate messaging)
- electron/src/shared/ipc-types.ts (add `OwnershipState`, plumb through `AuthStatus`)
- src/App.tsx (gate + message based on `ownershipState`)
- docs/STOP_POINTS.md (tick Identity & Ownership items only after Windows verification)

(Any additional file must be justified against Stop Point 1.1 and kept minimal.)

---

## Implementation Notes
- **Classification**:
  - Treat `mc.login_with_xbox` HTTP 403 as `UNVERIFIED_APP_NOT_APPROVED`.
  - If desired, treat HTTP 403 from `mc.entitlements` and/or `mc.profile` the same way.
  - Do not claim the user does not own Minecraft when the app is unapproved; be precise.
- **Error typing** (recommended):
  - Prefer throwing/returning a small, explicit error shape from the Minecraft HTTP layers that includes only:
    - endpoint name (e.g. `mc.login_with_xbox`)
    - HTTP status (e.g. 403)
    - a short, non-secret message
  - Avoid parsing ownership state from string-matched error messages.
- **Sanitization**:
  - Keep errors sanitized at boundaries: IPC return payloads and log lines must never include secrets.
  - Never include raw HTTP response bodies in logs (even in verbose).

---

## Test Plan (Windows)
- [ ] Sign in and trigger ownership check (`mineanvil:authGetStatus`):
  - [ ] If `mc.login_with_xbox` returns HTTP 403, `ownershipState === UNVERIFIED_APP_NOT_APPROVED`
  - [ ] UI shows “unverified / app not approved” message and launch is blocked
  - [ ] Logs show endpoint + status only; no secrets
- [ ] Repeat app restart and sign-in:
  - [ ] Same result deterministically
  - [ ] No log spam (dedupe/rate limit warnings if the UI refreshes status repeatedly)
- [ ] If possible, later test with an allow-listed environment/account:
  - [ ] `ownershipState === OWNED`
  - [ ] Launch becomes enabled and no ownership-related error is shown

---

## Stop Point Update
After Windows verification, tick the following in `docs/STOP_POINTS.md`:

Identity & Ownership:
- [ ] Minecraft ownership is verified (state machine is authoritative, includes allow-list unverified handling)
- [ ] Ownership failure is detected and blocked
- [ ] Clear, user-safe error shown on ownership failure
- [ ] No tokens or secrets written to logs
