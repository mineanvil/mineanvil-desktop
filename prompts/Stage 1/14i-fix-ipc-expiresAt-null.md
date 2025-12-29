# P14i: Fix remaining tokens null dereference for expiresAt in ipc.ts

Read and obey `.prompts/00-rules.md`.

## Problem
`electron/src/main/ipc.ts` still has one TS18047 error on a return that includes:
`expiresAt: tokens.expires_at` where tokens can be null in that branch.

## Task
In `electron/src/main/ipc.ts`:
- Adjust that return so it does NOT reference `tokens` unless `tokens` is non-null.
- Prefer:
  - return `{ signedIn: false }` when tokens is null, OR
  - use `expiresAt: tokens?.expires_at` if the type allows it
- Keep behavior consistent with the surrounding logic.

## Constraints
- Minimal diff.
- Do not change shared types.
- Do not run commands.
- Do not run git commands.

## Output
- File diff only.
- Stop.
