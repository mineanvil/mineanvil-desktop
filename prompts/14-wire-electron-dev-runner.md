# P14: Wire Electron dev runner (Vite + Electron) and add npm scripts

Read and obey `.prompts/00-rules.md`.

## Goal
Enable Windows to run the actual Electron app (main + preload + IPC) during development.
Currently only Vite scripts exist.

We need:
- Electron main entry
- Preload entry
- Dev script that starts Vite and Electron together
- Production build output structure (no signing, no installer yet)

## Task

### 1) Add dependencies
Add dev dependencies (choose stable, minimal set):
- electron
- concurrently
- wait-on

If TypeScript compilation is needed for electron code, add:
- ts-node (only if you plan to run TS directly), OR
- wire a build step to compile electron TS to JS before launching electron

Prefer a simple approach:
- Build electron TS to `dist-electron/` (or similar) using `tsc`
- Electron runs compiled JS

### 2) Add Electron entry files
Ensure these exist and are correct:
- `electron/src/main/main.ts` creates BrowserWindow loading:
  - DEV: `http://localhost:5173`
  - PROD: local file from built renderer
- Use preload:
  - `preload` points to the compiled preload script
- Enable contextIsolation true, nodeIntegration false (safe defaults)

If any of these already exist, adjust minimally.

### 3) Add TS configs for electron build
Add a `tsconfig.electron.json` (or similar) to compile:
- `electron/src/main/**`
- `electron/src/preload/**`
- `electron/src/shared/**`
- `electron/src/core/**`
Output to:
- `electron/dist/` or `dist-electron/`

Do NOT include renderer `src/` in this TS build.

### 4) Update package.json scripts
Add scripts (exact names):
- `dev` stays as Vite (do not break current)
- Add:
  - `dev:electron` => starts Vite + Electron together
  - `build:electron` => builds electron TS to JS
  - `start:electron` => runs compiled electron main
  - `build` can remain as is (renderer build)
  - optional: `build:all` => build renderer + electron

Use wait-on to ensure Vite is ready before launching Electron.

Example target behavior:
- `npm run dev:electron`
  - starts Vite on 5173
  - waits for http://localhost:5173
  - builds electron TS (watch mode acceptable)
  - starts Electron main

### 5) Make sure preload typing works
Ensure renderer has typing for `window.mineanvil` but does not import Electron.

### 6) Confirm windows run path
Document in a short note at the end of the diff:
- "On Windows run: npm run dev:electron"
- "Renderer only: npm run dev"

## Constraints
- Minimal diffs.
- No packaging yet (no electron-builder).
- Keep browser mode working.
- Do not run git commands.

## Output
- File diffs only.
- List changed files.
- Stop.
