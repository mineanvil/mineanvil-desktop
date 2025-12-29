# MineAnvil Guardrails (Authoritative)

This file defines hard constraints for all development work.
Cursor must treat this file as non-negotiable.

If any instruction conflicts with this file, THIS FILE WINS.

---

## 1. Build Order Is Mandatory

MineAnvil is built in layers with explicit stop points.

Allowed work:
- ONLY on the current active layer
- ONLY work that advances the current stop point

Forbidden work:
- Skipping layers
- “Preparing for later” unless explicitly required by the current stop point
- Building features for kids, parents, or monetisation before Layer 1 is complete

Reference:
- Execution Map
- Development Plan

---

## 2. Stop Points Are Gates, Not Suggestions

A stop point must be objectively verifiable.

A stop point is complete only when:
- Acceptance criteria are met
- A clean Windows machine test passes
- The STOP_POINTS.md checklist is updated

If a task does not move a stop point forward, it must be rejected.

---

## 3. Hard Non-Goals (BANNED)

The following are explicitly banned unless the execution map says otherwise:

- Replacing the Minecraft launcher
- Creating a new identity system
- Ads, tracking, analytics, or telemetry
- Social features (chat, friends, sharing)
- Marketplaces (skins, mods, worlds) before Layer 4
- EULA shortcuts or grey-area workarounds
- “Temporary hacks” that will be fixed later

If something feels like a shortcut, it probably is.

---

## 4. Identity and Trust Rules

- Microsoft identity ONLY
- No alternative auth
- No token leakage
- No secrets in logs
- Fail fast with clear user-facing errors
- Silent failure is unacceptable

---

## 5. Environment Rules

- Docker-first for development and tooling
- Windows VM is the reference target
- Clean-machine testing is mandatory
- No reliance on global PATH state
- Java runtime must be explicit and controlled

---

## 6. Cursor Behaviour Rules

Cursor must:
- Identify the layer and stop point before proposing work
- Propose the smallest viable step
- List files to change before changing them
- Include a test/verification plan
- Include verbose/debug options when troubleshooting

Cursor must NOT:
- Combine multiple tickets into one
- Refactor unrelated code “while here”
- Invent product requirements
- Change UX language without instruction

---

## 7. Product Invariants (Always True)

1. Parent-safe, boring, predictable software
2. Deterministic, reproducible environments
3. Clear failure states over clever behaviour

Violating any invariant is grounds for rejection.
