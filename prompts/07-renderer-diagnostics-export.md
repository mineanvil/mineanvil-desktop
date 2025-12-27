# P07: Renderer diagnostics export bundle (browser safe)

Read and obey `.prompts/00-rules.md`.

## Goal
Allow the renderer to export a diagnostics bundle that can be attached to support requests.

This must work in:
- browser mode (Docker/Vite on macOS)
- electron mode later (Windows runner)

## Task
1) Create `src/diagnostics/export.ts` that builds a diagnostics bundle object containing:
   - app:
     - name: "MineAnvil"
     - build: "dev"
     - timestamp (ISO string)
   - environment:
     - userAgent
     - platform
     - language
   - logs:
     - recent log events already captured by the renderer logger

2) Redaction
- If a shared redaction helper exists, use it
- Otherwise implement a local redactor that removes keys matching:
  token, access_token, refresh_token, authorization, password, secret
- Redaction must be conservative

3) UI
- Add a "Download diagnostics.json" button to the Diagnostics tab
- Clicking downloads a JSON file (not JSONL)
- Filename should include timestamp

## Constraints
- Browser only. No filesystem access.
- No new libraries.
- No Electron imports.
- Keep changes minimal.
- Do not run git commands.

## Output
- File diffs only.
- List changed files.
- Stop.
