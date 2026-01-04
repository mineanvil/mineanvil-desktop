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
- [done] Minecraft ownership is verified
- [done] Ownership failure is detected and blocked
- [done] Clear, user-safe error shown on ownership failure
- [done] No tokens or secrets written to logs

### Configuration
- [done] Microsoft Client ID is externally configurable
- [done] Missing or placeholder configuration fails fast
- [done] Startup failure messages are clear and actionable

### Java Runtime
- [done] Java runtime is explicitly managed by MineAnvil
- [done] No reliance on system Java or PATH
- [done] Java version is pinned and documented
- [done] Java runtime is resolved and validated at startup (requires Java 17+)

### Instance Isolation
- [done] Unique instance directory is created
- [done] No writes occur outside controlled directories
- [done] Instance identity is stable across runs

### Launch
- [done] Minecraft launches successfully
- [done] Process lifecycle is tracked
- [done] stdout and stderr are captured

### Environment Validation
- [done] Tested on a clean Windows VM
- [done] No manual setup steps required
- [done] Launch succeeds repeatedly

---

## Stop Point 1.2 — Deterministic Re-run

Definition:
Re-running MineAnvil on the same machine produces the same outcome
without corruption, duplication, or undefined behaviour.

Evidence / notes:
- [done] Repeatability validation test plan is documented (`docs/SP1.2-repeatability-validation.md`)
- [done] Stability verification checklist is documented (`docs/SP1.2-stability-verification.md`)
- [done] Validation run report worksheet is documented (`docs/SP1.2-validation-run-report.md`)

### Idempotency
- [done] Setup steps are safe to re-run
- [done] No duplicated files or directories are created
- [done] No state corruption occurs on re-run

### Stability
- [done] Instance layout remains consistent
- [done] Re-launch does not alter prior state unexpectedly
- [done] Behaviour matches previous run

### Validation
- [done] Multiple consecutive runs tested
- [done] Results are predictable and repeatable

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
- [done] Errors are written in plain language
- [done] Parent can understand what went wrong
- [done] Retry is offered only when meaningful

### Logging
- [done] Logs are structured and readable
- [done] Log locations are predictable
- [done] Logs persist across runs
- [done] Logs contain no secrets

Evidence / notes:
- [done] Logging persistence note is documented (`docs/SP1.3-logging-persistence.md`)

---

## Layer 1 Completion Criteria

Layer 1 is complete ONLY when:
- [done] Stop Point 1.1 is fully complete
- [done] Stop Point 1.2 is fully complete
- [done] Stop Point 1.3 is fully complete
- [done] Clean Windows VM testing passes repeatedly
- [done] No undocumented assumptions exist

Only then may Layer 2 be unlocked.

**Current Status**: ✅ **Layer 1 is COMPLETE**. All stop points validated on clean Windows VM. See `docs/L1-final-validation-run.md` for validation evidence.

---

# Layer 2 — Environment Control

Purpose:
Control the Minecraft Java environment with version pinning, rollback, and multi-instance management.

---

## Stop Point 2.1 — Pack Manifest

Definition:
A minimal, declarative Pack Manifest is introduced as the authoritative source of truth for a managed Minecraft Java environment.

### Manifest Structure
- [done] PackManifest v1 structure is defined and versioned
- [done] Manifest is declarative, not imperative
- [done] Manifest fields are stable across repeated runs

### Manifest Lifecycle
- [done] Manifest is created deterministically on first run
- [done] Existing runs load and trust the manifest as authoritative
- [done] Manifest contents are stable across repeated runs on the same machine
- [done] Corrupt or missing manifest fails safely with clear error (no silent regeneration)

### Integration
- [done] Manifest is loaded at startup in main.ts
- [done] Helper script `scripts/print-pack-manifest.ts` supports verbose output
- [done] Documentation is created (`docs/SP2.1-pack-manifest.md`)

### Non-Goals (Not Implemented)
- No installation, mutation, or rollback logic is introduced
- No UI or invite-code integration
- No pack installation logic

Evidence / notes:
- [done] Implementation documented in `docs/SP2.1-pack-manifest.md`
- [done] Manifest structure defined in `electron/src/main/pack/packManifest.ts`
- [done] Manifest loader implemented in `electron/src/main/pack/packManifestLoader.ts`

---

## Stop Point 2.2 — Deterministic Install

Definition:
Minecraft Java environment is installed deterministically from an immutable install lockfile that declares all required artefacts and checksums. The same manifest+lockfile always produces the same on-disk result, and launch does not perform uncontrolled downloads.

### Lockfile
- [done] Lockfile is created at `%APPDATA%\MineAnvil\instances\<instanceId>\pack\lock.json` (atomic write)
- [done] Lockfile contains complete, pinned list of vanilla artefacts: version json, client jar, asset index, assets, libraries, natives, runtime archive
- [done] If lockfile exists, it is treated as authoritative
- [done] If lockfile is corrupt or mismatched, fail loudly (no silent regeneration)
- [done] PackManifest remains immutable (no mutation to fill in lock data)

### Deterministic Installation
- [done] All downloads are verified against checksums declared in lockfile (not remote metadata at verification time)
- [done] Deterministic install installs the full set from lockfile (no "download on launch" for these artefacts)
- [done] Installation output is fully determined by lockfile contents
- [done] Installation writes only to controlled instance directories
- [done] Re-running install with the same manifest+lockfile produces no changes (idempotent)
- [done] Any mismatch or corruption causes a hard, user-visible failure

### Complete Installation Scope
- [done] Installs all libraries + natives needed for vanilla launch
- [done] Installs asset index and required assets (as defined by index)
- [done] Installs version json + client jar
- [done] Installs Java runtime (if managed)

### Idempotency
- [done] Installation is idempotent (same lockfile + same state = same result)
- [done] Already-installed artefacts are detected and skipped
- [done] Verification of existing installations uses lockfile checksums

### Integration
- [done] Lockfile is loaded or generated at startup after manifest load
- [done] Installer is called automatically with lockfile
- [done] Installation failures abort startup with clear error dialog
- [done] All logs are structured and secret-free

### Non-Goals (Not Implemented)
- No rollback or recovery logic (SP2.3)
- No auto-repair or silently fixing broken installs
- No UI for install control (Layer 3)
- No support for multiple packs or switching

Evidence / notes:
- [done] Implementation documented in `docs/SP2.2-deterministic-install.md`
- [done] Lockfile structure defined in `electron/src/main/pack/packLockfile.ts`
- [done] Lockfile loader implemented in `electron/src/main/pack/packLockfileLoader.ts`
- [done] Install planner updated in `electron/src/main/install/installPlanner.ts`
- [done] Deterministic installer updated in `electron/src/main/install/deterministicInstaller.ts`
- [done] Helper script created: `scripts/print-pack-lockfile.ts`

---

## Stop Point 2.3 — Rollback & Recovery

Definition:
MineAnvil can safely recover from partial or corrupt installs of lockfile-declared artefacts without manual intervention. Installation writes occur in a staging area first, then are atomically promoted to final locations. If an install is interrupted, the next run can resume from staging, rollback to last-known-good, or fail with clear next steps.

### Staging & Atomic Promote
- [done] Installation writes occur in staging area first (`%APPDATA%\MineAnvil\instances\<instanceId>\.staging\pack-install\`)
- [done] All artifacts are verified in staging before promotion
- [done] Artifacts are atomically promoted from staging to final locations (no half-written live artefacts)
- [done] Staging directory is cleaned up after successful promotion

### Recovery from Interruption
- [done] If install is interrupted, next run checks staging area for recoverable artifacts
- [done] Valid staging artifacts are resumed (promoted directly, no re-download)
- [done] Corrupted staging artifacts are removed and re-downloaded
- [done] Recovery decision is logged for troubleshooting
- [done] If recovery fails, fails with clear, user-visible message that includes next steps

### Last-Known-Good Snapshots
- [done] Last-known-good snapshot exists for validated artifacts (`%APPDATA%\MineAnvil\instances\<instanceId>\.rollback\<timestamp>-<version>\`)
- [done] Snapshot contains manifest of validated artifacts (names, paths, checksums, sizes, authority)
- [done] Snapshots are created after successful installation
- [done] Snapshots enable rollback capability

### Quarantine
- [done] Corrupted files are quarantined instead of deleted (`%APPDATA%\MineAnvil\instances\<instanceId>\.quarantine\`)
- [done] Quarantined files are preserved for inspection
- [done] Quarantine action is logged for troubleshooting

### Immutability
- [done] Rollback and recovery never mutate PackManifest
- [done] Rollback and recovery never rewrite lock.json
- [done] All recovery decisions are based solely on lockfile contents

### Logging
- [done] All logging remains structured and secret-free
- [done] Logs include enough info to diagnose recovery decisions
- [done] Recovery decision path is logged (resume/rollback/fail)

### Integration
- [done] Recovery is automatic on startup (no manual intervention required)
- [done] Installation planner detects staging artifacts
- [done] Deterministic installer handles staging, promote, recovery, quarantine, snapshots

### Non-Goals (Not Implemented)
- No UI controls or install progress UI (Layer 3)
- No pack switching or multiple pack support
- No "silent repair" outside the recovery contract (no magical fixes without evidence)
- No automatic rollback execution (snapshots created, but rollback execution is future enhancement)

Evidence / notes:
- [done] Implementation documented in `docs/SP2.3-rollback-recovery.md`
- [done] Staging directory utilities added to `electron/src/main/paths.ts`
- [done] Install planner updated in `electron/src/main/install/installPlanner.ts` to detect staging artifacts
- [done] Deterministic installer updated in `electron/src/main/install/deterministicInstaller.ts` with staging, atomic promote, recovery, quarantine, snapshots
- [done] Rollback executor implemented in `electron/src/main/install/rollbackExecutor.ts` with atomic rollback logic
- [done] Rollback CLI script created: `scripts/run-rollback.ts`
- [done] Rollback test script created: `scripts/validation/test-rollback.ps1`
- [done] Rollback verification documentation: `docs/SP2.3-rollback-verification.md`
- [done] Rollback evidence guide: `prompts/02-evidence/L2/sp2.3-rollback-execution/ROLLBACK-EVIDENCE-GUIDE.md`
- [done] Rollback evidence collection script: `scripts/validation/capture-rollback-evidence.ps1` (usage: `powershell -ExecutionPolicy Bypass -File scripts/validation/capture-rollback-evidence.ps1 -InstanceId <id> [-SnapshotId <id>] [-ShowVerbose]`)
- [done] Rollback evidence orchestrator script: `scripts/validation/run-sp2.3-rollback-evidence.ps1` (usage: `powershell -ExecutionPolicy Bypass -File scripts/validation/run-sp2.3-rollback-evidence.ps1 -InstanceId <id> [-ShowVerbose]` - handles prerequisites: verifies node/npm, builds electron code, ensures snapshot exists, then runs evidence collection. Evidence output: `prompts/02-evidence/L2/sp2.3-rollback-execution/<timestamp>/` with build logs, snapshot precheck, and all scenario evidence)
- [done] B2 validation evidence: `prompts/02-evidence/L2/sp2.3-b2/20260102-174043/` (proves staging-first writes, verify-in-staging, atomic promote, staging cleanup, resume from valid staging, recovery logging, manifest/lockfile immutability)
- [done] Snapshot validation evidence: `prompts/02-evidence/L2/sp2.3-final/20260102-180200/` (proves snapshot creation, snapshot manifest presence with names/paths/checksums)
- [done] Scenario A validation evidence: `prompts/02-evidence/L2/sp2.3-final/20260102-180200/scenario-a-*` (proves corrupted staging artifacts are detected, removed, and re-downloaded - corruption detected in 8 log entries, staging removed in 4 log entries, final jar restored to correct size 27.02 MB)
- [done] Scenario B validation evidence: `prompts/02-evidence/L2/sp2.3-final/20260102-180200/scenario-b-*` (proves corrupted final artifacts are quarantined instead of deleted - checksum mismatch detected in 4 log entries, file quarantined with timestamped name, quarantine action logged in 2 log entries, artifact re-downloaded and restored with correct checksum)
- [done] Scenario D validation evidence: `prompts/02-evidence/L2/sp2.3-final/20260102-180200/scenario-d-*` (proves failure-path UX - error detected in 8 log entries, error visible to user via dialog, error message is clear and actionable with next steps, app exits safely without mutating manifest or lockfile)
- [done] Lockfile-only authority: All recovery decision logs include structured metadata with `meta.authority = "lockfile"` and `meta.remoteMetadataUsed = false`. All checksum verification uses `artifact.checksum.value` from lockfile. All decision points (resume_from_staging, redownload, quarantine_then_redownload, promote, skip) log expected values from lockfile and observed values from local filesystem. Runtime evidence: `prompts/02-evidence/L2/sp2.3-final/20260102-205008/` (proves 2 recovery decision log entries, all with `authority: "lockfile"` and `remoteMetadataUsed: false`, all include expected values from lockfile and observed values from filesystem - decision type: `quarantine_then_redownload` when corrupted file detected). See `docs/SP2.3-rollback-recovery.md` "Lockfile-only Authority" section for log structure and verification instructions.
- [done] Lockfile-only authority validation evidence: `prompts/02-evidence/L2/sp2.3-final/20260102-205008/` (proves authority="lockfile" and remoteMetadataUsed=false in recovery decision logs)

**Current Status**: ✅ **SP2.3 is COMPLETE**.

SP2.3 closed on 2026-01-03.
All rollback scenarios validated with full evidence.
5 scenarios executed, 5 PASS, 0 FAIL.
Happy-path rollback restores corrupted client JAR by hash match.
Negative scenarios fail safely (expected), with no lockfile or manifest mutation.
Evidence stored at:
prompts/02-evidence/L2/sp2.3-rollback-execution/20260103-182731

Evidence command used:
scripts/validation/run-sp2.3-rollback-evidence.ps1 -InstanceId default -Verbose

Evidence folder:
prompts/02-evidence/L2/sp2.3-rollback-execution/20260103-182731

Summary file:
summary.md

---

## Stop Point 2.4 — UX Hygiene & Presentation Pass

Definition:
The MineAnvil UI is desktop-first, parent-safe, and state-driven.
Technical controls and diagnostics are available but clearly optional.
No UX element pressures parents to understand or manage technical details.

### Desktop-First Layout
- [done] Desktop-first layout scaffold (nav + content + details panel)

### State-First UX
- [done] State-first UX (status before actions)

### Parent-Safe Copy and Tone
- [done] Parent-safe copy and tone applied consistently

### Advanced Controls
- [done] Advanced controls clearly labelled and de-emphasised

### Diagnostics
- [done] Diagnostics framed as optional and support-oriented

### Scope Boundaries
- [done] No behaviour, IPC, or state changes introduced

Evidence / notes:
- [done] UX screenshots reviewed and approved
- [done] No functional changes made
- [done] UX validated against parent/guardian mental model

**Current Status**: ✅ **SP2.4 is COMPLETE**.

SP2.4 closed on 2026-01-03.
UX hygiene and presentation pass completed with no behaviour, IPC, or backend changes.

---

## Layer 2 Completion Criteria

Layer 2 is complete ONLY when:
- [done] Stop Point 2.1 is fully complete
- [done] Stop Point 2.2 is fully complete
- [done] Stop Point 2.3 is fully complete
- [done] Stop Point 2.4 is fully complete

**Current Status**: ✅ **Layer 2 is COMPLETE up to SP2.4**.

---

# Layer 3 — Parent UX

Purpose:
Provide parents with confidence, visibility, and reassurance
without exposing technical controls or mutating the Minecraft environment.

---

## Stop Point 3.1 — Environment Visibility

Definition:
Parents can see the high-level state of the Minecraft environment
(version status, health, control) in plain language.
No mutation or configuration is possible.

### Validation Checklist
- [done] Parent can answer "Is everything OK?" without scrolling
- [done] No controls allow changing anything
- [done] No technical terminology is visible
- [done] No existing behaviour changed
- [done] SP3.1 definition is satisfied and nothing else is advanced

Evidence / notes:
- [done] A read-only "Environment Status" surface is visible on the Home page
- [done] Copy is plain-language and parent-safe
- [done] State is high-level only (ready / managed / latest)
- [done] No controls or actions mutate state
- [done] No technical details are exposed
- [done] No backend, IPC, or behavioural changes were introduced

**Current Status**: ✅ **SP3.1 is COMPLETE**.

SP3.1 completed on 2026-01-03. Environment visibility implemented as a read-only parent-facing status surface on Home.

---

## Stop Point 3.2 — Safety Signals

Definition:
MineAnvil surfaces clear, non-technical signals indicating whether
everything is normal, needs attention, or is unsupported.

### Safety Signal Model
- [done] Safety signal model defined (normal / attention / unsupported)
- [done] Centralized implementation in `src/safety/safetySignal.ts`
- [done] Deterministic mapping from existing renderer state only
- [done] No new state introduced

### Signal States
- [done] Normal state implemented (signed in, owned, ready)
- [done] Attention state implemented (signed out, unverified temporary, or not ready)
- [done] Unsupported state implemented (not owned, app not approved)
- [done] Exactly one signal always shown

### User Experience
- [done] Plain-language, parent-safe copy
- [done] Temporary states do not imply failure
- [done] Unsupported states clearly distinguished
- [done] Read-only display (no actions, buttons, or escalation controls)
- [done] Subtle visual distinction only (no alarm UX)

### Technical Constraints
- [done] No new backend calls
- [done] No IPC changes
- [done] No behavioural or control-flow changes
- [done] No new state introduced

Evidence / notes:
- [done] Safety signals verified visually on Home page via Environment Status card
- [done] All three states validated (normal, attention, unsupported)
- [done] Signal mapping derived from existing state: signedIn, ownershipState, minecraftReady
- [done] No backend, IPC, or behavioural changes made
- [done] Implementation in `src/safety/safetySignal.ts`

**Current Status**: ✅ **SP3.2 is COMPLETE**.

SP3.2 completed on 2026-01-03. Safety signals implemented as centralized, read-only status indicators on Home page.

---

## Stop Point 3.3 — Explain Without Teaching

Definition:
Parents can optionally learn why something matters through calm,
plain-language explanations without being required to understand
technical details.

### Purpose
Provide optional, plain-language explanations that help parents understand
why a status matters, without requiring technical knowledge or action.

### Allowed Explanation Patterns
- Inline "Why this matters" or "What does this mean?" explanations
- Explanations attached to existing status or signal surfaces
- Read-only text only

### Key Principles
- Explanations are optional and collapsed by default
- No explanation introduces obligation or action
- No technical jargon
- Maximum two sentences per explanation
- Reassurance over mechanics

### Explicit Non-Goals (Not Implemented)
SP3.3 does NOT include:
- Instructions
- Troubleshooting steps
- Technical education
- Links to documentation
- Tooltips that imply required reading
- Actions or controls that mutate state
- New backend calls or IPC messages
- Behaviour or signal logic changes

### Acceptance Criteria
SP3.3 is complete ONLY when:
- Explanations are optional (collapsed by default)
- All explanations are parent-safe (plain language, no technical jargon)
- No behaviour or signal logic changes
- No new actions introduced
- Explanations attached to existing status or signal surfaces only
- Maximum two sentences per explanation
- Reassurance-focused tone throughout

---

## Stop Point 3.4 — Safe Escalation Paths

Definition:
When issues occur, MineAnvil explains what happened, what it means,
and what to do next, without blame or panic.

---

## Layer 3 Non-Goals (Explicit)

Layer 3 does NOT include:
- Mods or plugins
- World management
- Server control
- Scheduling or enforcement
- Content marketplaces
- Automatic environment mutation

---

## Layer 3 Completion Criteria

Layer 3 is complete ONLY when:
- [done] Stop Point 3.1 is fully complete
- [done] Stop Point 3.2 is fully complete
- [ ] Stop Point 3.3 is fully complete
- [ ] Stop Point 3.4 is fully complete

**Current Status**: 🔓 **Layer 3 is in progress**. SP3.1 and SP3.2 complete. SP3.3 and SP3.4 remain.

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
