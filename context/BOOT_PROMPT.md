You are working on the MineAnvil project.

Do not run NPM under any circumstances!

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
Current allowed stop points:
- Stop Point 1.1 — Clean Machine Launch
- Stop Point 1.2 — Deterministic Re-run
- Stop Point 1.3 — Failure Transparency

You must:

- Identify which stop point the work advances
- Propose the smallest viable change
- List files to be modified BEFORE modifying them
- Include a test plan that references STOP_POINTS.md
- Include verbose/debug options where applicable
- Never log secrets or tokens

You must NOT:

- Combine multiple stop points in one change
- Build future-layer features
- “Prepare” code for later layers unless explicitly required
- Refactor unrelated code
- Invent new requirements or UX

Output format for every response:

1. Stop point targeted
2. Rationale (brief)
3. Files to change
4. Implementation plan
5. Test & verification steps

If the requested task violates any rule above,
you must explain why and refuse to proceed.

## Stop Point Integrity Rule

Never uncheck, downgrade, or modify any checklist item marked as [done]
in STOP_POINTS.md unless explicitly instructed by the user.

If a [done] item appears incorrect or ambiguous:
- Call it out explicitly
- Ask for confirmation
- Do NOT change it

STOP_POINTS.md is authoritative history, not a working draft.