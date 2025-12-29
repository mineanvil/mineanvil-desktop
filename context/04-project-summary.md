# MineAnvil — Project Summary

## Project Name
MineAnvil

---

## One-Line Description

MineAnvil is a **parent-controlled execution layer for Minecraft Java Edition**
that provides deterministic setup, ownership verification, and safe reuse of
worlds and environments without modifying Minecraft itself.

---

## Purpose

MineAnvil exists to remove uncertainty from Minecraft usage.

It gives parents, facilitators, and educators control over:
- How Minecraft is launched
- Which environment is used
- What persists between sessions
- Why something failed when it fails

Minecraft remains the game.
MineAnvil controls the surrounding machinery.

---

## Core Principles

MineAnvil is built on the following principles:

1. **Determinism over convenience**  
   Predictable behaviour is more important than speed or novelty.

2. **Transparency over cleverness**  
   Clear failure states are preferred to silent recovery or hidden retries.

3. **Trust over growth**  
   Expansion only happens after stability and clarity are proven.

4. **Parents first**  
   If a parent cannot understand what is happening, the design is wrong.

---

## Target Users

Primary:
- Parents of children aged approximately 7–14
- Facilitators running Minecraft clubs or labs

Secondary:
- Schools
- After-school programmes
- Structured learning environments

MineAnvil is not designed for power users, modders, or competitive play.

---

## Problem Statement

Minecraft Java:
- Requires technical setup knowledge
- Depends on fragile Java environments
- Has unclear ownership and login states
- Pushes users toward unsafe third-party content sites

Parents want:
- Confidence that things will work
- A way to recover when they don’t
- Predictable behaviour across machines

MineAnvil bridges this gap.

---

## Scope Definition

### In Scope
- Microsoft identity integration
- Ownership verification
- Controlled Java runtime
- Instance isolation
- Deterministic launch
- Clear logging and diagnostics

### Out of Scope (for early layers)
- Launcher replacement
- Mods or mod loaders
- Social features
- Content marketplaces
- Ads, tracking, or telemetry

---

## Architectural Position

MineAnvil operates **outside Minecraft**.

It:
- Orchestrates setup
- Controls execution
- Manages environments

It does **not**:
- Patch Minecraft
- Inject code into the game
- Circumvent licensing or DRM

---

## Execution Model

MineAnvil is developed in strict layers with hard stop points.

Each layer:
- Solves a specific class of problems
- Unlocks the next layer only when complete
- Prevents premature feature creep

Later features (world seeds, skins, marketplaces) are impossible
without the foundation layers.

---

## Risk Management

Primary risks:
- Scope creep
- Undocumented assumptions
- Environment-specific behaviour
- Hidden technical debt

Mitigations:
- Hard guardrails
- Clean-machine testing
- Stop-point gating
- Deterministic design

---

## Success Definition

MineAnvil is successful when:
- A clean Windows machine can run Minecraft reliably
- Parents understand what MineAnvil is doing
- Failures are explainable and recoverable
- Support demand decreases, not increases

Anything beyond this is optimisation or expansion.

---

## Current Phase

MineAnvil is in **Layer 1: Ownership & Launch Control**.

All active work is focused on:
- Identity
- Runtime control
- Deterministic launch

All other layers are intentionally locked.
