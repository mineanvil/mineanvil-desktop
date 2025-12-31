# P09: Token storage (Windows DPAPI/CredMan) + authGetStatus real state

Read and obey `.prompts/00-rules.md`.

## Goal
After P08 sign-in, store tokens securely on Windows and make `authGetStatus()` return real sign-in state.

- macOS browser mode must still run.
- No Minecraft ownership checks yet.
- No launch logic yet.

## Task

### 1) Add token store (Electron main, Windows-focused)
Create `electron/src/main/auth/tokenStore.ts` implementing:
- `saveTokens(tokens: StoredTokens): Promise<void>`
- `loadTokens(): Promise<StoredTokens | null>`
- `clearTokens(): Promise<void>`

Where `StoredTokens` includes:
- `access_token`
- `refresh_token`
- `expires_at` (epoch ms)
- `token_type`
- `scope` (optional)
- `obtained_at` (epoch ms, optional)

Storage requirements:
- Use a secure OS-backed method on Windows:
  - Prefer Windows Credential Manager via an existing Node/Electron package if already present.
  - If not present, implement DPAPI using an established library ONLY IF already installed.
  - If neither exists yet, implement an interim encrypted-at-rest store using Electron `safeStorage`
    (still acceptable for Stage 1), storing the ciphertext in a JSON file under `app.getPath("userData")/secrets/`.
- Never write plaintext tokens to disk.
- File permissions: best effort (document in code comments).

### 2) Wire sign-in to save tokens
Update `electron/src/main/auth/oauth.ts` (from P08):
- After exchanging the code for tokens, call `saveTokens()`.
- Compute `expires_at = Date.now() + (expires_in * 1000) - 30000` (30s safety margin).
- Ensure logs only say "tokens saved" and "expires_at" (no token values).

### 3) Implement sign-out and auth status
Update `electron/src/shared/ipc-types.ts` MineAnvilApi:
- Add:
  - `authSignOut(): Promise<{ ok: boolean; error?: string }>`
  - `authGetStatus(): Promise<{ signedIn: boolean; displayName?: string; uuid?: string; expiresAt?: number }>`
    (add expiresAt for debugging; optional)

Update `electron/src/main/ipc.ts`:
- Implement:
  - `mineanvil:authSignOut` -> clears tokens
  - `mineanvil:authGetStatus` -> loads tokens and returns:
    - signedIn true if tokens exist and not expired
    - include expiresAt if available

Update `electron/src/preload/preload.ts`:
- Expose `authSignOut()` and updated `authGetStatus()`.

### 4) Renderer stub + UI wiring (browser safe)
Update `src/bridge/mineanvil.ts` stub:
- `authGetStatus()` returns `{ signedIn: false }`
- `authSignOut()` returns `{ ok:false, error:"authSignOut is only available in Electron on Windows" }`

Update `src/App.tsx`:
- When signed in, show:
  - "Sign out" button calling `api.authSignOut()`
- After sign-in/sign-out, refresh status via `authGetStatus()`
- Log status refresh events (no secrets).

### 5) Verbose logging
- Respect `MINEANVIL_DEBUG=1` for extra debug logs.
- Never log tokens or authorization headers.

## Constraints
- No Minecraft ownership verification yet.
- No file IO in renderer.
- No breaking changes to Docker dev on macOS.
- Prefer built-in Electron/Node features over new deps.
- Do not run git commands.

## Output
- File diffs only.
- List changed files.
- Stop.
