# Electron Scaffolding (Windows Runner Only)

Read and obey `.prompts/00-rules.md`.

## Task
Add Electron scaffolding files without requiring them to run on macOS.

Create:
- `electron/src/main/main.ts`
- `electron/src/main/ipc.ts`
- `electron/src/preload/preload.ts`
- `electron/src/shared/ipc-types.ts`

## Requirements
- contextIsolation = true
- nodeIntegration = false
- sandbox = true
- No hard-coded paths
- IPC must be typed using `ipc-types.ts`
- Add a single test IPC call: `ping()`

## Important
- Do NOT modify Docker config.
- Do NOT require Electron to run during dev on macOS.
- Renderer must still work in browser without errors.

## Output
- File diffs only
- Clear comments where Windows-only behavior begins
