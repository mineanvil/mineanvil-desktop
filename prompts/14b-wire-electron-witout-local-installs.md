# P14b: Wire Electron dev runner WITHOUT running npm on macOS

Read and obey `.prompts/00-rules.md`.

## Context
Local `npm install` on macOS fails due to system library issues. On macOS we use Docker for all installs.
You MUST NOT run any `npm install`, `npm ci`, or other package manager commands.

## Goal
Implement the Electron dev-runner wiring by editing repository files only:
- add scripts to package.json
- add electron main/preload entry points and TS build config
- update docker compose to provide the dependencies in-container

## Task
1) Update `package.json` to add scripts:
- keep existing scripts intact
- add:
  - `dev:electron` (starts Vite + Electron in dev)
  - `build:electron`
  - `start:electron`
  - `build:all`

2) Add dependencies by editing `package.json` ONLY (no installs):
- devDependencies:
  - electron
  - concurrently
  - wait-on

3) Add electron build config:
- add `tsconfig.electron.json` compiling `electron/src/**` to `electron/dist/**`

4) Ensure Electron main loads:
- DEV: http://localhost:5173
- PROD: built renderer (placeholder is fine)

5) Update `docker-compose.yml` (and any Dockerfiles) so that:
- the dev container runs installs inside container
- `npm ci` happens inside container
- a new compose service or command exists to run `npm run dev:electron` in container if feasible
  (it’s OK if Electron cannot run in container on macOS; document that it’s Windows-only)

6) Add a short `BUILDING.md` note:
- macOS: use `docker compose up dev` for renderer
- Windows: run `npm ci` then `npm run dev:electron` for full app

## Constraints
- Do NOT run any npm commands.
- Do NOT add node_modules to repo.
- Keep diffs minimal.
- Do not run git commands.

## Output
- File diffs only.
- List changed files.
- Stop.
