# Stop Point 1.3 — Parent-Readable Error Messages

## Overview

This document summarizes the error message mapping implemented for Stop Point 1.3 gap closure. All user-facing error messages in the RUNTIME and LAUNCH categories are now parent-readable (plain language), while technical details are preserved only in logs for debugging.

## Implementation

- **Location**: `electron/src/main/ipc.ts`
- **Helper Functions**: `runtimeUserMessage()` and `launchUserMessage()`
- **UI Integration**: `src/App.tsx` uses `canRetry` to disable retry buttons and show messages when retry won't help

## RUNTIME Category Error Messages

| Error Pattern | User Message | Can Retry | Notes |
|--------------|--------------|-----------|-------|
| "not configured" / "placeholder" | Java runtime is not configured yet. This is a MineAnvil setup issue. | No | Permanent configuration issue |
| "only supported on windows" / "windows runner" | Java runtime installation is only supported on Windows. | No | Platform limitation |
| "checksum mismatch" | Downloaded Java runtime file is corrupted. | Yes | Temporary download issue |
| "download failed" / "http" | Could not download Java runtime. This may be a network issue. | Yes | Network/download issue |
| "expand-archive" / "extract" | Could not extract Java runtime files. | Yes | Extraction issue |
| "java executable not found" / "install incomplete" | Java runtime installation is incomplete. | Yes | Installation incomplete |
| "too many redirects" | Could not download Java runtime due to a network issue. | Yes | Network issue |
| Generic | Java runtime installation failed. | Yes | Catch-all for other errors |

## LAUNCH Category Error Messages

| Error Pattern | User Message | Can Retry | Notes |
|--------------|--------------|-----------|-------|
| "only supported on windows" / "windows runner" | Minecraft launching is only supported on Windows. | No | Platform limitation |
| "version not found" | Minecraft version not found. | No | Invalid version specified |
| "failed to start java process" / "failed to start" | Could not start Minecraft. | Yes | Process spawn failure |
| "java exited early" / "exited early" | Minecraft stopped unexpectedly. | Yes | Early process exit |
| Generic | Minecraft launch failed. | Yes | Catch-all for other errors |

## Technical Details

- **Technical information** (error class names, status codes, error codes, stack traces) is **never** exposed in `userMessage`
- All technical details are preserved in the `debug` field of `FailureInfo` for logging and diagnostics
- The `safeErrorString()` function extracts technical details but they are only used in logs, not in user-facing messages

## UI Behavior

- When `canRetry` is `false`, the UI:
  - Shows an orange message: "Retrying will not help. This is a permanent issue."
  - Disables the retry-triggering button to prevent misleading retries
- When `canRetry` is `true`, the UI:
  - Shows the error message
  - Allows retry via the action button

## Platform Terminology

- All user-facing messages use "Windows" instead of "Windows runner"
- "Windows runner" was a technical term that has been replaced with plain language

## Related Files

- `electron/src/main/ipc.ts` - Error categorization and message mapping
- `src/App.tsx` - UI integration with `canRetry` flag
- `electron/src/shared/ipc-types.ts` - `FailureInfo` type definition




