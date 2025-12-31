# P18b: Stage2 – Load MS OAuth client id from env (dotenv), fail fast if missing

Read and obey `.prompts/00-rules.md`.

## Goal
Implement a clean configuration mechanism for the Microsoft OAuth public client id in the Electron main process, with:
- Dev-friendly env var support (works on macOS dev in Docker and on Windows VM).
- No secrets committed.
- No secrets printed to logs.
- Minimal diffs.

## Context
Repo: mineanvil/mineanvil-desktop  
Electron TS build is green.  
OAuth currently uses placeholder `client_id=YOUR_MICROSOFT_PUBLIC_CLIENT_ID` and fails as expected.

Electron code layout:
- `electron/src/main/...`
- `electron/src/preload/...`
- `electron/src/shared/...`

## Requirements
1) Read Microsoft Client ID from environment variable `MS_CLIENT_ID`.
2) Support local `.env` file for dev ONLY (not committed). Use `dotenv` in Electron **main** process.
3) Never log `MS_CLIENT_ID` or tokens.
4) If `MS_CLIENT_ID` is missing OR equals the placeholder, fail fast with:
   - a clear user-facing dialog
   - a safe console error (no value leakage)
5) Keep changes minimal and isolated.

## Implementation Steps
A) Add dependency: `dotenv` (runtime dependency, not devDependency).

B) Add config helper under Electron main code:  
Create `electron/src/main/config.ts` with:
- a module-level guard so dotenv loads at most once.
- function `loadEnvOnce()`:
  - only run in dev: `process.env.NODE_ENV !== "production"`
  - call `dotenv.config({ path: path.resolve(process.cwd(), ".env") })`
  - ignore missing `.env` silently (no logs)
- export function `getMsClientId(): string`:
  - calls `loadEnvOnce()`
  - reads `process.env.MS_CLIENT_ID`
  - trims value
  - validates not empty and not `"YOUR_MICROSOFT_PUBLIC_CLIENT_ID"`
  - throws `Error("Microsoft Client ID not configured. Set MS_CLIENT_ID in .env (dev) or environment.")`

C) Update OAuth URL builder to use `getMsClientId()` for `client_id`.
Likely location: `electron/src/main/auth/oauth.ts` (or wherever the authorize URL is constructed).

D) Error handling:
- In the IPC handler that triggers sign-in (e.g. `electron/src/main/ipc.ts`):
  - catch errors from `getMsClientId()` early
  - show `dialog.showErrorBox("MineAnvil Sign-in", err.message)`
  - return `{ ok: false, error: err.message }`
  - DO NOT open the browser
  - log only the error message (no env dump, no client id)

E) Add `.env.example` at repo root:

F) Ensure `.gitignore` ignores:
- `.env`
- `.env.local`
- `.env.*.local`

G) Skip README changes unless trivial.

## Acceptance Test
1) No `MS_CLIENT_ID` set:
   - clicking Sign In shows dialog explaining how to set it
   - browser does not open
2) `MS_CLIENT_ID=YOUR_MICROSOFT_PUBLIC_CLIENT_ID`:
   - same behaviour as above
3) Valid `MS_CLIENT_ID` set:
   - browser opens
   - authorize URL contains correct `client_id`

## Output
- Implement changes.
- Update/add files as required.
- Commit with message:
  "P18b Stage2 load MS client id from env (no secrets)"
- Stop.
