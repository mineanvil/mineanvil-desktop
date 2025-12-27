# Logging and Diagnostics Contract

Read and obey `.prompts/00-rules.md`.

## Task
Define a unified logging contract shared by:
- Renderer
- Electron main process
- Core services

## Requirements
- JSON line format
- Levels: debug, info, warn, error
- Structured fields: ts, level, area, message, meta
- Verbose mode via `MINEANVIL_DEBUG=1`
- No secrets

## Implementation Scope
- Define types and helpers only
- No file IO yet
- Renderer may store logs in memory/localStorage
- Electron side will later write to disk

## Output
- Shared types under `electron/src/shared/`
- Minimal helper functions
- No breaking changes to existing renderer UI
