# P19: Stage2 – Implement fixed loopback redirect listener for Microsoft OAuth callback

Read and obey `.prompts/00-rules.md`.

## Goal
Complete the desktop OAuth “authorize -> redirect back to app” step using a fixed loopback redirect:
http://127.0.0.1:53682/callback

Add a minimal local HTTP listener in Electron main that:
- binds to 127.0.0.1:53682
- handles GET /callback
- extracts query params: code, state, error, error_description
- validates state matches what we sent
- returns the code to the sign-in flow
- shows a simple success/failure HTML page in the browser tab
- shuts down the listener after one callback
- fails cleanly if the port is in use (EADDRINUSE) with a user dialog, and does NOT open the browser
No secrets in logs.

## Constraints
- Minimal diffs
- No token exchange yet unless it already exists in the code path (stop at receiving + returning code)
- No logging of code/tokens. State can be logged as “present/absent” only.

## Implementation Steps
A) Centralize redirect constants in Electron main:
- Create constants:
  REDIRECT_HOST = "127.0.0.1"
  REDIRECT_PORT = 53682
  REDIRECT_PATH = "/callback"
  REDIRECT_URI = `http://${REDIRECT_HOST}:${REDIRECT_PORT}${REDIRECT_PATH}`

Use REDIRECT_URI in the authorize URL builder.

B) Implement a minimal loopback server in Electron main:
- Create new file: `electron/src/main/auth/loopback.ts` (or similar)
- Use Node’s built-in `http` module (no new deps).
- Export function `waitForOAuthCallback(expectedState: string): Promise<{ code: string }>` that:
  1) starts http server and listens on (REDIRECT_HOST, REDIRECT_PORT)
  2) on request:
     - only accept GET /callback
     - parse URL query (use URL class)
     - if error present: respond with a small HTML error page (do not include secrets), reject with Error(error + optional description)
     - if code missing: respond with HTML error page, reject
     - validate state matches expectedState; if mismatch, respond with HTML error page, reject
     - if ok: respond with small HTML success page (“You may close this tab”), resolve({code})
  3) always close server after handling first callback
  4) handle listen errors:
     - if EADDRINUSE: throw Error("Port 53682 is already in use. Close the other app and try again.")
     - otherwise throw Error("Unable to start local sign-in callback server.")

C) Update the sign-in flow:
- Wherever you currently generate a state/PKCE and openExternal(authorizeUrl):
  1) generate state
  2) start callback listener FIRST: const callbackPromise = waitForOAuthCallback(state)
  3) then openExternal(authorizeUrl including redirect_uri=REDIRECT_URI and state=state)
  4) await callbackPromise to get {code}
  5) return { ok: true, codeReceived: true } (or pass code onward if token exchange already exists but do not log it)

D) IPC and user-visible errors:
- In the IPC handler for “auth sign in”:
  - catch errors, show dialog.showErrorBox("MineAnvil Sign-in", err.message)
  - return { ok:false, error: err.message }
  - ensure browser is NOT opened if listener failed to start

E) Acceptance tests
1) Port in use:
   - app shows dialog about port 53682 in use
   - no browser opens
2) Successful login:
   - browser redirects to http://127.0.0.1:53682/callback?... and shows “You may close this tab”
   - app receives code (do not print it)
   - IPC returns ok:true (or codeReceived:true)

## Output
- Implement changes.
- Commit with message:
  "P19 Stage2 loopback redirect listener for OAuth callback"
- Stop.
