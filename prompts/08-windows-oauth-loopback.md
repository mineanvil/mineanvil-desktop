# P08: Microsoft OAuth sign-in (system browser + loopback) in Electron main (Windows runner)

Read and obey `.prompts/00-rules.md`.

## Goal
Implement Microsoft OAuth sign-in in Electron main process using:
- system browser (not embedded)
- loopback HTTP server on 127.0.0.1 with a random free port
- PKCE
- safe logging (no secrets)

This prompt is Windows-runner focused. Renderer must remain browser-safe on macOS.

## Task

### 1) Create OAuth module (Electron main only)
Create `electron/src/main/auth/oauth.ts` implementing:

- `startMicrosoftSignIn(): Promise<AuthResult>`
  - starts a local HTTP server on `127.0.0.1` on a random port
  - builds the authorize URL using PKCE
  - opens the URL in the system browser using Electron `shell.openExternal`
  - waits for the redirect to hit the loopback server
  - validates `state`
  - exchanges `code` for tokens at Microsoft token endpoint
  - returns an AuthResult that includes:
    - `accountHint` or `displayName` if available (optional at this stage)
    - token fields at least: `access_token`, `refresh_token`, `expires_in`, `token_type`
  - DO NOT log tokens. Only log token presence and expiry.

- PKCE helper functions:
  - generate verifier
  - generate code challenge (S256)
  - random state

### 2) IPC wiring
Update `electron/src/main/ipc.ts` to add:
- `mineanvil:authSignIn`
  - calls `startMicrosoftSignIn()`
  - returns `{ ok: true }` or `{ ok: false, error: "..." }`

Update `electron/src/shared/ipc-types.ts` MineAnvilApi interface to include:
- `authSignIn(): Promise<{ ok: boolean; error?: string }>`

Update `electron/src/preload/preload.ts` to expose `authSignIn()` calling `ipcRenderer.invoke("mineanvil:authSignIn")`.

### 3) Renderer integration (must remain browser-safe)
Update `src/bridge/mineanvil.ts` browser stub to implement:
- `authSignIn()` returning `{ ok: false, error: "authSignIn is only available in Electron on Windows" }`

Update `src/App.tsx`:
- Add a "Sign in" button that calls `api.authSignIn()`
- Show success or error result in UI and log it (no secrets)
- After successful sign-in, call `authGetStatus()` refresh (even if it still returns signedIn:false for now)

### 4) Logging and verbose mode
- Use the logging contract where available.
- Respect `MINEANVIL_DEBUG=1` to emit extra debug logs (never secrets).

### 5) Config placeholders
In `electron/src/main/auth/oauth.ts`, define placeholders for:
- `clientId` (string placeholder)
- scopes placeholder (basic set for Minecraft Java later)
- token endpoint and authorize endpoint constants

Do NOT hard-code secrets. No client secret.

## Constraints
- Do not store tokens on disk yet.
- Do not implement ownership verification yet.
- Keep changes minimal and localized.
- No external libraries unless already installed. Prefer Node built-ins.
- Do not break macOS Docker browser dev.
- Do not run git commands.

## Output
- File diffs only.
- List changed files.
- Stop.
