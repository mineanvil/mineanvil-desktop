# MineAnvil Work Ticket

IMPORTANT:
This work MUST be performed using the canonical boot prompt:
- context/boot_prompt.md

All implementation MUST obey the full context hierarchy:
1. context/00-guardrails.md (absolute law)
2. docs/STOP_POINTS.md (scoreboard of progress)
3. context/02-execution-map.md (layer sequencing)
4. context/05-development-plan.md (how work proceeds)
5. context/03-what-needs-built.md (system responsibilities)
6. context/01-exec-summary.md (strategic intent)
7. context/04-project-summary.md (narrative context)

If any instruction conflicts with 00-guardrails.md, guardrails win.

---

## Objective
Implement Rollback & Recovery for deterministic installs so MineAnvil can safely recover from partial/corrupt installs of lockfile-declared artefacts without manual intervention.

---

## Layer
2

---

## Stop Point
Stop Point 2.3 — Rollback & Recovery

---

## Acceptance Criteria
- [ ] Installation writes occur in a staging area first, and only become “live” via atomic promote (no half-written live artefacts)
- [ ] If install is interrupted (simulated by killing the process mid-download), the next run either:
      (a) resumes safely from staging, OR
      (b) rolls back to last-known-good, OR
      (c) fails with a clear, user-visible message that includes next steps
- [ ] A last-known-good snapshot exists for MineAnvil-controlled artefacts sufficient to rollback a failed install attempt
- [ ] Rollback and recovery never mutate PackManifest and never rewrite lock.json
- [ ] All logging remains structured and secret-free, and includes enough info to diagnose recovery decisions
- [ ] Adds verbose/debug switches to any new CLI helper or script introduced (e.g. --verbose / -vvv)

---

## Non-Goals
- Do NOT add UI controls or install progress UI (Layer 3)
- Do NOT add pack switching or multiple pack support
- Do NOT implement “silent repair” outside the rollback/recovery contract (no magical fixes without evidence)

---

## Files Expected to Change
- electron/src/main/install/deterministicInstaller.ts
- electron/src/main/install/installPlanner.ts
- electron/src/main/pack/packLockfileLoader.ts (only if needed for recovery metadata, but lockfile must remain immutable)
- electron/src/main/main.ts
- docs/SP2.3-rollback-recovery.md
- docs/STOP_POINTS.md

(No surprises allowed.)

---

## Implementation Notes
- Use a staging directory under:
  %APPDATA%\MineAnvil\instances\<instanceId>\.staging\pack-install\
- Use atomic rename/move into final paths where possible.
- Keep a minimal rollback store under:
  %APPDATA%\MineAnvil\instances\<instanceId>\.rollback\<timestamp-or-id>\
- Define what “last-known-good” means (e.g., validated artefacts that match lockfile checksums).
- Never log secrets/tokens.
- If a file exists but checksum mismatches:
  - Move it to quarantine (do not delete silently), then reinstall into staging.

---

## Test Plan
On a clean Windows VM:
1) Baseline deterministic install (SP2.2 path) completes.
2) Simulate interrupted install:
   - Delete 1–3 artefacts from disk
   - Start MineAnvil, then kill the process mid-run
   - Re-launch MineAnvil
   - Verify recovery behavior matches acceptance criteria (resume/rollback/fail clearly)
3) Corruption test:
   - Replace a library JAR with junk bytes
   - Re-launch MineAnvil
   - Verify it quarantines, reinstalls via staging, then promotes atomically
4) Verify no writes outside controlled directories.
5) Confirm logs show recovery decision path.

Include verbose options where applicable.

---

## Stop Point Update
Update docs/STOP_POINTS.md to add Stop Point 2.3 and check off ONLY the items proven by the implemented behavior and test evidence.
