# P12: Managed Java runtime download + verify + use (Windows runner, browser-safe renderer)

Read and obey `.prompts/00-rules.md`.

## Goal
Implement a managed Java runtime provider so MineAnvil can work on machines without Java installed.

- Download a JRE/JDK build suitable for Minecraft Java (Temurin or Microsoft Build of OpenJDK).
- Store under `app.getPath("userData")/runtimes/<vendor>/<version>/<platform>/`
- Verify integrity (checksum).
- Expose status over IPC and use it in `getLaunchPlan()`.

Renderer must remain browser-safe on macOS.

## Task

### 1) Runtime manifest + selection
Create `electron/src/main/runtime/managedRuntime.ts`:
- Define a minimal `RuntimeManifest` describing:
  - vendor (string)
  - version (string, e.g. "21" or full build)
  - platform (win-x64)
  - downloadUrl
  - sha256
  - archiveType (zip)
  - javaRelativePath (path to java.exe inside extracted tree)

Include a single default manifest constant (placeholder values permitted but structure must be correct).

### 2) Download + verify + extract
Implement:
- `ensureManagedRuntime(manifest): Promise<RuntimeDescriptor>`
  - Determine installDir under userData/runtimes/...
  - If already installed and java exists, return descriptor
  - Else:
    - download archive to a temp file under userData/downloads/
    - compute SHA-256 and compare
    - extract zip to installDir
    - verify java executable exists

Use Node built-ins where possible.
If you need an extraction helper, prefer a small dependency ONLY if already installed; otherwise implement minimal zip extraction using a well-known approach and add the dependency explicitly.

### 3) Wire into existing runtime resolver
Update `electron/src/main/runtime/runtime.ts`:
- Add a new function `resolveJavaRuntimePreferManaged(): Promise<RuntimeDescriptor>`
  - Try managed runtime first via `ensureManagedRuntime(defaultManifest)`
  - If managed runtime fails, fall back to PATH java as in P11
  - Always provide clear error strings

### 4) IPC
Update `electron/src/shared/ipc-types.ts`:
- Add:
  - `ensureRuntime(): Promise<{ ok: boolean; runtime?: RuntimeDescriptor; error?: string }>`
  - `getRuntimeStatus(): Promise<{ ok: boolean; installed: boolean; runtime?: RuntimeDescriptor; error?: string }>`
  (status can be derived from checking installed runtime path)

Update `electron/src/main/ipc.ts`:
- handlers:
  - `mineanvil:ensureRuntime`
  - `mineanvil:getRuntimeStatus`

Update preload accordingly.

### 5) Update getLaunchPlan()
Update the P11 launch plan builder to use `resolveJavaRuntimePreferManaged()`.

### 6) Renderer (browser safe)
Update `src/bridge/mineanvil.ts` stub:
- implement `ensureRuntime()` and `getRuntimeStatus()` returning ok:false with Windows-only messages.

Update `src/App.tsx` minimal UI:
- Add buttons:
  - "Check runtime status"
  - "Install runtime (Windows)"
- Display results in Diagnostics area
- Log events (no secrets)

### 7) Logging + verbose mode
- Verbose logs behind MINEANVIL_DEBUG=1
- Never log URLs with embedded secrets (shouldn't exist)
- For download failures: log status codes and filenames, not token-like data

## Constraints
- Do NOT launch Minecraft yet.
- Keep scope limited to runtime provisioning.
- No platform support beyond Windows x64 for now (document it).
- Do not run git commands.

## Output
- File diffs only.
- List changed files.
- Stop.
