# P21: Fix OAuth loopback to use fixed redirect URI (127.0.0.1:53682/callback)

Read and obey `.prompts/00-rules.md`.

## Goal
Make OAuth loopback redirect deterministic by forcing the app to ALWAYS use:
http://127.0.0.1:53682/callback

Right now logs show the loopback server is listening on a random port (e.g. 53857). Replace that with a fixed port and path, and ensure the authorize URL uses the same redirect_uri.

## Constraints
- Minimal diffs
- Do not log secrets (no code/tokens/verifier)
- Keep existing auth flow behavior the same otherwise
- If binding fails because port is in use, show a dialog and abort opening the browser

## Implementation Steps
A) Find the loopback server code (where it chooses a port or uses port 0 / random).
- Replace dynamic port selection with constants:
  REDIRECT_HOST = "127.0.0.1"
  REDIRECT_PORT = 53682
  REDIRECT_PATH = "/callback"
  REDIRECT_URI = `http://${REDIRECT_HOST}:${REDIRECT_PORT}${REDIRECT_PATH}`

B) Ensure the http server listens with:
server.listen(REDIRECT_PORT, REDIRECT_HOST)

C) Ensure the authorize URL builder uses redirect_uri=REDIRECT_URI exactly.
Do not mix localhost and 127.0.0.1. Use 127.0.0.1 everywhere.

D) Ensure logs reflect the fixed port:
- Change the "loopback server listening" meta.port to always show 53682.

E) Error handling:
- On listen error EADDRINUSE, throw Error("Port 53682 is already in use. Close the other app and try again.")
- Catch at IPC sign-in boundary: dialog.showErrorBox("MineAnvil Sign-in", err.message) and return { ok:false, error: err.message }
- Do not openExternal if the listener failed to bind.

## Acceptance Test
1) Start app and click sign-in:
- log shows loopback server listening port 53682
- browser opens
- sign-in completes and redirects to http://127.0.0.1:53682/callback

2) If you manually occupy 53682:
- dialog appears about port in use
- browser does not open

## Output
- Implement changes.
- Commit with message:
  "P21 Fix OAuth to use fixed loopback redirect URI"
- Stop.
