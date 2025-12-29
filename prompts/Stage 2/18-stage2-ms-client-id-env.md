GOAL
Implement a clean configuration mechanism for the Microsoft OAuth public client id in the Electron main process, with:
- Dev-friendly env var support (works on macOS dev in Docker and on Windows VM).
- No secrets committed.
- No secrets printed to logs.
- Minimal diffs.

CONTEXT
Repo: mineanvil/mineanvil-desktop
Electron TS build is green.
OAuth currently uses placeholder client_id=YOUR_MICROSOFT_PUBLIC_CLIENT_ID and fails as expected.

REQUIREMENTS
1) Read Microsoft Client ID from environment variable MS_CLIENT_ID.
2) Support local .env file for dev ONLY (not committed). Use dotenv in Electron main process.
3) Never log MS_CLIENT_ID or tokens.
4) If MS_CLIENT_ID is missing OR equals the placeholder, fail fast with a clear error message shown to the user (dialog) and a safe console error that does not include the value.
5) Keep changes minimal and isolated.

IMPLEMENTATION STEPS
A) Add dependency: dotenv (runtime dependency).
B) Add a small config helper under Electron code, e.g. src/electron/config.ts:
   - function loadEnvOnce(): in dev only, load dotenv.config() from project root (process.cwd()) and ignore failures.
   - export function getMsClientId(): string
     - calls loadEnvOnce()
     - reads process.env.MS_CLIENT_ID
     - trims
     - validates not empty and not "YOUR_MICROSOFT_PUBLIC_CLIENT_ID"
     - throws Error("Microsoft Client ID not configured. Set MS_CLIENT_ID in .env (dev) or environment.")
C) Update the OAuth URL builder to call getMsClientId() and use it for client_id.
D) Error handling: when user clicks Sign In and getMsClientId() throws,
   - show a dialog (Electron dialog.showErrorBox or dialog.showMessageBox) with the plain-English message
   - do not open the browser
   - log only the error message (no env dump)
E) Add .env.example with:
   MS_CLIENT_ID=
   (comment: do not commit .env)
F) Ensure .env is gitignored (add if not already): .env, .env.local, .env.*.local
G) Keep README changes optional; skip unless trivial.

FILES TO TOUCH (keep it minimal)
- package.json (add dotenv)
- src/electron/config.ts (new)
- wherever the auth URL is constructed (use getMsClientId())
- .gitignore (ensure .env ignored)
- .env.example (new)

ACCEPTANCE TEST
1) Without MS_CLIENT_ID set: clicking Sign In shows a dialog telling how to set MS_CLIENT_ID; no browser opens.
2) With MS_CLIENT_ID set to placeholder: same as above.
3) With a real MS_CLIENT_ID set: browser opens with correct client_id in the URL.

COMMIT MESSAGE
"Stage2: load MS client id from env (no secrets)"
