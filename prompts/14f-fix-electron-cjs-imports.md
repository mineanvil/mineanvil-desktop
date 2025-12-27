# P14f: Make Electron TS sources CommonJS-compatible (fix import.meta + node: default imports)

Read and obey `.prompts/00-rules.md`.

## Goal
Make `tsc -p tsconfig.electron.json` pass under CommonJS build by applying minimal source edits:
- Replace default imports from Node built-ins with namespace imports
- Remove/replace import.meta.url usage (use __dirname style)
- Fix the one boolean/void logic error flagged in oauth.ts
Do NOT refactor architecture.

## Task (edit only Electron code, not renderer)
1) Fix Node built-in imports (no default export):
   - Change patterns like:
     - `import crypto from "node:crypto"` -> `import * as crypto from "node:crypto"`
     - `import http from "node:http"` -> `import * as http from "node:http"`
     - `import https from "node:https"` -> `import * as https from "node:https"`
     - same for fs/path/os/stream/zlib/etc if present

2) Fix any `import.meta.url` usage in Electron main/preload code:
   - Replace with CommonJS equivalents:
     - use `__dirname` + `path.join(...)`
   - Ensure paths still resolve for:
     - preload script
     - loading built renderer file in PROD

3) Fix oauth.ts void/boolean issue:
   - Find `const opened = shell.openExternal(...)` (or similar)
   - `shell.openExternal` returns Promise<void> in Electron, so do not test for truthiness.
   - Instead:
     - `await shell.openExternal(url);` and treat failures via try/catch
     - Log errors safely

4) Keep changes minimal and local.
5) Do not change tsconfig or package.json in this prompt.
6) Do not run commands.

## Output
- File diffs only.
- List changed files.
- Stop.
