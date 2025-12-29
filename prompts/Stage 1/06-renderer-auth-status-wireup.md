# P06: Renderer state driven by authGetStatus (browser safe)

Read and obey `.prompts/00-rules.md`.

## Goal
Renderer UI state must be driven by `authGetStatus()` via the bridge adapter.
This must work in:
- browser mode (Docker/Vite dev on macOS) using the stub API
- electron mode (Windows runner) using preload + IPC

## Task
1) Update `src/App.tsx`:
- On initial load, call:
  - `const api = getMineAnvilApi()`
  - `await api.authGetStatus()`
- Drive UI state from the result:
  - if `signedIn` is false: show the Signed Out UI
  - if `signedIn` is true: show Signed In / Ready UI using returned fields
- Add a "Refresh status" button that re-calls `authGetStatus()`.

2) Logging
- Log an info event when status is fetched and when refresh occurs.
- Use the existing renderer logging approach.

3) Keep existing simulated sign-in buttons
- Move any existing "simulate sign-in" / "simulate ownership ok" actions into a clearly labelled collapsible section:
  - Title: "Dev tools (browser mode)"
  - It must be visually separated from the normal flow.
- Dev tools should not run automatically.

## Constraints
- Must not break browser-only Vite dev.
- Must not import Electron modules in renderer.
- Keep changes minimal.
- Do not run git commands.

## Output
- File diffs only.
- List changed files.
- Stop.
