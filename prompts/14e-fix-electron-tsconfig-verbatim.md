# P14e: Fix Electron TS config (verbatimModuleSyntax + Node types)

Read and obey `.prompts/00-rules.md`.

## Problem
Electron TS build fails with:
- TS1295 (ESM imports in CJS under verbatimModuleSyntax)
- TS1192 (node:crypto/http/https no default export)

We will fix ONLY the config side in this prompt.

## Task
Edit `tsconfig.electron.json` ONLY:
1) Ensure it compiles Electron code as CommonJS and avoids TS1295:
   - Keep `"module": "CommonJS"`
   - Keep `"moduleResolution": "node"`
   - Set `"verbatimModuleSyntax": false`
   - If present, set `"isolatedModules": false` (only if it is currently true and causing issues)

2) Ensure Node built-in typings are available:
   - Add `"types": ["node"]` if not already present

3) Do not change any TypeScript source files in this prompt.
4) Do not change package.json.
5) Do not run commands.

## Output
- File diff only for tsconfig.electron.json
- Stop.
