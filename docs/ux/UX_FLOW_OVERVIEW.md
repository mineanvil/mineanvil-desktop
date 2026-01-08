# MineAnvil UX Flow Overview

**Document Type:** Authoritative UX Reference
**Last Updated:** 2026-01-08
**Scope:** User experience flow definition only

---

## What MineAnvil Is

MineAnvil is a desktop-first orchestration layer for Minecraft Java Edition designed for parents.

**MineAnvil is NOT:**
- A Minecraft distributor
- A replacement for the official launcher
- A technical configuration tool

**MineAnvil IS:**
- A calm, predictable way to set up and start Minecraft
- Parent-first in language and design
- Deterministic and safe by default

---

## Core UX Principles

These principles must be preserved in all UX decisions:

1. **Minecraft-first mental model**
   Users think in terms of playing Minecraft, not managing software.

2. **No technical burden**
   No profiles, JVMs, versions, paths, or install logic exposed to users.

3. **Safe by default**
   Design for parents and children first.

4. **Progressive disclosure**
   Show complexity only when necessary.

5. **Single clear action per screen**
   No competing primary actions.

---

## UX Structure

MineAnvil has two distinct phases:

- **Phase A: One-Time Setup** — Occurs on first run or when something breaks
- **Phase B: Daily Use** — Occurs once setup is complete

---

## Phase A: One-Time Setup

Setup is a linear flow with clear states. Users progress through these states once.

### State 0: Welcome

**Purpose:** Explain what MineAnvil does

**UI Elements:**
- MineAnvil branding
- One sentence: "MineAnvil makes Minecraft simple and safe for families"
- One primary button: "Get Started"

**User Intent:** Understand what this is and begin setup

---

### State 1: Microsoft Sign-In

**Purpose:** Authenticate user with Microsoft account

**UI Elements:**
- Explanation: "Sign in with your Microsoft account to verify Minecraft ownership"
- Primary button: "Sign in with Microsoft"
- Secondary text: "We'll open your browser to complete sign-in"

**Outcomes:**
- Success → Advance to State 2
- Failure → Show error with retry option

**User Intent:** Provide authentication

---

### State 2: Minecraft License Resolution

This is ONE state with two possible outcomes.

#### Outcome 2A: License Not Found

**Message:** "We couldn't find a Minecraft license for this account"

**Options (equal weight):**
1. "Open Minecraft website" — Opens purchase page
2. "Check again" — Retries license verification
3. "Continue in Demo Mode" — Proceeds with limited access

**Important:** Demo Mode is a valid first-class state, not an error condition.

#### Outcome 2B: License Verified

**Message:** "Minecraft license verified"

**Behavior:** Automatically advances to State 3

**User Intent:** Resolve license status

---

### State 3: Minecraft Setup

**Purpose:** Download and prepare Minecraft files

**UI Elements:**
- Status messages:
  - "Checking installation"
  - "Downloading Minecraft"
  - "Preparing game files"
- Progress indicator
- No user action required

**Outcomes:**
- Success → Advance to main application
- Failure → Advance to State 3E

**Background Behavior (Invisible to User):**
- MineAnvil automatically creates a default game profile
- No manual configuration
- User never sees profile creation

**User Intent:** Wait for setup to complete

---

### State 3E: Setup Error

**Purpose:** Handle setup failures calmly

**UI Elements:**
- Calm, non-panic error message
- Explanation of what went wrong (parent-friendly language)
- Primary action: "Try again"
- Secondary actions:
  - "Ask for help"
  - "View diagnostics"

**Design Pattern:** Reuses existing error UX pattern

**User Intent:** Resolve issue and proceed

---

## Phase B: Main Application

Once setup is complete, users enter the main application.

### Global Layout

**Persistent Header:**
- Signed-in user name
- Minecraft status indicator:
  - "Ready" (green)
  - "Demo Mode" (yellow)
- "Sign out" button
- "Refresh status" button

**Navigation Tabs (Primary):**
1. HOME
2. WORLDS
3. CURATED WORLDS
4. SEEDS
5. MODS

**Important:** There is NO global "Launch Minecraft" button.

---

## Tab: HOME

**Purpose:** Start Minecraft itself

**Primary Action:** "Play Minecraft" button (large, prominent)

**Behavior:**
- Launches Minecraft using automatic profile
- If checks or downloads are required, shows progress
- No configuration options visible

**Mental Model:** "This is where I start Minecraft"

**User Intent:** Start playing Minecraft with default settings

---

## Tab: WORLDS

**Purpose:** Central hub for playing and managing worlds

**Mental Model:** "This is where I play and manage my Minecraft worlds"

### Sections

1. **World Invites**
   - Shows pending invites from friends
   - Action: Accept/Decline

2. **My Local Worlds**
   - Shows all local single-player worlds
   - Sorted by last played date (most recent first)
   - Most recently played world may be visually marked

3. **My Remote Server Worlds**
   - Shows multiplayer server connections
   - Sorted by last played date

### World Actions

Available for each world:
- **Launch** — Primary action, always explicit
- **Backup** — Creates backup copy
- **Delete** — Removes world (with confirmation)
- **Share seed** — Shows seed for sharing

### World Ordering Rule

- Worlds are sorted by last played date (most recent first)
- Last played world may have visual indicator
- Explicit "Launch" action is ALWAYS required
- Never auto-launch a world

### Important Behaviors

- Worlds are launched HERE, not created here
- Users never see world file paths
- Backup and delete are calm, reversible where possible

---

## Tab: WORLDS (Empty State)

**Purpose:** Guide new users to create their first world

**UI Elements:**
- Friendly message: "No worlds yet! Let's create one."
- Guidance pointing to:
  - "Curated Worlds" tab
  - "Seeds" tab
  - "Mods" tab (future)

**Mental Model:** "I need to create a world first"

**User Intent:** Learn how to create a world

---

## Tab: WORLDS (Demo Mode)

**Purpose:** Provide limited gameplay in Demo Mode

**UI Elements:**
- Single "Demo World" entry
- Action: "Play Demo"
- Explanation: "Demo Mode — limited gameplay"

**Behavior:**
- Launches Minecraft in demo mode
- No other worlds visible

**User Intent:** Try Minecraft without purchasing

---

## Tab: CURATED WORLDS

**Purpose:** Create worlds from safe, predefined templates

**Mental Model:** "I want to start a world that's already set up"

**UI Elements:**
- List of curated world templates
- Each template shows:
  - Name
  - Description (parent-friendly)
  - Preview image
  - Tags (e.g., "Exploration", "Building", "Family-friendly")

**Primary Action:** "Create and Launch"

**Behavior:**
1. Creates world from template
2. Adds world to WORLDS tab
3. Immediately launches the world

**User Intent:** Start a safe, pre-configured world quickly

---

## Tab: SEEDS

**Purpose:** Create worlds from specific seeds

**Mental Model:** "I want to create a world using a seed number"

**UI Elements:**
- Seed input field
- World name field
- Optional description field
- List of pre-approved safe seeds with:
  - Name
  - Description
  - Seed number
  - "Use this seed" button

**Primary Action:** "Create World"

**Behavior:**
1. Creates world with specified seed
2. Adds world to WORLDS tab
3. User returns to WORLDS to launch

**User Intent:** Create a world from a specific seed

---

## Tab: MODS

**Purpose:** (Future functionality stub)

**Status:** Visible but minimal

**UI Elements:**
- List of curated modded world templates
- Honest messaging about setup time
- Clear progress indicators
- "Coming soon" or limited availability messaging

**Design Principle:** Visible but not misleading

**User Intent:** Explore modded Minecraft options (future)

---

## Explicit Non-Goals

The following are explicitly NOT part of MineAnvil UX:

- World edit screens (name, settings, game rules)
- Profile management UI
- Advanced configuration screens
- Java version selection
- Memory allocation controls
- Permissions tuning UI
- File path displays
- Technical diagnostics (except in error states)

---

## Language Guidelines

All user-facing text must follow these guidelines:

**DO:**
- Use calm, parent-safe language
- Explain outcomes, not mechanisms
- Use Minecraft terms (world, seed, launcher)
- Be honest about wait times

**DON'T:**
- Use technical jargon (JVM, manifest, artifacts)
- Expose file paths
- Show version numbers (except Minecraft versions)
- Create panic or urgency

---

## End of Document

This document defines the authoritative UX flow for MineAnvil. Implementation details, persistence strategies, testing approaches, and edge case handling are explicitly out of scope.
