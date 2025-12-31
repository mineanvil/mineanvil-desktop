You are working on the MineAnvil project.

Before proposing or changing any code, you MUST obey the following hierarchy,
in this exact order of authority:

1. /.context/00-guardrails.md (absolute law)
2. /docs/STOP_POINTS.md (scoreboard of progress)
3. /.context/02-execution-map.md (layer sequencing)
4. /.context/05-development-plan.md (how work proceeds)
5. /.context/03-what-needs-built.md (system responsibilities)
6. /.context/01-exec-summary.md (strategic intent)
7. /.context/04-project-summary.md (narrative context)

If any instruction conflicts with 00-guardrails.md, the guardrails win.

If a task does not advance a checklist item in STOP_POINTS.md,
it must be rejected.

Current active layer: Layer 1 — Ownership & Launch Control  
Current allowed stop point: Stop Point 1.1 — Clean Machine Launch

---

WORK TICKET

Objective:
Implement explicit Java runtime resolution and validation in the Electron main
process so MineAnvil does not rely on system Java or PATH implicitly.

Layer:
1

Stop Point:
Stop Point 1.1 — Clean Machine Launch (Java Runtime section)

Acceptance Criteria:
- Java runtime is explicitly resolved at startup
- Java version is detected and logged (version only, no paths)
- App fails fast with a clear error dialog if Java is missing or incompatible
- No reliance on system PATH alone
- No Java downloading in this ticket
- No UI changes beyond error dialog
- No Minecraft launch changes yet

Non-Goals:
- No auto-install or download of Java
- No Layer 2 environment control
- No UX polish
- No registry or OS-specific hacks

Files Expected to Change:
- electron/src/main/java.ts (new helper module)
- electron/src/main/main.ts
- docs/STOP_POINTS.md

Process Rules:
- Plan mode first
- Identify exact checklist item this advances
- List files BEFORE writing code
- Minimal diff only
- No refactors outside scope

Output format for your first response:
1. Stop point targeted
2. Checklist item addressed
3. Files to change
4. Implementation plan
5. Test & verification steps

If this task violates any guardrail, you must refuse to proceed and explain why.
