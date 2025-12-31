# P14j: Fix exited variable typing in minecraft/launch.ts (TS2339 code on never)

Read and obey `.prompts/00-rules.md`.

## Problem
`electron/src/main/minecraft/launch.ts` fails:
- TS2339: Property 'code' does not exist on type 'never' (lines ~227-228)

## Goal
Make TypeScript understand the process exit info type.

## Task
In `electron/src/main/minecraft/launch.ts`:
1) Locate the `exited` variable used near:
   - `if (exited && (exited.code ?? 0) !== 0) { ... }`
2) Replace the existing `exited` declaration with an explicit type:
   - `let exited: { code: number | null; signal: NodeJS.Signals | null } | null = null;`
3) Ensure the assignment is explicit inside the exit handler:
   - `child.on("exit", (code, signal) => { exited = { code, signal }; ... })`
4) Ensure any checks against `exited.code` compile.
5) Do not change runtime behavior (only typing/structure of the variable).

## Constraints
- Minimal diff.
- No refactors beyond the exited variable and its assignment.
- Do not run commands.
- Do not run git commands.

## Output
- File diff only.
- Stop.
