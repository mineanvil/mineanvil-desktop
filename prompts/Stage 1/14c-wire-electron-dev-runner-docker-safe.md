# P14c: Wire Electron dev runner (no local npm on macOS, Docker-safe)

Read and obey `.prompts/00-rules.md`.

## Hard rule
DO NOT run `npm`, `pnpm`, `yarn`, or any install/build command on the host macOS.
Only edit repository files.
If you need to validate builds, provide commands that I will run via Docker Compose using `tool` or `electron-build`.

## Goal
Add Electron dev runner wiring and scripts so Windows can run the full app via Electron, while macOS continues to use Docker for renderer dev.

## Task

### 1) package.json changes (edit only)
Add devDependencies (do not install):
- electron
- concurrently
- wait-on

Add scripts (keep existing scripts intact):
- `dev` remains Vite dev (do not break)
- `dev:electron` (Windows): runs Vite + Electron together
- `build:electron`: compiles Electron TS to JS output folder
- `start:electron`: runs compiled Electron main
- `build:all`: builds renderer + electron

Make `dev:electron` wait for Vite:
- use `wait-on http://localhost:5173`
- use `concurrently` to run Vite and Electron

### 2) Electron TS build setup
Add `tsconfig.electron.json` to compile:
- electron/src/main/**
- electron/src/preload/**
- electron/src/shared/**
- electron/src/core/**
Output to something like:
- electron/dist/**

Ensure module target works for Electron (CommonJS is fine).
Ensure source maps are enabled for debugging.

### 3) Electron entry points
Ensure these exist and are correct (edit only):
- `electron/src/main/main.ts` creates BrowserWindow and loads:
  - DEV: `http://localhost:5173`
  - PROD: built renderer file
- Preload is correctly referenced (compiled preload path).
- contextIsolation: true, nodeIntegration: false.

If there is already a main/preload entry, update minimally.

### 4) Update shared types if needed
Make sure preload exposes `window.mineanvil` and renderer typings are correct, but do not change renderer behavior.

### 5) Docker compose stays as-is
Do NOT change docker-compose.yml unless necessary.
If you change it, keep existing services: dev, tool, electron-build.

### 6) Documentation
Add a minimal `BUILDING.md` with:
- macOS renderer dev:
  - `docker compose up --build dev`
- macOS electron build (TS compile only):
  - `docker compose run --rm electron-build`
- Windows full app dev:
  - `npm ci`
  - `npm run dev:electron`

## Output
- Provide file diffs only.
- List changed files.
- Provide the exact Docker commands I should run to validate TypeScript builds:
  - `docker compose run --rm electron-build`
  - and (optionally) `docker compose run --rm tool "npm run build"`
- Stop.

## Constraints
- Do NOT run git commands.
- Do NOT run npm locally.
- Minimal diffs.
