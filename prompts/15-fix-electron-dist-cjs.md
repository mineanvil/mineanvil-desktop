# P15: Force Electron compiled output to CommonJS (electron/dist/package.json)

Read and obey `.prompts/00-rules.md`.

## Problem
Electron runs `electron/dist/main/main.js` but root `package.json` has `"type": "module"`,
so Node treats `.js` in this package as ESM and crashes: "exports is not defined in ES module scope".

## Goal
Make compiled Electron output load as CommonJS without changing the root package type.

## Task
1) Add a new file:
   - `electron/dist/package.json`
   with contents:
   {
     "type": "commonjs"
   }

2) Ensure the electron build does not delete this file.
   - If the build output folder is cleaned, add a tiny post-build step or ensure the file is copied.
   - Prefer: create a source file `electron/src/dist-package.json` and copy it to `electron/dist/package.json`
     as part of `build:electron` script (minimal).
   - Do NOT change the root `"type"`.

3) Keep diffs minimal.

## Constraints
- Do not run commands.
- Do not run git commands.

## Output
- File diffs only.
- List changed files.
- Stop.
