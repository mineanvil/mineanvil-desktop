# MineAnvil — Development Plan (Authoritative)

This document defines build order, not system design.

It enforces sequencing, stop points, and quality gates.
Deviation is not permitted without explicit revision.

---

## Development Philosophy

MineAnvil is developed using:
- Small, verifiable steps
- Hard stop points
- Clean-machine validation
- Deterministic outcomes

Speed is secondary to correctness.

---

## Layered Build Strategy

MineAnvil is built in layers.
Each layer is unlocked only when all stop points in the previous layer are complete.

Layers:
1. Ownership & Launch Control
2. Environment Control
3. Parent UX
4. Content Expansion
5. Monetisation & Licensing

---

# Layer 1 — Ownership & Launch Control

### Objective
Prove MineAnvil can reliably launch Minecraft on a clean Windows machine
with verified ownership and controlled runtime.

---

## Phase 1.1 — Identity & Ownership

### Build
- Microsoft OAuth integration
- Ownership verification
- Secure token handling

### Validation
- Login succeeds on clean machine
- Ownership failure is detected and surfaced
- No secrets appear in logs

---

## Phase 1.2 — Configuration Hardening

### Build
- Environment-based configuration
- Validation at startup
- Fail-fast behaviour

### Validation
- Missing config blocks execution
- Clear, user-safe error messages

---

## Phase 1.3 — Java Runtime Control

### Build
- Explicit Java runtime selection
- Version pinning
- Controlled download or bundling

### Validation
- No dependency on system Java
- Reproducible runtime behaviour

---

## Phase 1.4 — Instance Isolation

### Build
- Controlled directory structure
- Stable instance identity
- Safe re-run behaviour

### Validation
- No state corruption
- No cross-instance leakage

---

## Phase 1.5 — Launch Orchestration

### Build
- Deterministic launch arguments
- Process lifecycle tracking
- Log capture

### Validation
- Minecraft launches reliably
- Failures are detectable and logged

---

## Phase 1.6 — Failure Transparency

### Build
- Structured logging
- Error categorisation
- Plain-language error messages

### Validation
- Parent can understand failure cause
- Logs sufficient for support

---

## Layer 1 Completion Criteria

Layer 1 is complete only when:
- All stop points are checked off
- Clean Windows VM testing passes repeatedly
- No manual setup steps exist
- Re-running MineAnvil is safe and predictable

---

# Layer 2 — Environment Control

Locked until Layer 1 is complete.

---

## Phase 2.1 — Version Pinning

### Build
- Minecraft version control
- Java version persistence

---

## Phase 2.2 — Rollback & Recovery

### Build
- Reset and recovery workflows
- Snapshot or backup mechanism

---

## Phase 2.3 — Multi-Instance Support

### Build
- Multiple isolated environments
- Instance switching logic

---

## Layer 2 Completion Criteria

- Environments are reproducible
- Recovery does not require reinstall
- Instances do not interfere

---

# Layer 3 — Parent UX

Locked until Layer 2 is complete.

---

## Phase 3.1 — Guided Setup

### Build
- Step-by-step setup flow
- Plain language explanations

---

## Phase 3.2 — Safe Defaults

### Build
- Conservative default settings
- Explicit opt-in for advanced behaviour

---

## Phase 3.3 — Transparency

### Build
- Status indicators
- Clear terminology

---

## Layer 3 Completion Criteria

- Parent can use MineAnvil unaided
- No Minecraft knowledge required
- Behaviour is predictable

---

# Layer 4 — Content Expansion

Locked until Layer 3 is complete.

---

## Phase 4.1 — World Seeds

- Curated, reproducible seeds

---

## Phase 4.2 — Curated Worlds

- Pre-built, parent-approved worlds

---

## Phase 4.3 — Character Skins

- Safe creation and usage
- No third-party scraping

---

# Layer 5 — Monetisation & Licensing

Locked until Layer 4 is complete.

---

## Phase 5.1 — Licensed Content

- Approved creators
- Explicit licences

---

## Phase 5.2 — Revenue Model

- Transparent revenue splits
- No dark patterns

---

## Quality Gates (Apply to All Layers)

- Clean-machine testing
- Deterministic behaviour
- No silent failures
- No scope creep

---

## Change Control

Any change to this plan requires:
- Explicit documentation
- Updated stop points
- Rationale for deviation

Otherwise, this plan is final.
