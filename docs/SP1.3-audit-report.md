# Stop Point 1.3 — Failure Transparency: Audit Report

**Date**: 2025-01-XX  
**Scope**: READ-ONLY audit of current implementation  
**Goal**: Assess compliance with Stop Point 1.3 definition

---

## Implemented Failure Categories

The application implements four failure categories as defined in `electron/src/shared/ipc-types.ts`:

1. **AUTHENTICATION** — Microsoft OAuth sign-in failures
2. **OWNERSHIP** — Minecraft ownership verification failures
3. **RUNTIME** — Java runtime resolution, download, or installation failures
4. **LAUNCH** — Minecraft installation, launch command building, or process spawn failures

### Internal Error Identifiers

**AUTHENTICATION category** (`authFailureFromError` in `electron/src/main/ipc.ts`):
- Detected by error message patterns:
  - `"safestorage"` + `"encryption is not available"` → PERMANENT, canRetry: false
  - `"port 53682 is already in use"` → TEMPORARY, canRetry: true
  - `"access_denied"` → TEMPORARY, canRetry: true
  - `"failed to open system browser"` → TEMPORARY, canRetry: true
  - Default catch-all → TEMPORARY, canRetry: true
- Also includes Minecraft auth chain failures (XBL/XSTS/Minecraft login) → TEMPORARY, canRetry: true

**OWNERSHIP category** (`ownershipFailureFromError` in `electron/src/main/ipc.ts`):
- Uses `OwnershipState` enum values:
  - `"NOT_OWNED"` → PERMANENT, canRetry: false
  - `"UNVERIFIED_APP_NOT_APPROVED"` → PERMANENT, canRetry: false
  - `"UNVERIFIED_TEMPORARY"` → TEMPORARY, canRetry: true
- Classified from HTTP status codes:
  - 403 on `mc.*` endpoints → `UNVERIFIED_APP_NOT_APPROVED`
  - 429, 401, or >=500 → `UNVERIFIED_TEMPORARY`
  - Default → `UNVERIFIED_TEMPORARY`
- Also includes `OwnershipGateError` with explicit state

**RUNTIME category** (`runtimeFailureFromError` in `electron/src/main/ipc.ts`):
- Detected by error message patterns:
  - `"not configured"` or `"placeholder"` → PERMANENT, canRetry: false
  - `"only supported on windows"` → PERMANENT, canRetry: false
  - Default → TEMPORARY, canRetry: true

**LAUNCH category** (`launchFailureFromError` in `electron/src/main/ipc.ts`):
- Detected by error message patterns:
  - `"only supported on windows"` → PERMANENT, canRetry: false
  - `"version not found"` → PERMANENT, canRetry: false
  - Default → TEMPORARY, canRetry: true

**Startup errors** (in `electron/src/main/main.ts`, shown before IPC handlers):
- Instance storage errors → Dialog only, app exits
- Configuration errors → Dialog only, app exits
- Java runtime errors → Dialog only, app exits

---

## User-Facing Error Messages (Quoted Verbatim)

### AUTHENTICATION Category

**1. Secure storage unavailable** (PERMANENT, canRetry: false):
```
MineAnvil cannot save sign-in tokens because secure storage is not available on this system.

This is required for sign-in. Please check your OS security/keychain settings and try again.
```
**Location**: `electron/src/main/ipc.ts:276-280`  
**Shown via**: `dialog.showErrorBox("MineAnvil Sign-in", ...)` at line 620

**2. Port already in use** (TEMPORARY, canRetry: true):
```
Sign-in could not start because the local callback port is already in use.

Next steps:
- Close any other MineAnvil instances or other apps using port 53682
- Retry sign-in
```
**Location**: `electron/src/main/ipc.ts:291-297`  
**Shown via**: `dialog.showErrorBox("MineAnvil Sign-in", ...)` at line 620

**3. Sign-in cancelled** (TEMPORARY, canRetry: true):
```
Sign-in was cancelled.
```
**Location**: `electron/src/main/ipc.ts:307`  
**Shown via**: `dialog.showErrorBox("MineAnvil Sign-in", ...)` at line 620

**4. Browser open failed** (TEMPORARY, canRetry: true):
```
MineAnvil could not open your system browser to complete sign-in.

Next steps:
- Check that a default browser is configured
- Retry sign-in
```
**Location**: `electron/src/main/ipc.ts:317-323`  
**Shown via**: `dialog.showErrorBox("MineAnvil Sign-in", ...)` at line 620

**5. Generic sign-in failure** (TEMPORARY, canRetry: true):
```
Sign-in failed. Please retry.
```
**Location**: `electron/src/main/ipc.ts:332`  
**Shown via**: `dialog.showErrorBox("MineAnvil Sign-in", ...)` at line 620

**6. Configuration missing** (PERMANENT, canRetry: false):
```
Microsoft Client ID not configured. Set MS_CLIENT_ID in .env (dev) or environment.
```
**Location**: `electron/src/main/config.ts:50-52`, shown at `electron/src/main/ipc.ts:604`  
**Shown via**: `dialog.showErrorBox("MineAnvil Sign-in", ...)` at line 604

**7. Minecraft authentication failure** (TEMPORARY, canRetry: true):
```
Minecraft authentication failed while verifying ownership.

Next steps:
- Sign out and sign back in
- Check internet connectivity
- Retry the action
```
**Location**: `electron/src/main/ipc.ts:241-248`  
**Shown via**: Ownership failure path (not directly shown, but part of ownership failure flow)

### OWNERSHIP Category

**1. Signed out** (TEMPORARY, canRetry: true):
```
You are signed out.

MineAnvil blocks launching unless you are signed in and ownership can be verified.

Next steps:
- Click Sign in
- After signing in, retry the action
```
**Location**: `electron/src/main/ipc.ts:165-173`  
**Shown via**: `dialog.showErrorBox("MineAnvil — Launch blocked", ...)` at lines 693, 724, 753

**2. Not owned** (PERMANENT, canRetry: false):
```
This Microsoft account does not appear to own Minecraft: Java Edition.

MineAnvil blocks launching unless the signed-in account owns Minecraft: Java Edition.

Next steps:
- Sign in with the Microsoft account that owns Minecraft: Java Edition
- If you don't own it yet, purchase Minecraft: Java Edition and try again
```
**Location**: `electron/src/main/ipc.ts:176-185`  
**Shown via**: `dialog.showErrorBox("MineAnvil — Launch blocked", ...)` at lines 693, 724, 753

**3. App not approved** (PERMANENT, canRetry: false):
```
MineAnvil could not verify Minecraft ownership because this app is not approved/allow-listed for Minecraft services yet.

MineAnvil blocks launching unless ownership can be verified.

Next steps:
- Use the official Minecraft Launcher for now
- Retrying in MineAnvil will not help until the app is allow-listed
```
**Location**: `electron/src/main/ipc.ts:188-197`  
**Shown via**: `dialog.showErrorBox("MineAnvil — Launch blocked", ...)` at lines 693, 724, 753

**4. Temporary verification failure** (TEMPORARY, canRetry: true):
```
Minecraft ownership could not be verified for this signed-in account.

This may be a temporary network/service issue, or a sign-in session problem.

Next steps:
- Retry after a moment
- Check internet connectivity
- If it keeps failing, sign out and sign back in
```
**Location**: `electron/src/main/ipc.ts:201-210`  
**Shown via**: `dialog.showErrorBox("MineAnvil — Launch blocked", ...)` at lines 693, 724, 753

### RUNTIME Category

**1. Configuration/placeholder error** (PERMANENT, canRetry: false):
- Message: Raw error message from `safeErrorString(err).message`
- Format: `"ErrorName: error message status=XXX code=YYY"` (if status/code present)
- **Assessment**: Technical — includes error names, status codes, and codes
- **Location**: `electron/src/main/ipc.ts:347`

**2. Platform not supported** (PERMANENT, canRetry: false):
- Message: Raw error message (typically `"Runtime install is only supported on the Windows runner right now."` or similar)
- **Assessment**: Semi-technical — mentions "Windows runner"
- **Location**: `electron/src/main/ipc.ts:358`

**3. Generic runtime failure** (TEMPORARY, canRetry: true):
- Message: Raw error message from `safeErrorString(err).message`
- Format: `"ErrorName: error message status=XXX code=YYY"` (if status/code present)
- **Assessment**: Technical — includes error names, status codes, and codes
- **Location**: `electron/src/main/ipc.ts:368`

### LAUNCH Category

**1. Platform not supported** (PERMANENT, canRetry: false):
- Message: Raw error message (typically `"Vanilla launching is currently supported on Windows runner only"` or similar)
- **Assessment**: Semi-technical — mentions "Windows runner"
- **Location**: `electron/src/main/ipc.ts:382`

**2. Version not found** (PERMANENT, canRetry: false):
- Message: Raw error message from `safeErrorString(err).message`
- Format: `"ErrorName: error message status=XXX code=YYY"` (if status/code present)
- **Assessment**: Technical — includes error names, status codes, and codes
- **Location**: `electron/src/main/ipc.ts:392`

**3. Generic launch failure** (TEMPORARY, canRetry: true):
- Message: Raw error message from `safeErrorString(err).message`
- Format: `"ErrorName: error message status=XXX code=YYY"` (if status/code present)
- **Assessment**: Technical — includes error names, status codes, and codes
- **Location**: `electron/src/main/ipc.ts:402`

### Startup Errors (Pre-IPC)

**1. Instance storage error**:
```
MineAnvil could not create its instance directories.

[error message]
```
**Location**: `electron/src/main/main.ts:170-173`  
**Shown via**: `dialog.showErrorBox("MineAnvil — Instance Storage Error", ...)`

**2. Configuration error**:
```
[Message from validateRequiredConfig()]
```
Typically: `"Microsoft Client ID not configured. Set MS_CLIENT_ID in .env (dev) or environment."`  
**Location**: `electron/src/main/main.ts:197`  
**Shown via**: `dialog.showErrorBox("MineAnvil — Configuration Error", ...)`

**3. Java runtime error**:
```
[Message from resolveAndValidateJavaAtStartup()]
```
Examples:
- `"Java is required but not configured. Set MINEANVIL_JAVA_PATH to a Java 17+ executable. (For development only, you may set MINEANVIL_ALLOW_PATH_JAVA=1 to use a Java found on PATH.)"`
- `"Java 8 is installed, but MineAnvil requires Java 17 or newer."`
- `"Java is required but was not found. Set MINEANVIL_JAVA_PATH to a Java 17+ executable. (Development only: MINEANVIL_ALLOW_PATH_JAVA=1 allows PATH lookup.)"`
**Location**: `electron/src/main/main.ts:213`  
**Shown via**: `dialog.showErrorBox("MineAnvil — Java Runtime Error", ...)`

### UI Error Display (Renderer)

Errors are also displayed in the React UI (`src/App.tsx`) via:
- Text in `<p style={{ color: 'crimson' }}>` elements
- Uses `failureMessage()` helper which extracts `res.failure?.userMessage ?? res.error ?? fallback`
- Examples:
  - `statusError` (line 361): `"Status error: {statusError}"`
  - `signInMessage` (line 445): `"Sign-in: {signInMessage}"`
  - `signOutMessage` (line 446): `"Sign-out: {signOutMessage}"`
  - `installVanillaError` (line 294): Shows `failureMessage(res, 'Install failed.')`
  - `launchCmdError` (line 299): Shows `failureMessage(res, 'Failed to get launch command.')`
  - `launchVanillaError` (line 304): Shows `failureMessage(res, 'Launch failed.')`
  - `runtimeStatusError` (line 169): Shows `failureMessage(res, 'Failed to get runtime status.')`
  - `ensureRuntimeError` (line 174): Shows `failureMessage(res, 'Failed to ensure runtime.')`
  - `launchPlanError` (line 339): Shows `failureMessage(res, 'Failed to get launch plan.')`

---

## User-Facing Message Assessment

### Plain-Language (Parent-Readable)

✅ **AUTHENTICATION category**:
- Secure storage message: Plain-language
- Port conflict message: Plain-language with actionable steps
- Sign-in cancelled: Plain-language
- Browser open failed: Plain-language with actionable steps
- Generic sign-in failure: Plain-language
- Configuration missing: Semi-technical (mentions `.env`, environment variables)

✅ **OWNERSHIP category**:
- All four ownership messages are plain-language with clear explanations and actionable "Next steps" sections

### Semi-Technical

⚠️ **RUNTIME category**:
- Platform messages mention "Windows runner" (technical term)
- Configuration/placeholder errors pass through raw error messages (may include technical details)

⚠️ **LAUNCH category**:
- Platform messages mention "Windows runner" (technical term)
- Version not found and generic errors pass through raw error messages (may include technical details)

### Technical (Not Parent-Readable)

❌ **RUNTIME category** (generic failures):
- Messages include error class names (e.g., `"Error: ..."`, `"TypeError: ..."`)
- Messages include HTTP status codes (e.g., `"status=403"`)
- Messages include error codes (e.g., `"code=ENOENT"`)
- Example format: `"Error: Download failed status=500 code=ETIMEDOUT"`

❌ **LAUNCH category** (generic failures):
- Same technical format as runtime failures
- Example format: `"Error: Version not found status=404"`

❌ **Startup errors**:
- Java runtime errors are mostly plain-language but may include technical details in some cases
- Configuration errors mention `.env` and environment variables (semi-technical)

---

## Logging Behaviour Summary

### Log File Paths

**Main process log**:
- Path: `<userData>\instances\default\logs\mineanvil-main.log`
- Where `<userData>` = `app.getPath("userData")` = `%APPDATA%\MineAnvil` on Windows
- **Location**: `electron/src/main/main.ts:182`

**Renderer process log**:
- Path: `<userData>\instances\default\logs\mineanvil-renderer.log`
- **Location**: `electron/src/main/ipc.ts:38`

### Persistence Across Runs

✅ **Confirmed**: Both log files are opened in **append mode** (`flags: "a"`):
- Main log: `electron/src/main/main.ts:26` (`createWriteStream(logPath, { flags: "a" })`)
- Renderer log: `electron/src/main/ipc.ts:39` (`createWriteStream(logPath, { flags: "a" })`)

✅ **Log rotation**: Implemented at startup (`electron/src/main/main.ts:187-188`):
- Rotates if file exceeds ~5 MiB
- Keeps 3 rotated files (`.1`, `.2`, `.3`)
- **Location**: `electron/src/main/main.ts:86-121` (`rotateLogIfTooLarge`)

### Log Structure Format

✅ **JSON Lines format** (one JSON object per line):
- Structure defined in `electron/src/shared/logging.ts:27-33`:
  ```typescript
  {
    ts: string;        // ISO timestamp
    level: "debug" | "info" | "warn" | "error";
    area: string;       // Subsystem identifier (e.g., "auth", "ipc", "launch")
    message: string;    // Human-readable message
    meta?: Record<string, unknown>;  // Optional structured context
  }
  ```

✅ **Main process logging**:
- Uses `console.info`, `console.warn`, `console.error` which are tee'd to file
- Structured JSON written via `JSON.stringify()` calls
- **Location**: `electron/src/main/main.ts:25-84` (`installConsoleFileTee`)

✅ **Renderer logging**:
- Structured via `electron/src/shared/logging.ts` helpers
- Persisted via IPC: `electron/src/main/ipc.ts:53-67` (`appendRendererLogEntry`)
- **Location**: `src/logging/renderer.ts:17-33`

### Secrets in Logs

✅ **Redaction implemented**:
- `redactSecrets()` function in `electron/src/shared/logging.ts:63-90`
- Redacts keys matching: `authorization`, `cookie`, `set-cookie`, `token`, `access_token`, `refresh_token`, `password`, `pass`, `secret`, `api_key`, `client_secret` (case-insensitive)
- Applied to renderer logs: `electron/src/main/ipc.ts:60` (re-applies redaction before writing)
- Applied to diagnostics export: `src/diagnostics/export.ts:40`

✅ **Launch command redaction**:
- `redactLaunchArgs()` in `electron/src/main/ipc.ts:470-479`
- Redacts `--accessToken` argument values to `"[REDACTED]"`
- **Location**: `electron/src/main/ipc.ts:729` (used when returning launch command to renderer)

✅ **Token storage**:
- Tokens stored encrypted via Electron `safeStorage` (`electron/src/main/auth/tokenStore.ts:46-63`)
- Never logged in plaintext
- Logs only presence/metadata (e.g., `hasRefreshToken: true`, expiry times)

✅ **OAuth flows**:
- Logs only presence/metadata, not token values
- Examples from code:
  - `logger.info("opening system browser for oauth", { hasClientId: true, scopes: OAUTH.scopes })`
  - `logger.info("exchanging auth code for tokens", { hasCode: true })`
  - `logger.info("refreshing microsoft access token", { hasRefreshToken: Boolean(params.refreshToken) })`

✅ **HTTP requests**:
- Authorization headers not logged
- Only endpoint names and status codes logged (not full responses)

**Assessment**: No secrets are logged. Redaction is applied defensively, and code explicitly avoids logging token values.

---

## Retry Behaviour Summary

### Retry Offered (`canRetry: true`)

**AUTHENTICATION**:
- ✅ Port conflict → Retry meaningful (user can close conflicting app)
- ✅ Sign-in cancelled → Retry meaningful (user can try again)
- ✅ Browser open failed → Retry meaningful (user can configure browser)
- ✅ Generic sign-in failure → Retry meaningful (temporary network/auth issues)
- ✅ Minecraft auth chain failure → Retry meaningful (temporary service issues)

**OWNERSHIP**:
- ✅ Signed out → Retry meaningful (user can sign in)
- ✅ `UNVERIFIED_TEMPORARY` → Retry meaningful (temporary network/service issues)

**RUNTIME**:
- ✅ Generic runtime failures → Retry meaningful (download/network/filesystem may recover)
- ⚠️ **Potential issue**: Some runtime failures may be permanent but are classified as temporary

**LAUNCH**:
- ✅ Generic launch failures → Retry meaningful (download hiccups, extraction, Java spawn may recover)
- ⚠️ **Potential issue**: Some launch failures may be permanent but are classified as temporary

### Retry NOT Offered (`canRetry: false`)

**AUTHENTICATION**:
- ✅ Secure storage unavailable → Retry not meaningful (requires OS configuration change)
- ✅ Configuration missing → Retry not meaningful (requires environment variable setup)

**OWNERSHIP**:
- ✅ `NOT_OWNED` → Retry not meaningful (account doesn't own Minecraft)
- ✅ `UNVERIFIED_APP_NOT_APPROVED` → Retry not meaningful (requires Mojang allow-listing)

**RUNTIME**:
- ✅ Configuration/placeholder errors → Retry not meaningful (requires config change)
- ✅ Platform not supported → Retry not meaningful (requires different platform)

**LAUNCH**:
- ✅ Platform not supported → Retry not meaningful (requires different platform)
- ✅ Version not found → Retry not meaningful (version doesn't exist)

### Retry UI Implementation

**Dialog-based errors** (main process):
- Errors shown via `dialog.showErrorBox()` do not include retry buttons
- User must manually retry the action (e.g., click "Sign in" again)

**UI-based errors** (renderer):
- Errors displayed in React UI (`src/App.tsx`) do not include explicit retry buttons
- User must manually retry the action (e.g., click the same button again)
- The `canRetry` flag is available in `FailureInfo` but is **not used** in the UI to enable/disable retry buttons

**Assessment**: Retry is offered only when meaningful (via `canRetry` flag), but the UI does not leverage this flag to provide explicit retry actions or disable retry for permanent failures.

---

## Gaps Relative to Stop Point 1.3 Definition

### Stop Point 1.3 Definition (from `docs/STOP_POINTS.md:90-114`)

**Definition**: When something fails, the failure is visible, explainable, and actionable.

**Requirements**:
1. ✅ Failures are categorised correctly
2. ⚠️ Errors are written in plain language — **PARTIAL**
3. ⚠️ Parent can understand what went wrong — **PARTIAL**
4. ✅ Retry is offered only when meaningful (flag exists, but UI doesn't use it)

### Identified Gaps

**1. Technical error messages in RUNTIME and LAUNCH categories**

**Gap**: Generic runtime and launch failures pass through raw error messages that include:
- Error class names (e.g., `"Error: ..."`, `"TypeError: ..."`)
- HTTP status codes (e.g., `"status=500"`)
- Error codes (e.g., `"code=ENOENT"`)

**Examples**:
- `"Error: Download failed status=500 code=ETIMEDOUT"`
- `"TypeError: Cannot read property 'version' of undefined status=404"`

**Impact**: Not parent-readable. Parents cannot understand what went wrong without technical knowledge.

**Location**: `electron/src/main/ipc.ts:337-405` (`runtimeFailureFromError`, `launchFailureFromError`)

**2. Semi-technical platform messages**

**Gap**: Platform not supported messages mention "Windows runner" which is a technical term.

**Examples**:
- `"Runtime install is only supported on the Windows runner right now."`
- `"Vanilla launching is currently supported on Windows runner only"`

**Impact**: Semi-technical. Parents may not understand what "Windows runner" means.

**Location**: `electron/src/main/ipc.ts:129`, `electron/src/main/minecraft/launch.ts:44`

**3. Retry flag not used in UI**

**Gap**: The `canRetry` flag exists in `FailureInfo` but is not used in the React UI to:
- Show/hide retry buttons
- Disable retry for permanent failures
- Provide explicit retry actions

**Impact**: Users can attempt to retry permanent failures, which may be confusing.

**Location**: `src/App.tsx` (no usage of `res.failure?.canRetry`)

**4. Configuration error messages are semi-technical**

**Gap**: Configuration errors mention `.env` files and environment variables, which are technical concepts.

**Example**: `"Microsoft Client ID not configured. Set MS_CLIENT_ID in .env (dev) or environment."`

**Impact**: Not parent-readable. Parents cannot understand how to fix this.

**Location**: `electron/src/main/config.ts:50-52`

**5. Startup errors may be technical**

**Gap**: Java runtime validation errors are mostly plain-language but may include technical details in some failure paths.

**Impact**: Varies by error path. Some are parent-readable, others are not.

**Location**: `electron/src/main/java.ts:124-205`

### Summary of Gaps

| Requirement | Status | Gap |
|------------|--------|-----|
| Failures categorised correctly | ✅ Complete | None |
| Errors in plain language | ⚠️ Partial | RUNTIME/LAUNCH generic failures are technical |
| Parent can understand | ⚠️ Partial | Technical error messages prevent understanding |
| Retry only when meaningful | ⚠️ Partial | Flag exists but UI doesn't use it |

---

## Conclusion

**Stop Point 1.3 Status**: **PARTIALLY COMPLETE**

**Strengths**:
- ✅ Failure categories are correctly implemented and used
- ✅ AUTHENTICATION and OWNERSHIP messages are plain-language and parent-readable
- ✅ Logging is structured, persistent, and secret-free
- ✅ Retry flag (`canRetry`) correctly identifies when retry is meaningful

**Gaps**:
- ❌ RUNTIME and LAUNCH generic failures show technical error messages
- ❌ Retry flag is not used in the UI to guide user behavior
- ⚠️ Some platform/configuration messages are semi-technical

**Recommendation**: Address technical error messages in RUNTIME and LAUNCH categories, and leverage the `canRetry` flag in the UI to provide explicit retry actions or disable retry for permanent failures.





