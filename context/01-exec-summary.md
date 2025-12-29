# MineAnvil — Executive Summary

## What MineAnvil Is

MineAnvil is a **parent-safe control plane for Minecraft Java Edition**.

It is not a launcher replacement, not a mod platform, and not a social network.

MineAnvil exists to give parents and facilitators **deterministic control** over:
- Ownership verification
- Runtime environment
- World creation and reuse
- Child-safe content pathways
- Predictable, repeatable Minecraft setups

MineAnvil removes ambiguity and guesswork from Minecraft usage without altering the game itself.

---

## The Core Problem

Minecraft Java is powerful but fragile for non-technical users.

Parents face:
- Confusing setup processes
- Inconsistent Java environments
- Unclear ownership and login states
- Unsafe third-party sites for skins and worlds
- Broken worlds, corrupted installs, and “it worked yesterday” failures

Children want to play.
Parents want certainty.
Existing tools provide neither.

---

## The MineAnvil Solution

MineAnvil sits **above Minecraft**, not inside it.

It provides:
- Verified Microsoft identity and ownership checks
- Controlled Java runtime management
- Isolated, reproducible Minecraft instances
- Safe pathways for worlds, skins, and content (later layers)
- Clear failure states instead of silent breakage

Minecraft remains untouched.
MineAnvil controls everything around it.

---

## Product Philosophy

MineAnvil is deliberately:
- Boring
- Predictable
- Deterministic
- Parent-first

Clever tricks, shortcuts, and “temporary hacks” are explicitly avoided.

If something cannot be explained clearly to a parent, it does not ship.

---

## Layered Execution Model

MineAnvil is built in strict layers with hard stop points.

### Layer 1 — Ownership & Launch Control
- Microsoft OAuth
- Ownership verification
- Java runtime control
- Clean-machine launch

### Layer 2 — Environment Control
- Deterministic re-runs
- Version pinning
- Rollback and recovery

### Layer 3 — Parent UX
- Plain-language controls
- Guided setup
- No Minecraft jargon

### Layer 4 — Content Expansion
- World seeds
- Curated worlds
- Character skins
- Marketplaces (approved, licensed only)

No layer may begin until the previous layer’s stop points are complete.

---

## What MineAnvil Is Not

MineAnvil is explicitly **not**:
- A Minecraft launcher replacement
- A mod loader
- A skin scraping site
- A social platform
- An ad-supported product
- A grey-area EULA workaround

Minecraft authentication, licensing, and runtime rules are respected at all times.

---

## Target User

Primary:
- Parents with children aged ~7–14
- Facilitators running clubs, classrooms, or labs

Secondary:
- Schools
- After-school programs
- Structured learning environments

MineAnvil is designed for **trust**, not novelty.

---

## Success Criteria

MineAnvil is successful when:
- A clean Windows machine can launch Minecraft reliably
- Parents understand what is happening
- Children play without breaking things
- Worlds and environments persist predictably
- Support questions drop instead of increase

If those conditions are met, expansion follows naturally.

---

## Current Status

MineAnvil is in **Layer 1 development**.

All current work is focused on:
- Ownership verification
- Environment control
- Clean, repeatable launch

Everything else is intentionally locked.
