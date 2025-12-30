# MineAnvil — Stop Points Checklist (Final & Authoritative)

This document is the scoreboard.

Progress is real only when items in this file are checked off.
All work must advance exactly one stop point at a time.

If it is not reflected here, it is not complete.

---

# Layer 1 — Ownership & Launch Control

Purpose:
Prove MineAnvil can reliably and safely launch Minecraft on a clean Windows
machine with verified ownership and a controlled runtime.

No Layer 2 work is permitted until ALL Layer 1 stop points are complete.

---

## Stop Point 1.1 — Clean Machine Launch

Definition:
Minecraft launches successfully via MineAnvil on a clean Windows machine,
with verified ownership and an explicitly controlled Java runtime.

### Identity & Ownership
- [done] Microsoft OAuth login completes successfully
- [ ] Minecraft ownership is verified
- [ ] Ownership failure is detected and blocked
- [ ] Clear, user-safe error shown on ownership failure
- [ ] No tokens or secrets written to logs

### Configuration
- [done] Microsoft Client ID is externally configurable
- [done] Missing or placeholder configuration fails fast
- [done] Startup failure messages are clear and actionable

### Java Runtime
- [done] Java runtime is explicitly managed by MineAnvil
- [done] No reliance on system Java or PATH
- [ ] Java version is pinned and documented
- [done] Java runtime is resolved and validated at startup (requires Java 17+)

### Instance Isolation
- [done] Unique instance directory is created
- [done] No writes occur outside controlled directories
- [done] Instance identity is stable across runs

### Launch
- [ ] Minecraft launches successfully
- [ ] Process lifecycle is tracked
- [ ] stdout and stderr are captured

### Environment Validation
- [ ] Tested on a clean Windows VM
- [ ] No manual setup steps required
- [ ] Launch succeeds repeatedly

---

## Stop Point 1.2 — Deterministic Re-run

Definition:
Re-running MineAnvil on the same machine produces the same outcome
without corruption, duplication, or undefined behaviour.

### Idempotency
- [ ] Setup steps are safe to re-run
- [ ] No duplicated files or directories are created
- [ ] No state corruption occurs on re-run

### Stability
- [ ] Instance layout remains consistent
- [ ] Re-launch does not alter prior state unexpectedly
- [ ] Behaviour matches previous run

### Validation
- [ ] Multiple consecutive runs tested
- [ ] Results are predictable and repeatable

---

## Stop Point 1.3 — Failure Transparency

Definition:
When something fails, the failure is visible, explainable, and actionable.

### Error Categorisation
- [done] Authentication failures are clearly identified
- [done] Ownership failures are clearly identified
- [done] Runtime failures are clearly identified
- [done] Launch failures are clearly identified

### User Experience
- [ ] Errors are written in plain language
- [ ] Parent can understand what went wrong
- [done] Retry is offered only when meaningful

### Logging
- [done] Logs are structured and readable
- [done] Log locations are predictable
- [done] Logs persist across runs
- [done] Logs contain no secrets

---

## Layer 1 Completion Criteria

Layer 1 is complete ONLY when:
- [ ] Stop Point 1.1 is fully complete
- [ ] Stop Point 1.2 is fully complete
- [ ] Stop Point 1.3 is fully complete
- [ ] Clean Windows VM testing passes repeatedly
- [ ] No undocumented assumptions exist

Only then may Layer 2 be unlocked.

---

# Layer 2 — Environment Control (LOCKED)

No work permitted until Layer 1 is complete.

Planned stop points:
- Version pinning
- Rollback and recovery
- Multi-instance control

---

# Layer 3 — Parent UX (LOCKED)

No work permitted until Layer 2 is complete.

---

# Layer 4 — Content Expansion (LOCKED)

Includes:
- World seeds
- Curated worlds
- Character skins

---

# Layer 5 — Monetisation & Licensing (LOCKED)

Includes:
- Licensed content
- Revenue sharing

---

## Final Rule

If a task does not advance a checklist item in this document,
it must not be built.
