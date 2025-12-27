# P10: Minecraft Java ownership + profile (Windows runner, browser-safe renderer)

Read and obey `.prompts/00-rules.md`.

## Goal
Use stored Microsoft OAuth tokens (from P09) to:
1) Acquire Minecraft Services access token
2) Check Java ownership (entitlements)
3) Fetch Minecraft profile (uuid + name)

Renderer must remain browser-safe on macOS.

Reference: Many launchers implement this chain (XBL -> XSTS -> Minecraft -> store/profile). :contentReference[oaicite:1]{index=1}

## Task

### 1) Implement the auth chain in Electron main
Create `electron/src/main/minecraft/minecraftAuth.ts` with:

- `getMinecraftAccessToken(msAccessToken: string): Promise<{ mcAccessToken: string }>`
  Steps (high level):
  A) Authenticate with Xbox Live (XBL) using the Microsoft access token
  B) Authenticate with XSTS using the XBL token
  C) Login with Minecraft Services using userhash + XSTS token
  Return the Minecraft access token

Notes:
- Use fetch (Node 18+ / Electron) or existing request helper if you have one.
- Add verbose logging gated by MINEANVIL_DEBUG=1, but NEVER log tokens or auth headers.
- If the request fails, return a clear error string and log safe metadata (status code, endpoint, correlation id if any).

### 2) Implement Minecraft Services calls
Create `electron/src/main/minecraft/minecraftServices.ts` with:

- `getEntitlements(mcAccessToken: string): Promise<{ items: any[] }>`
  Call the Minecraft services entitlements endpoint (Java ownership is determined from items).

- `getProfile(mcAccessToken: string): Promise<{ id: string; name: string }>`
  Call the Minecraft services profile endpoint.

Also create helper:
- `checkJavaOwnership(entitlements): { owned: boolean; reason?: string }`
  Conservative rules:
  - owned = true if entitlements contains a Java edition entitlement/product item
  - owned = false if empty or does not contain required product
  - do not guess: if unknown structure, treat as not owned but include reason "unrecognized entitlements structure" in debug logs

### 3) Integrate into auth status
Update `electron/src/main/ipc.ts` implementation of `mineanvil:authGetStatus`:
- Load tokens via tokenStore
- If no tokens: signedIn=false
- If tokens exist and expired: attempt refresh (use existing refresh logic if present; if not present, implement `refreshMicrosoftAccessToken()` in `electron/src/main/auth/oauth.ts` using refresh_token and update tokenStore)
- With a valid Microsoft access token:
  - call `getMinecraftAccessToken()`
  - call `getEntitlements()` and compute `owned`
  - call `getProfile()` (only if owned=true; otherwise skip profile)
- Return:
  - `signedIn: true` if Microsoft tokens are present and valid
  - include:
    - `minecraftOwned: boolean`
    - `displayName?: string` (Minecraft profile name if available)
    - `uuid?: string` (Minecraft profile id if available)
    - `expiresAt?: number` (optional, for debugging)

Important: Never include tokens in IPC responses.

### 4) Update shared IPC types + preload
Update `electron/src/shared/ipc-types.ts`:
- Extend `authGetStatus()` return type to include:
  - `minecraftOwned?: boolean`

Update `electron/src/preload/preload.ts` to match updated type signatures (no renderer changes required beyond types).

### 5) Renderer remains browser-safe
Update the browser stub in `src/bridge/mineanvil.ts`:
- `authGetStatus()` returns `{ signedIn: false }` (or signedIn false always)
- It can include `minecraftOwned: false` optionally, but keep it simple.

Update `src/App.tsx` UI (minimal):
- When status loads:
  - show `signedIn`
  - if signedIn and minecraftOwned === true, show "Minecraft owned" + displayName/uuid if present
  - if signedIn and minecraftOwned === false, show "Minecraft not owned (or not detected yet)" and advise checking on Windows runner later

### 6) Logging
- Use your shared logging contract if available.
- Verbose mode: MINEANVIL_DEBUG=1
- Never log secrets or authorization headers.
- If an endpoint returns 401/403/429, log status code + endpoint name only.

## Constraints
- Do not implement launching yet.
- Do not implement instance management yet.
- Keep changes localized.
- No new libraries unless already installed.
- Do not run git commands.

## Output
- File diffs only.
- List changed files.
- Stop.
