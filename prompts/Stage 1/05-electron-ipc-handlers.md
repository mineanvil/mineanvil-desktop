# P05: Implement typed IPC handlers + preload MineAnvil API (Windows runner)

Read and obey `.prompts/00-rules.md`.

## Goal
Electron main process implements the IPC contract defined in:
- `electron/src/shared/ipc-types.ts`

Preload exposes:
- `window.mineanvil` implementing `MineAnvilApi`

## Task
1) Electron main IPC
- Update `electron/src/main/ipc.ts` to register IPC handlers:
  - channel: `mineanvil:ping`
    returns: `{ ok: true, ts: Date.now() }`
  - channel: `mineanvil:authGetStatus`
    returns placeholder: `{ signedIn: false }` for now

2) Preload
- Update `electron/src/preload/preload.ts` to expose `window.mineanvil`:
  - `ping()` calls `ipcRenderer.invoke("mineanvil:ping")`
  - `authGetStatus()` calls `ipcRenderer.invoke("mineanvil:authGetStatus")`

3) Main bootstrap
- Ensure `electron/src/main/main.ts` imports and calls the IPC registration function early.

4) Types
- Ensure TypeScript builds cleanly:
  - preload uses the `MineAnvilApi` type (imported from shared types)
  - renderer remains untouched in this prompt

## Constraints
- Do NOT implement real auth yet.
- Do NOT add external libraries.
- Do NOT modify renderer code.
- Keep changes minimal.
- Do not run git commands.

## Output
- File diffs only.
- List changed files.
- Stop.
