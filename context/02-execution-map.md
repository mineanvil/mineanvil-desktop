# MineAnvil — Execution Map (Authoritative)

This document defines the ONLY valid build sequence for MineAnvil.

All work must:
- Belong to a defined layer
- Advance a defined stop point
- Respect locked layers

If a task does not move a stop point forward, it must not be built.

---

## Layer Model Overview

MineAnvil is built in sequential layers.
Each layer has one or more stop points.
Stop points are hard gates.

Layers are:
1. Ownership & Launch Control
2. Environment Control
3. Parent UX
4. Content Expansion
5. Monetisation & Licensing

No layer may begin until the previous layer is complete.

---

# Layer 1 — Ownership & Launch Control

Purpose:
Prove MineAnvil can reliably and safely launch Minecraft on a clean machine.

Scope:
- Identity verification
- Runtime control
- Instance isolation
- Launch reliability

Non-goals:
- UX polish
- Content discovery
- Customisation features

---

## Stop Point 1.1 — Clean Machine Launch

Definition:
Minecraft launches successfully via MineAnvil on a clean Windows machine,
with verified ownership and controlled runtime.

Required Capabilities:
- Microsoft OAuth login
- Ownership verification
- Explicit Java runtime selection
- Isolated instance directory
- Structured logging

Success Criteria:
- No manual setup steps
- Clear errors on failure
- Repeatable success on re-run

---

## Stop Point 1.2 — Deterministic Re-run

Definition:
Re-running MineAnvil on the same machine produces the same result.

Required Capabilities:
- Stable instance layout
- Idempotent setup steps
- Safe re-launch behaviour

Success Criteria:
- No corruption on re-run
- No duplicated state
- Predictable outcomes

---

## Stop Point 1.3 — Failure Transparency

Definition:
Failures are visible, explainable, and actionable.

Required Capabilities:
- Structured logs
- User-safe error messages
- Clear distinction between auth, runtime, and launch failures

Success Criteria:
- Parent can explain the failure in plain language
- Logs are sufficient for support without guesswork

---

# Layer 2 — Environment Control

Purpose:
Make Minecraft environments reproducible, recoverable, and controllable.

Locked Until:
All Layer 1 stop points complete.

---

## Stop Point 2.1 — Version Pinning

Definition:
Minecraft and Java versions are explicitly pinned per instance.

Required Capabilities:
- Version selection
- Version persistence
- No silent upgrades

---

## Stop Point 2.2 — Rollback & Recovery

Definition:
Broken environments can be reset or rolled back safely.

Required Capabilities:
- Snapshot or backup mechanism
- Reset workflow
- Clear user-facing recovery paths

---

## Stop Point 2.3 — Multi-Instance Control

Definition:
Multiple isolated environments can coexist without conflict.

Required Capabilities:
- Instance switching
- Storage isolation
- Clear instance identity

---

# Layer 3 — Parent UX

Purpose:
Expose power safely without requiring Minecraft knowledge.

Locked Until:
All Layer 2 stop points complete.

---

## Stop Point 3.1 — Guided Setup

Definition:
A parent can set up MineAnvil without external documentation.

Required Capabilities:
- Step-by-step flow
- Plain language explanations
- No Minecraft jargon

---

## Stop Point 3.2 — Safe Defaults

Definition:
Default choices are safe and conservative.

Required Capabilities:
- Curated defaults
- Explicit opt-in for advanced behaviour

---

## Stop Point 3.3 — Transparency

Definition:
Parents can see what MineAnvil is doing and why.

Required Capabilities:
- Status views
- Clear terminology
- Predictable behaviour

---

# Layer 4 — Content Expansion

Purpose:
Introduce content safely and intentionally.

Locked Until:
All Layer 3 stop points complete.

---

## Stop Point 4.1 — World Seeds

Definition:
Curated, reproducible world seeds.

---

## Stop Point 4.2 — Curated Worlds

Definition:
Pre-built, parent-approved worlds.

---

## Stop Point 4.3 — Character Skins

Definition:
Safe, controlled skin creation and usage.

---

# Layer 5 — Monetisation & Licensing

Purpose:
Sustainable growth without compromising trust.

Locked Until:
All prior layers complete.

---

## Stop Point 5.1 — Licensed Content

Definition:
Licensed skins and worlds from approved creators.

---

## Stop Point 5.2 — Revenue Split

Definition:
Transparent creator and platform revenue sharing.

---

## Final Notes

- Earlier layers must NEVER be weakened to support later layers
- Any shortcut that reduces determinism or trust is rejected
- MineAnvil optimises for reliability first, expansion second
