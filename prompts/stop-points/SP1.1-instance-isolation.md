Follow /.context/BOOT_PROMPT.md.

Read:
/docs/STOP_POINTS.md

We are working on:
Stop Point 1.1 — Clean Machine Launch
Section: Instance Isolation

WORK TICKET — Instance Isolation (Layer 1)

Objective:
Implement deterministic instance isolation in the Electron main process.
MineAnvil must create and use a unique, stable instance directory and must not
write outside controlled directories.

Acceptance Criteria:
- On startup, resolve a base data directory using Electron app paths (no hardcoded user paths)
- Create instance directory if missing:
  - <base>/instances/default/
  - <base>/instances/default/logs/
  - <base>/instances/default/minecraft/
- Instance identity is stable across runs (default instance is fine for now)
- Provide helper functions to get:
  - instanceRoot
  - logsDir
  - minecraftDir
- Ensure the app writes logs only under logsDir
- No writes occur outside controlled directories for MineAnvil-managed state

Non-Goals:
- No Minecraft launch yet
- No multi-instance UI
- No migrations or “profiles”
- No Java bundling changes
- No refactors outside scope

Files Expected to Change:
- electron/src/main/paths.ts (new)
- electron/src/main/main.ts
- docs/STOP_POINTS.md (tick only the instance isolation items when verified)

Rules:
- Plan mode first.
- List files before editing.
- Minimal diff.
- Do not run any macOS host commands (host node is broken). Verification will be via Docker (electron-build) and Windows.

Output format for your first response:
1) Stop point targeted
2) Checklist items addressed
3) Files to change
4) Implementation plan
5) Verification steps (Docker build + Windows run)
