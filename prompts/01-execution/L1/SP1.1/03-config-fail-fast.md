# MineAnvil Work Ticket

## Objective
Implement strict startup-time configuration validation in the Electron main process
so MineAnvil fails fast and safely when required configuration is missing or invalid.

## Layer
1

## Stop Point
Stop Point 1.1 — Clean Machine Launch

## Acceptance Criteria
- [ ] Application validates required configuration on startup
- [ ] Missing or placeholder Microsoft Client ID blocks execution
- [ ] User sees a clear, non-technical error dialog
- [ ] Console logs do not include secrets or values
- [ ] Application does not proceed to OAuth or launch logic when invalid

## Non-Goals
- No UI polish
- No OAuth flow changes beyond gating
- No runtime or Java work

## Files Expected to Change
- src/electron/main.ts (or equivalent entry)
- src/electron/config.ts (if not already present)
- docs/STOP_POINTS.md

## Implementation Notes
- Configuration must be read once at startup
- Validation must occur before any side effects
- Errors must be explicit and actionable
- Secrets must never be logged, even in debug mode

## Test Plan
- Launch app with missing MS_CLIENT_ID → blocked with error
- Launch app with placeholder value → blocked with error
- Launch app with valid value → proceeds normally
- Test on clean Windows VM
- Verify STOP_POINTS.md updated
