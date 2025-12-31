# P14k: Fix TS 'never' narrowing for exitInfo in minecraft/launch.ts

Read and obey `.prompts/00-rules.md`.

## Problem
TypeScript reports:
TS2339: Property 'code' does not exist on type 'never'
around the `exitInfo.code` check.

## Goal
Keep the same runtime behavior (detect early Java exit) but avoid TS narrowing issues by tracking exit code in simple variables.

## Task
In `electron/src/main/minecraft/launch.ts` inside `launchVanilla()`:

1) Replace:
- `let exited: { code: number | null; signal: NodeJS.Signals | null } | null = null;`
- `child.on("exit", (code, signal) => { exited = { code, signal }; ... })`
- `const exitInfo = exited; if (exitInfo !== null && (exitInfo.code ?? 0) !== 0) { ... }`

With this pattern:

- Declare:
  - `let exitCode: number | null = null;`
  - `let exitSignal: NodeJS.Signals | null = null;` (optional but fine)

- In the handler:
  - `child.on("exit", (code, signal) => { exitCode = code; exitSignal = signal; out.end(); });`

- After the 800ms delay:
  - `const code = exitCode;`
  - `if (code !== null && code !== 0) { return { ok:false, error: \`Java exited early (code ${code})\n...\` } }`

2) Do not change any other logic, spawning, logging, or timing.
3) Keep the error message format basically the same.

## Constraints
- Minimal diff.
- Only modify this one file.
- Do not run commands.
- Do not run git commands.

## Output
- File diff only.
- Stop.
