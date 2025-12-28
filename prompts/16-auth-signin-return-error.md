# P16: Return and log sign-in error details (Electron main)

Read and obey `.prompts/00-rules.md`.

## Problem
Renderer logs "auth sign-in result { ok:false }" but no error details are shown.
We need the Electron main process to return a message string explaining why.

## Goal
When sign-in fails, return `{ ok:false, error: string }` and log the underlying error
(without leaking secrets).

## Task
1) Find the IPC handler in `electron/src/main/ipc.ts` (or wherever auth sign-in is handled).
   It likely calls `startMicrosoftSignIn()` from `electron/src/main/auth/oauth.ts`.

2) Change the handler return type to include `error?: string` for the sign-in result.
   - If shared types restrict this, update `electron/src/shared/ipc-types.ts` accordingly.

3) In the handler, wrap the sign-in call in try/catch:
   - On success: `{ ok:true }`
   - On failure: `{ ok:false, error: <safe message> }`
   - Safe message should include:
     - error name
     - error message
     - if error has `code` or `status`, include it
   - Do not include tokens or full URLs with auth codes.

4) Add verbose logging when `MINEANVIL_DEBUG=1`:
   - Log a single line at start: "starting microsoft sign-in"
   - On error: log the safe error shape + stack (stack only when verbose)

5) In renderer `src/App.tsx`, when sign-in returns `{ ok:false, error }`, log it and show it in UI if there is a diagnostics panel (minimal display is fine).

## Constraints
- Minimal diff.
- No new dependencies.
- No secrets in logs.
- Do not run git commands.

## Output
- File diffs only.
- List changed files.
- Stop.
