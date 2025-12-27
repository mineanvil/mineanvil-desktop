# P14h: Fix tokens possibly null in electron/src/main/ipc.ts

Read and obey `.prompts/00-rules.md`.

## Problem
TypeScript errors TS18047 in `electron/src/main/ipc.ts` where `tokens` may be null but is dereferenced:
- tokens.expires_at
- tokens.access_token

## Goal
Make the control flow explicitly handle `tokens === null` before any dereference.
No behavior change except safer early-returns.

## Task
In `electron/src/main/ipc.ts`:
1) After `loadTokens()`, immediately handle `if (!tokens) return { signedIn: false } ...`
2) Ensure any branches that return include `expiresAt` only when tokens exist.
3) Ensure subsequent usage (`tokens.access_token`) is only reachable when tokens is non-null.
4) Keep existing auth logic the same.

## Constraints
- Minimal diff.
- Do not change types in ipc-types.ts.
- Do not run commands.
- Do not run git commands.

## Output
- File diff only.
- Stop.
