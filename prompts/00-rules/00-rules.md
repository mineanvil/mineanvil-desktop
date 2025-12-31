# MineAnvil – Cursor Rules (MANDATORY)

You are modifying a MineAnvil desktop application.

## Development Environment
- macOS is Docker-only. Do NOT assume Node, npm, Electron, or OS APIs on macOS.
- Renderer must run in a normal browser via Vite.
- Electron runs only on Windows machines.

## Development Environment Rules
- We are developing on a mac usign Docker
- On macOS: never run npm on host. Use docker compose tool/electron-build

## Architectural Rules
1. Renderer code MUST run without Electron present.
2. Electron-specific code MUST live under `electron/src/**`.
3. Core business logic MUST live under `electron/src/core/**`.
4. Core modules MUST NOT import Electron APIs.
5. Renderer MUST communicate via typed IPC interfaces only.
6. UI layer must be disposable (replaceable).

## Logging & Diagnostics
- Every subsystem must support verbose logging.
- Verbose mode is enabled via `MINEANVIL_DEBUG=1`.
- Logs must never contain secrets or tokens.
- Diagnostics must be exportable as a bundle.

## Git Discipline (Mandatory)
- After completing any prompt, STOP.
- List files changed.
- Ask the human to confirm commit OR execute an explicit commit prompt.
- Never auto-commit unless explicitly instructed via a commit prompt.


## Constraints
- Do NOT introduce new frameworks without explicit instruction.
- Do NOT remove existing functionality.
- Prefer small, explicit file diffs.
- If something is ambiguous, choose the simplest option and document it in comments.

You MUST follow these rules exactly.
