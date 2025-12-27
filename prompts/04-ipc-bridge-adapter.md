# P04: IPC types + renderer bridge adapter (browser safe)

Read and obey `.prompts/00-rules.md`.

## Goal
Renderer must call a typed API that works in:
- browser mode (Docker/Vite dev on macOS)
- electron mode (Windows runner via preload)

## Task
1) In `electron/src/shared/ipc-types.ts`, define:
   - `MineAnvilApi` interface:
     - `ping(): Promise<{ ok: boolean; ts: number }>`
     - `authGetStatus(): Promise<{ signedIn: boolean; displayName?: string; uuid?: string }>`
   - any shared types needed

2) In renderer create `src/bridge/mineanvil.ts`:
   - exports `getMineAnvilApi(): MineAnvilApi`
   - if `window.mineanvil` exists, return it
   - else return a browser stub that:
     - implements the interface
     - returns sensible placeholder values
     - logs a single warning once using the renderer logger (or console if needed)

3) Update `src/App.tsx` to use the adapter instead of touching `window.mineanvil` directly.

## Constraints
- Renderer must remain runnable in browser.
- No Electron imports in renderer.
- Minimal diffs.
- Do not run git commands.

## Output
- File diffs only.
- List changed files.
- Stop.
