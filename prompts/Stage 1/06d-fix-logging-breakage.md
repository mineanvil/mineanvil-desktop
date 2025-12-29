# P06d: Fix logging breakage in App.tsx (undefined logInfo / missing log)

Read and obey `.prompts/00-rules.md`.

## Context
In `src/App.tsx` there are dev-tool button handlers that previously called `logInfo(...)`.
That caused a runtime error: "logInfo is not defined".
After partial changes, the IDE now shows: "cannot find 'log'" near those handlers.

## Goal
Make all logging calls in `src/App.tsx` compile and run correctly in browser mode.
Reuse the existing renderer logger implementation already present in the codebase.
Do NOT invent a new logging system.

## Task
1) Audit `src/App.tsx` for any undefined or out-of-scope logging calls:
   - `logInfo(...)`
   - `log.push(...)` where `log` is not defined
   - any other logger references that are not in scope

2) Determine the correct existing logger mechanism by searching the repo:
   - If there is a renderer logger factory (e.g. `getRendererLogger(area)`), use it.
   - Else if there is an existing hook/logger object already used in App.tsx (e.g. `useLogger()` returning `push/info/...`), use that.
   - Else use the shared logging helper from `electron/src/shared/` ONLY if it is browser-safe and already used in renderer.
   - If none exist, implement the smallest possible browser-safe logger in `src/logging/` that matches the existing log event format already produced by the app, then use it.

3) Apply a consistent logging pattern in App.tsx:
   - Logger must be in-scope everywhere it is called.
   - For the two dev-tool actions, emit info logs with area "ui":
     - "dev tool: simulate signed in"
     - "dev tool: simulate signed out"

4) Ensure the app no longer throws ReferenceError when clicking dev-tool buttons.

## Constraints
- Minimal diff.
- Do NOT change app behaviour beyond fixing logging.
- Do NOT remove existing logs.
- Do NOT add Electron imports in renderer.
- Do NOT run git commands.

## Output
- File diffs only.
- List changed files.
- Stop.
