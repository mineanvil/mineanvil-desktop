# P14d: Fix Electron TS build config (stop nodenext .js extension errors)

Read and obey `.prompts/00-rules.md`.

## Problem
`npm run build:electron` fails with many TS2835 errors requiring explicit `.js` extensions due to
`--moduleResolution node16` or `nodenext`.

## Goal
Make Electron TS compile without requiring `.js` extensions by using a CommonJS-oriented TS config
for the Electron build output.

## Task
Edit `tsconfig.electron.json` ONLY:
- Set `"module": "CommonJS"`
- Set `"moduleResolution": "node"`
- Keep `"target": "ES2022"` (or similar modern target)
- Ensure `"outDir"` remains the electron build output folder
- Ensure `"rootDir"` is correct
- Keep `"sourceMap": true`
- Keep `"esModuleInterop": true` if present
- Do not change any source files.
- Do not change package.json.
- Do not run any commands.

## Output
- File diff only for tsconfig.electron.json
- Stop.
