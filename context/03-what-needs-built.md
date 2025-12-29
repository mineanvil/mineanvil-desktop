# MineAnvil — What Needs To Be Built (Authoritative)

This document defines system responsibilities, not build order.

It does NOT describe UX polish, future features, or monetisation.
It exists to answer one question only:

“What must exist for MineAnvil to function correctly?”

---

## 1. Identity & Ownership System

MineAnvil must integrate with Microsoft identity
without introducing an alternative authentication system.

### Responsibilities
- Perform Microsoft OAuth login
- Verify Minecraft ownership
- Handle token lifecycle securely
- Detect and surface ownership failures

### Constraints
- No credentials stored in plaintext
- No secrets written to logs
- Fail fast on invalid or missing configuration
- Errors must be user-safe and explicit

---

## 2. Configuration & Secrets Handling

MineAnvil must externalise all sensitive or environment-specific values.

### Responsibilities
- Read configuration from environment variables or controlled files
- Validate configuration at startup
- Block execution on invalid config

### Constraints
- No secrets committed to source control
- No secrets printed to logs
- Clear startup failure messaging

---

## 3. Java Runtime Management

MineAnvil must control the Java runtime explicitly.

### Responsibilities
- Download or select a known Java runtime
- Pin Java versions per instance
- Avoid system Java and PATH reliance

### Constraints
- No implicit runtime assumptions
- No silent upgrades
- Runtime selection must be deterministic

---

## 4. Instance & Filesystem Isolation

MineAnvil must isolate Minecraft state from the host system.

### Responsibilities
- Create a controlled directory structure
- Separate instances cleanly
- Manage all reads/writes explicitly

### Constraints
- No writes outside controlled directories
- Re-running setup must not corrupt state
- Instance identity must be stable

---

## 5. Minecraft Launch Orchestration

MineAnvil must launch Minecraft predictably.

### Responsibilities
- Assemble launch arguments
- Invoke Minecraft with controlled runtime
- Capture stdout/stderr
- Track process lifecycle

### Constraints
- Launch behaviour must be repeatable
- Failures must be detectable
- No hidden retries or fallback behaviour

---

## 6. Logging & Diagnostics

MineAnvil must provide logs sufficient for support and debugging.

### Responsibilities
- Structured log output
- Separate user-visible messages from technical logs
- Preserve logs across runs

### Constraints
- Logs must not expose secrets
- Logs must be readable by humans
- Log locations must be predictable

---

## 7. Error Handling & Failure Transparency

MineAnvil must treat failure as a first-class state.

### Responsibilities
- Categorise failures (auth, ownership, runtime, launch)
- Present clear, plain-language errors
- Allow retry only when meaningful

### Constraints
- No silent failures
- No ambiguous error states
- No “it just didn’t work” outcomes

---

## 8. Deterministic Behaviour Guarantees

MineAnvil must behave predictably across runs.

### Responsibilities
- Idempotent setup steps
- Stable directory layout
- Repeatable launch behaviour

### Constraints
- Same inputs produce same outputs
- Re-run must not degrade state

---

## 9. Clean Machine Compatibility

MineAnvil must function on a fresh Windows install.

### Responsibilities
- Zero manual prerequisites
- Self-contained setup
- Explicit dependency handling

### Constraints
- No reliance on user-installed tools
- No undocumented assumptions

---

## 10. Security & Trust Boundaries

MineAnvil must respect user trust.

### Responsibilities
- Minimal data handling
- Clear ownership boundaries
- Respect Microsoft licensing rules

### Constraints
- No telemetry
- No ads
- No data resale
- No grey-area behaviour

---

## 11. Explicit Non-Goals

The following are intentionally NOT built at this stage:

- Launcher replacement
- Mod loaders
- Skin marketplaces
- World browsers
- Social features
- Auto-updating content feeds
- Monetisation systems

These belong to later layers or may never exist.

---

## 12. Completion Definition

This document is satisfied when:
- All Layer 1 stop points are complete
- Behaviour is deterministic
- Failures are transparent
- Clean-machine testing passes repeatedly

Anything beyond this is expansion, not foundation.
