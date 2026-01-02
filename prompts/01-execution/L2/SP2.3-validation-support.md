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
8. /.context/BOOT_PROMPT.md (mandatory execution contract)

If any instruction conflicts with 00-guardrails.md, the guardrails win.

If a task does not advance a checklist item in STOP_POINTS.md,
it must be rejected.

---

## Task Type
Validation support ONLY.  
NO new features.  
NO refactors.  
NO speculative improvements.

---

## Stop Point Targeted
Stop Point 2.3 — Rollback & Recovery

---

## Objective
Assist the operator in validating Stop Point 2.3 by:
- Inspecting the existing implementation
- Verifying recovery decision logic paths
- Preparing validation helpers and analysis scripts
- Identifying exact evidence required to check off checklist items

You are NOT allowed to:
- Add new recovery behavior
- Change installer logic
- Modify PackManifest or lock.json
- Preemptively "improve" recovery
- Advance future stop points

---

## What You MUST Do

### 1. Static Validation
Inspect the following files and explain, without modifying them:
- electron/src/main/install/deterministicInstaller.ts
- electron/src/main/install/installPlanner.ts
- electron/src/main/paths.ts

For each SP2.3 checklist section, identify:
- Which code paths implement it
- What log lines should appear
- What filesystem evidence proves it worked

---

### 2. Validation Mapping
Produce a table mapping:

SP2.3 Checklist Item →  
Expected Log Signal →  
Expected Filesystem State →  
Operator Action Required

Example format:

| Checklist Item | Trigger | Log Evidence | Filesystem Evidence |

---

### 3. Helper Scripts (Allowed)
You MAY create **read-only helper scripts** under:
- scripts/validation/

These scripts may:
- List staging / quarantine / rollback directories
- Hash files
- Compare before/after states
- Parse logs for recovery decisions

These scripts must:
- Never modify files
- Never delete files
- Never write outside scripts/validation/

---

### 4. Failure Injection Guidance
For each of the following scenarios, explain exactly what the operator should do and what the system should do:

- Interrupted install mid-download
- Valid staging artifact resume
- Corrupt artifact quarantine
- Snapshot creation after success

Do NOT simulate these yourself.
Do NOT assume success.

---

### 5. Evidence Checklist
Produce a **SP2.3 validation checklist** that the operator can fill in.
This checklist must correspond 1:1 with STOP_POINTS.md.

---

## Output Format (MANDATORY)

1. Stop Point Targeted
2. Static Code Path Analysis (no changes)
3. Validation Mapping Table
4. Helper Scripts (if any)
5. Operator Action Steps
6. Evidence Checklist
7. Explicit Confirmation:
   - “No STOP_POINTS.md items were modified”
   - “No future-layer work performed”

If any requested action violates STOP_POINTS.md or guardrails,
you MUST explain why and refuse.

