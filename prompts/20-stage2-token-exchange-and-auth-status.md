# P20: Stage2 – Exchange auth code for tokens, set signed-in state, authGetStatus reflects it

Read and obey `.prompts/00-rules.md`.

## Goal
After loopback callback returns an auth code, exchange it for tokens using Microsoft v2 token endpoint (public client + PKCE), then:
- store tokens in memory (for now)
- update auth status so renderer stops showing “signing in”
- implement/adjust authGetStatus to return signedIn true when tokens present
No secrets in logs.

## Constraints
- Minimal diffs
- No token/code logging (never print code, access_token, refresh_token, id_token, or PKCE verifier)
- If token exchange fails, show dialog and return ok:false with a safe error string.
- Use verbose-safe logs only: HTTP status, error codes, and generic messages.

## Implementation Steps
A) Confirm we already have:
- redirect URI constant: http://127.0.0.1:53682/callback
- PKCE code_verifier used when constructing authorize URL
- scopes already present (include "openid profile offline_access" and Graph scope as needed)

B) Implement token exchange in Electron main:
- Create `electron/src/main/auth/token.ts` (or similar)
- Export `exchangeCodeForTokens(params)` which:
  - POSTs application/x-www-form-urlencoded to:
    https://login.microsoftonline.com/consumers/oauth2/v2.0/token
  - includes:
    client_id = getMsClientId()
    grant_type = authorization_code
    code = <auth code>
    redirect_uri = REDIRECT_URI (exact match)
    code_verifier = <pkce verifier>
    scope = same scopes used in authorize (or omit if you already do it correctly, but keep consistent)
  - Use global `fetch` if available (Node/Electron), otherwise use https module (avoid new deps unless required).
  - On non-200, parse JSON safely and return a sanitized error (error + error_description but do not include tokens).

C) In sign-in flow:
- Where you currently do:
  - generate state + pkce verifier/challenge
  - waitForOAuthCallback(state) returns { code }
- After receiving code, call exchangeCodeForTokens(...)
- If success:
  - store returned token response in an in-memory module singleton, e.g. `electron/src/main/auth/session.ts`
    - set `signedIn=true`
    - store access_token/refresh_token/id_token/expires_in etc in memory only for now
  - return { ok:true, signedIn:true } to renderer
- If failure:
  - show dialog.showErrorBox("MineAnvil Sign-in", sanitizedMessage)
  - return { ok:false, error: sanitizedMessage }

D) authGetStatus:
- Ensure the IPC handler for authGetStatus returns:
  { ok:true, signedIn:boolean }
  signedIn should be true if the in-memory session has a valid token payload (or at least access_token present).

E) Ensure UI stops spinning:
- If renderer expects a specific IPC result shape, keep compatibility.
- If renderer listens for an event, emit a safe “auth:statusChanged” event when sign-in completes (optional, only if needed).

## Acceptance Test
1) Successful sign-in:
- Browser shows sign-in complete page
- App stops showing “signing in”
- authGetStatus returns signedIn true

2) Token exchange failure (simulate by breaking redirect_uri temporarily):
- Dialog shows safe error
- App returns ok:false
- No secrets logged

## Output
- Implement changes.
- Commit with message:
  "P20 Stage2 exchange code for tokens and update auth status"
- Stop.
