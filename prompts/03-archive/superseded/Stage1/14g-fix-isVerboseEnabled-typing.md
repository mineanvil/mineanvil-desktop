# P14g: Fix isVerboseEnabled typing to accept process.env

Read and obey `.prompts/00-rules.md`.

## Problem
Multiple files fail with:
TS2559: Type 'ProcessEnv' has no properties in common with type '{ MINEANVIL_DEBUG?: string }'
when calling `isVerboseEnabled(process.env)`.

## Goal
Make `isVerboseEnabled(process.env)` type-check everywhere without changing runtime behavior.

## Task
1) Locate `isVerboseEnabled` definition (likely in `electron/src/shared/logging.ts`).
2) Change its parameter type to accept `NodeJS.ProcessEnv` (preferred) or `Record<string, string | undefined>`.
   - Keep behavior identical: check env var `MINEANVIL_DEBUG === "1"` (or truthy equivalent already used).
3) Ensure all existing call sites compile without needing casts.
4) Do not change any other logic. No refactors.

## Constraints
- Minimal diff.
- Do not run commands.
- Do not run git commands.

## Output
- File diffs only.
- List changed files.
- Stop.
