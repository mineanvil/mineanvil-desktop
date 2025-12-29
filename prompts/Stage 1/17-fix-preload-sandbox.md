# P17: Fix preload bridge not appearing (disable sandbox)

Read and obey `.prompts/00-rules.md`.

## Problem
In Electron on Windows:
- `window.location.href` is `http://localhost:5173/`
- preload file exists and calls `contextBridge.exposeInMainWorld("mineanvil", api)`
- but in renderer DevTools `window.mineanvil` is `undefined`

Most likely cause is BrowserWindow `webPreferences.sandbox: true` preventing the bridge exposure in this setup.

## Goal
Make `window.mineanvil` available in Electron renderer while keeping security posture sane.

## Task
1) Edit `electron/src/main/main.ts` BrowserWindow creation:
   - Keep:
     - `contextIsolation: true`
     - `nodeIntegration: false`
   - Change:
     - `sandbox: true` -> `sandbox: false` (or remove the sandbox line)
2) Add a short comment noting:
   - we may re-enable sandbox later after hardening and verifying bridge works
3) Do not change preload code.
4) Do not change renderer code.

## Constraints
- Minimal diff.
- Do not run commands.
- Do not run git commands.

## Output
- File diff only.
- List changed files.
- Stop.
