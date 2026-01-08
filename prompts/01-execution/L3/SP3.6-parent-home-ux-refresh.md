# Stop Point 3.6 — Parent Home UX Refresh (Single-Path, Deterministic)

**Status**: Planning phase — NO IMPLEMENTATION YET

This document defines Stop Point 3.6 for Layer 3 — Parent UX.

---

## Stop Point 3.6 — Parent Home UX Refresh

### Definition

Implement the authoritative UX defined in `docs/ux/UX_FLOW_OVERVIEW.md` for the main application (Phase B). This stop point transforms the current Home screen into a single-path, deterministic UI that follows the locked UX document exactly. The implementation focuses on the HOME tab behavior and layout only, establishing the foundation for WORLDS, CURATED WORLDS, SEEDS, and MODS tabs in future stop points.

### Purpose

SP3.6 implements the core UX principles from the locked UX document:
- Minecraft-first mental model
- No technical burden
- Safe by default
- Progressive disclosure
- Single clear action per screen

This stop point:
- Implements HOME tab as defined in UX document
- Establishes navigation structure (HOME/WORLDS/CURATED WORLDS/SEEDS/MODS tabs)
- Creates consistent global layout with persistent header
- Removes technical diagnostics from primary view
- Ensures calm, parent-safe language throughout

### Authoritative UX Source (Locked)

The following document is **LOCKED AS AUTHORITATIVE TRUTH**:
- **File**: `docs/ux/UX_FLOW_OVERVIEW.md`
- **Status**: Read-only, must not be contradicted

All UX decisions in SP3.6 must align with this document.

---

## Hard Constraints (Non-Negotiable)

SP3.6 must:
- Implement exactly what is defined in `docs/ux/UX_FLOW_OVERVIEW.md` (no more, no less)
- Preserve all completed stop point functionality (SP1.1-SP1.7, SP3.1-SP3.4, SP4.1-SP4.3)
- Maintain lockfile recovery modal from previous work
- Keep Demo Mode as first-class state
- Use calm, parent-safe language (no technical jargon)
- Show single clear primary action per screen
- Not break existing behavior (launch, auth, installation)

SP3.6 must NOT:
- Implement WORLDS tab functionality (future stop point)
- Implement actual world creation/management (future stop point)
- Add new backend features or IPC handlers
- Change existing business logic
- Remove functionality that works
- Introduce technical UI elements
- Create urgency or pressure in copy

---

## UX Contract — HOME Tab

### Purpose (from UX doc)
"Start Minecraft itself"

### Primary Action
**"Play Minecraft"** button (large, prominent)

### Behavior
- Launches Minecraft using automatic profile (invisible to user)
- Shows progress if checks/downloads required
- No configuration options visible
- No version selector visible on HOME (advanced users can use Diagnostics)

### Mental Model
"This is where I start Minecraft"

### User Intent
Start playing Minecraft with default settings

### Current State vs. Target State

**Current HOME screen includes:**
- Environment Status card (SP3.1-SP3.4) ✅ Keep
- Account Status card with Sign in/Sign out ❌ Move to persistent header
- Launch Minecraft controls ❌ Simplify to single action
- Curated World Example (SP4.1) ✅ Keep
- Curated World Seeds (SP4.2) ✅ Keep
- Version input and advanced controls ❌ Move to Diagnostics
- Multiple competing actions ❌ Reduce to one primary action

**Target HOME screen:**
- Single primary action: "Play Minecraft" button
- Environment Status card (existing, keep as-is)
- Curated World Example (existing, keep as-is)
- Curated World Seeds (existing, keep as-is)
- Progress/status messages if Minecraft needs setup
- No account management (moved to header)
- No technical controls (moved to Diagnostics)

---

## UX Contract — Global Layout

### Persistent Header

Must display:
- Signed-in user name (if signed in)
- Minecraft status indicator:
  - "Ready" (green) — when owned and ready
  - "Demo Mode" (yellow) — when in demo mode
  - "Sign in required" (gray) — when signed out
- "Sign out" button (if signed in)
- "Refresh status" button

### Navigation Tabs (Primary)

Must display tabs in this order:
1. HOME (implemented in SP3.6)
2. WORLDS (stub in SP3.6, implemented later)
3. CURATED WORLDS (stub in SP3.6, implemented later)
4. SEEDS (stub in SP3.6, implemented later)
5. MODS (stub in SP3.6, implemented later)

**Important**: In SP3.6, only HOME tab is fully functional. Other tabs show "Coming soon" placeholder content.

### Tab Behavior

- Only one tab active at a time
- Active tab highlighted with visual indicator
- Tab switching updates main content area
- No global "Launch Minecraft" button (launch is on HOME tab only)

---

## UX Contract — Account Tab (Future)

Per the UX document, there should be an "Account" section. For SP3.6:
- Move account management to persistent header (sign in/out)
- Account status visible in header at all times
- Dedicated Account tab can be implemented in future stop point if needed

The UX document references "ACCOUNT" but primary account actions are in the persistent header.

---

## UX Contract — Diagnostics Tab

The UX document does not include a Diagnostics tab in the main navigation. For SP3.6:
- Keep existing Diagnostics tab for now
- Move to secondary/advanced navigation in future stop point
- Technical controls (version selection, runtime checks) remain in Diagnostics
- Not visible in primary navigation flow

---

## Implementation Scope

### In Scope for SP3.6

1. **Global Layout**
   - [ ] Create persistent header component
   - [ ] Add signed-in user display to header
   - [ ] Add Minecraft status indicator to header
   - [ ] Add Sign out button to header
   - [ ] Add Refresh status button to header

2. **Navigation Structure**
   - [ ] Create tab navigation component (HOME/WORLDS/CURATED WORLDS/SEEDS/MODS)
   - [ ] Implement tab switching state management
   - [ ] Add active tab visual indicator
   - [ ] Ensure keyboard accessibility for tab navigation

3. **HOME Tab Implementation**
   - [ ] Simplify to single primary action: "Play Minecraft" button
   - [ ] Remove account management (moved to header)
   - [ ] Remove version selector (moved to Diagnostics)
   - [ ] Remove advanced controls (moved to Diagnostics)
   - [ ] Keep Environment Status card (SP3.1-SP3.4)
   - [ ] Keep Curated World Example (SP4.1)
   - [ ] Keep Curated World Seeds (SP4.2)
   - [ ] Show progress/status messages if setup needed

4. **Stub Tabs (Placeholder Content)**
   - [ ] WORLDS tab: "Coming soon" message with brief explanation
   - [ ] CURATED WORLDS tab: "Coming soon" message with brief explanation
   - [ ] SEEDS tab: "Coming soon" message with brief explanation
   - [ ] MODS tab: "Coming soon" message with brief explanation

5. **Language Audit**
   - [ ] Replace technical jargon with parent-safe language
   - [ ] Ensure all copy follows UX document language guidelines
   - [ ] Remove urgency/pressure from all messaging
   - [ ] Use Minecraft terms (world, seed, launcher) appropriately

6. **Visual Consistency**
   - [ ] Use existing card patterns (from Environment Status)
   - [ ] Maintain calm, professional styling
   - [ ] Ensure consistent spacing and layout
   - [ ] Keep accessibility attributes (ARIA, keyboard nav)

### Out of Scope for SP3.6

- ❌ WORLDS tab functionality (world management, launch from worlds)
- ❌ CURATED WORLDS tab functionality (world creation from templates)
- ❌ SEEDS tab functionality (world creation from seeds)
- ❌ MODS tab functionality (modded world management)
- ❌ World ordering rules (implemented with WORLDS tab later)
- ❌ World actions (Launch, Backup, Delete, Share seed)
- ❌ Empty state handling for worlds
- ❌ Demo Mode world display
- ❌ Backend or IPC changes
- ❌ New state management systems
- ❌ Profile management UI (automatic profiles remain invisible)
- ❌ Advanced configuration screens

---

## Acceptance Criteria

SP3.6 is complete ONLY when:

### 1. Global Layout
- [ ] Persistent header appears at top of application
- [ ] Header shows signed-in user name (when signed in)
- [ ] Header shows Minecraft status indicator with correct state
- [ ] Header shows "Sign out" button (when signed in)
- [ ] Header shows "Refresh status" button
- [ ] Header is visible on all tabs

### 2. Navigation Structure
- [ ] Five tabs appear: HOME, WORLDS, CURATED WORLDS, SEEDS, MODS
- [ ] Tabs are in correct order per UX document
- [ ] Only one tab is active at a time
- [ ] Active tab has visual indicator
- [ ] Clicking tab switches main content area
- [ ] Tab navigation is keyboard accessible

### 3. HOME Tab
- [ ] Single primary action: "Play Minecraft" button (large, prominent)
- [ ] Environment Status card appears (existing SP3.1-SP3.4 work)
- [ ] Curated World Example appears (existing SP4.1 work)
- [ ] Curated World Seeds appear (existing SP4.2 work)
- [ ] No account management UI on HOME (moved to header)
- [ ] No version selector on HOME (moved to Diagnostics)
- [ ] No advanced controls on HOME (moved to Diagnostics)
- [ ] Progress/status messages appear if setup needed

### 4. Stub Tabs
- [ ] WORLDS tab shows "Coming soon" placeholder
- [ ] CURATED WORLDS tab shows "Coming soon" placeholder
- [ ] SEEDS tab shows "Coming soon" placeholder
- [ ] MODS tab shows "Coming soon" placeholder
- [ ] Placeholders use calm, parent-safe language
- [ ] Placeholders explain what tab will do when implemented

### 5. Language Compliance
- [ ] All copy uses calm, parent-safe language
- [ ] No technical jargon in primary UI
- [ ] No urgency or pressure in messaging
- [ ] Minecraft terms used appropriately
- [ ] Copy aligns with UX document language guidelines

### 6. Preserved Functionality
- [ ] Lockfile recovery modal still works
- [ ] Demo Mode still works as first-class state
- [ ] Sign in/sign out functionality works
- [ ] Launch Minecraft functionality works
- [ ] Environment Status safety signals work
- [ ] Escalation copy works (SP3.4)
- [ ] Curated world examples visible (SP4.1-SP4.3)

### 7. Technical Constraints
- [ ] No new backend features added
- [ ] No new IPC handlers added
- [ ] No changes to business logic
- [ ] No broken existing functionality
- [ ] Code remains maintainable
- [ ] Accessibility maintained (ARIA, keyboard nav)

---

## Validation Checklist

Before marking SP3.6 complete, verify:

### Global Layout Verification
- [ ] Header appears on all tabs
- [ ] User name displays correctly when signed in
- [ ] Status indicator shows correct state (Ready/Demo Mode/Sign in required)
- [ ] Sign out button works and is only visible when signed in
- [ ] Refresh status button works and updates status correctly

### Navigation Verification
- [ ] All five tabs appear in correct order
- [ ] Tab switching works correctly
- [ ] Active tab indicator works
- [ ] Keyboard navigation works (Tab, Enter, Arrow keys)
- [ ] Tab content changes when switching tabs

### HOME Tab Verification
- [ ] "Play Minecraft" button appears and works
- [ ] Button launches Minecraft with default profile
- [ ] Environment Status card displays correctly
- [ ] Curated World Example displays correctly
- [ ] Curated World Seeds display correctly
- [ ] No account management on HOME (moved to header)
- [ ] No version selector on HOME (moved to Diagnostics)

### Stub Tab Verification
- [ ] Each stub tab shows appropriate placeholder
- [ ] Placeholders use calm language
- [ ] Placeholders explain future functionality
- [ ] No broken functionality when viewing stubs

### Language Verification
- [ ] Audit all visible text for technical jargon
- [ ] Audit all visible text for urgency/pressure
- [ ] Verify Minecraft terms used correctly
- [ ] Verify alignment with UX document language guidelines

### Regression Testing
- [ ] Launch Minecraft still works
- [ ] Sign in/sign out still works
- [ ] Demo Mode still works
- [ ] Lockfile recovery modal still works
- [ ] Environment Status safety signals still work
- [ ] Escalation copy still works
- [ ] Curated examples still visible

### UX Document Compliance
- [ ] HOME tab matches UX document definition
- [ ] Global layout matches UX document definition
- [ ] Navigation structure matches UX document definition
- [ ] No contradictions with locked UX document
- [ ] Mental model preserved ("This is where I start Minecraft")

---

## Explicit Non-Goals (Not Implemented)

SP3.6 does NOT include:

### Deferred to Future Stop Points
- World management functionality (WORLDS tab)
- World creation from templates (CURATED WORLDS tab)
- World creation from seeds (SEEDS tab)
- Modded world management (MODS tab)
- World ordering by last played
- World actions (Launch, Backup, Delete, Share seed)
- Empty state handling for worlds
- Demo Mode world display
- World invites
- Remote server worlds
- Profile management UI

### Explicitly Out of Scope
- Backend feature additions
- IPC handler additions
- Business logic changes
- New state management systems
- Advanced configuration screens
- Technical diagnostics in primary UI
- File path displays
- Version number displays (except Minecraft versions)
- Permissions tuning
- Java runtime controls (in primary UI)

---

## Implementation Notes

### File Structure

Expected files to modify:
- `src/App.tsx` — Main layout, navigation, HOME tab
- `src/App.css` — Styling for new layout and navigation
- Other component files as needed (keep minimal)

### Code Organization

- Keep components in `src/App.tsx` for now (don't over-engineer)
- Use existing patterns from Environment Status card
- Reuse existing state management (useState hooks)
- Maintain existing type imports from IPC types

### Styling Guidelines

- Reuse existing card patterns
- Maintain consistent spacing
- Use calm, professional colors
- Keep accessibility in mind (contrast, focus states)
- No dramatic visual changes (this is UX restructuring, not redesign)

### Testing Approach

Manual testing checklist:
1. Sign in flow works
2. Sign out flow works
3. Demo Mode displays correctly
4. Launch Minecraft works from HOME
5. Tab switching works
6. All existing features still work
7. Lockfile recovery modal still works
8. Language is parent-safe throughout

---

## Relationship to Other Stop Points

### Prerequisites (Must Be Complete)
- ✅ SP1.1-SP1.7 (Layer 1 complete)
- ✅ SP3.1-SP3.4 (Environment visibility and safety)
- ✅ SP4.1-SP4.3 (Curated world examples)

### Enables (Blocked Until SP3.6 Complete)
- ⏳ SP3.5 — Activity & Progress Visibility (not started yet)
- ⏳ SP3.7 — Long-task Timeouts (not started yet)
- ⏳ Future stop points for WORLDS, CURATED WORLDS, SEEDS, MODS tabs

### Does Not Block
- Other Layer 1-2 work (infrastructure)
- Documentation work
- Testing infrastructure improvements

---

## INSERT INTO STOP POINTS CHECKLIST

Add the following section to `docs/STOP_POINTS.md` under "Layer 3 — Parent UX":

```markdown
## Stop Point 3.6 — Parent Home UX Refresh (Single-Path, Deterministic)

Definition:
Implement the authoritative UX defined in `docs/ux/UX_FLOW_OVERVIEW.md` for the main application. Transform the current Home screen into a single-path, deterministic UI that follows the locked UX document. Establish navigation structure (HOME/WORLDS/CURATED WORLDS/SEEDS/MODS), implement HOME tab fully, create persistent header with account status, and ensure calm parent-safe language throughout.

### Global Layout
- [ ] Persistent header with: user name, status indicator, sign out, refresh status
- [ ] Tab navigation: HOME, WORLDS, CURATED WORLDS, SEEDS, MODS
- [ ] Only HOME tab fully functional in SP3.6
- [ ] Other tabs show "Coming soon" placeholders

### HOME Tab Implementation
- [ ] Single primary action: "Play Minecraft" button (large, prominent)
- [ ] Environment Status card (SP3.1-SP3.4, preserved)
- [ ] Curated World Example (SP4.1, preserved)
- [ ] Curated World Seeds (SP4.2, preserved)
- [ ] Account management moved to header
- [ ] Version selector moved to Diagnostics
- [ ] Advanced controls moved to Diagnostics

### Language Compliance
- [ ] All copy uses calm, parent-safe language
- [ ] No technical jargon in primary UI
- [ ] No urgency or pressure in messaging
- [ ] Aligns with UX document language guidelines

### Preserved Functionality
- [ ] Lockfile recovery modal works
- [ ] Demo Mode works as first-class state
- [ ] Sign in/sign out works
- [ ] Launch Minecraft works
- [ ] All SP3.1-SP3.4 and SP4.1-SP4.3 features work

### Technical Constraints
- [ ] No new backend features
- [ ] No new IPC handlers
- [ ] No business logic changes
- [ ] No broken existing functionality
- [ ] Accessibility maintained

### Explicit Non-Goals (Deferred)
SP3.6 does NOT implement:
- WORLDS tab functionality
- CURATED WORLDS tab functionality
- SEEDS tab functionality
- MODS tab functionality
- World management, ordering, actions
- Profile management UI
- Advanced configuration screens

Evidence / notes:
- [ ] Planning document: `prompts/01-execution/L3/SP3.6-parent-home-ux-refresh.md`
- [ ] UX authority: `docs/ux/UX_FLOW_OVERVIEW.md` (locked)
- [ ] Implementation evidence (when complete)

**Current Status**: ⏳ **SP3.6 is PLANNED** (not yet implemented).
```

---

**Document Status**: Planning complete. Ready for review before implementation.
