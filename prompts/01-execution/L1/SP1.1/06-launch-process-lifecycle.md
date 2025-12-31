Follow /.context/BOOT_PROMPT.md.

Read:
/docs/STOP_POINTS.md

We are working on:
Stop Point 1.1 — Clean Machine Launch
Section: Launch (process lifecycle + stdout/stderr capture)

WORK TICKET — Launch process lifecycle + stdout/stderr capture (Layer 1)

Objective:
Wire up a minimal Minecraft launch in Electron main that:
- spawns the game process
- tracks lifecycle (start/exit/error)
- captures stdout and stderr to files under the instance logs directory

This ticket is about launch plumbing only, not full game correctness.

Acceptance Criteria:
- Launch uses the existing instance isolation paths:
  - logs under <userData>/instances/default/logs
  - minecraft working directory under <userData>/instances/default/minecraft
- When launch is triggered, Electron main spawns a child process and:
  - writes stdout to <logsDir>/minecraft-stdout.log
  - writes stderr to <logsDir>/minecraft-stderr.log
  - logs a structured lifecycle message (started/exited/error) without secrets
- Process is tracked so we can tell if it is running and get exit code + signal
- On spawn failure, show a clear, user-safe error dialog and do not crash
- No tokens/secrets logged

Non-Goals:
- No full Minecraft argument building (auth/profile, assets, classpath) beyond a minimal stub
- No ownership verification changes
- No Java bundling/downloads
- No UI polish beyond minimal button/IPC if already present
- No refactors outside scope

Implementation Guidance:
- Use the resolved Java runtime mechanism already implemented:
  - prefer MINEANVIL_JAVA_PATH
  - PATH only if MINEANVIL_ALLOW_PATH_JAVA=1
- Use the instance dirs from paths.ts
- If full Minecraft launch is not yet possible, implement a safe “launch stub”:
  - spawn Java with `-version` OR a small placeholder command
  - still write stdout/stderr to the log files and track lifecycle
  - This is acceptable ONLY if clearly labelled as stub and still advances the lifecycle+logging checklist items

Files Expected to Change:
- electron/src/main/launch.ts (new) OR electron/src/main/minecraft/launch.ts (new)
- electron/src/main/main.ts
- electron/src/main/ipc.ts (only if needed to trigger launch)
- docs/STOP_POINTS.md (tick launch items only after Windows verification)

Rules:
- Plan mode first.
- List files before editing.
- Minimal diff.
- Do not run any macOS host commands. Verification will be via Docker build and Windows run.

Output format for your first response:
1) Stop point targeted
2) Checklist items addressed
3) Files to change
4) Implementation plan
5) Verification steps (Docker build + Windows run + confirm logs written)
