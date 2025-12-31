# P11: Instance + runtime scaffolding with dry-run launch plan (browser safe renderer)

Read and obey `.prompts/00-rules.md`.

## Goal
Introduce instance management and Java runtime resolution scaffolding in core + Electron main,
and expose a "dry-run launch plan" over IPC.

No actual Minecraft launch yet.

Must work with:
- browser mode on macOS (stubbed API)
- Electron mode later on Windows (real filesystem paths)

## Task

### 1) Define core types (no Electron imports)
In `electron/src/core/` create or extend modules to define:

- `InstanceDescriptor`:
  - id (string)
  - name (string)
  - path (string)
  - minecraftVersion (string, optional)
  - loader (string, optional)

- `RuntimeDescriptor`:
  - kind: "system" | "managed"
  - javaPath: string
  - javaVersion: string (optional)

- `LaunchPlan`:
  - instanceId
  - instancePath
  - javaPath
  - args: string[]
  - env: Record<string,string>
  - notes: string[] (for diagnostics)

No implementation logic in core beyond types and interfaces.

### 2) Electron main implementation (Windows-focused but no hard dependency)
Create `electron/src/main/instances/instances.ts` implementing:
- `ensureDefaultInstance(): Promise<InstanceDescriptor>`
  - instance directory under: `app.getPath("userData")/instances/default`
  - create if missing
  - create subfolders: `.minecraft`, `logs`, `downloads` (or similar)
  - write a small `instance.json` metadata file with id/name

Create `electron/src/main/runtime/runtime.ts` implementing:
- `resolveJavaRuntime(): Promise<RuntimeDescriptor>`
  - For now: attempt to locate `java` on PATH:
    - on Windows: "java.exe"
    - else: "java"
  - Use a small helper to run `java -version` and capture output for diagnostics
  - If not found, return a clear error message (do not crash)

Create `electron/src/main/launch/dryrun.ts` implementing:
- `buildLaunchPlan(): Promise<LaunchPlan>`
  - calls `ensureDefaultInstance()`
  - calls `resolveJavaRuntime()`
  - builds placeholder args (no real Minecraft):
    - `["-version"]` is acceptable as a dry-run command
  - notes should include:
    - resolved instance path
    - resolved java path
    - java version string if available

### 3) IPC surface
Update `electron/src/shared/ipc-types.ts` MineAnvilApi to add:
- `getLaunchPlan(): Promise<{ ok: boolean; plan?: LaunchPlan; error?: string }>`

Update `electron/src/main/ipc.ts`:
- add handler `mineanvil:getLaunchPlan` calling `buildLaunchPlan()`
- return structured error on failure

Update `electron/src/preload/preload.ts`:
- expose `getLaunchPlan()` that invokes IPC

### 4) Renderer integration (browser safe)
Update `src/bridge/mineanvil.ts` stub:
- implement `getLaunchPlan()` returning `{ ok:false, error:"getLaunchPlan is only available in Electron on Windows" }`

Update `src/App.tsx` (minimal UI):
- When signed in OR signed out, add a button: "Show launch plan (dry-run)"
- Call `api.getLaunchPlan()`
- Render returned plan JSON in Diagnostics or in a simple modal/section
- Log success/failure (no secrets)

### 5) Logging/diagnostics
- Use verbose logs when `MINEANVIL_DEBUG=1`
- Never log tokens
- Ensure any spawned process output is truncated/sanitized

## Constraints
- Do NOT actually launch Minecraft.
- No downloads.
- No Mojang/Microsoft calls here.
- Keep changes minimal and modular.
- No new external libraries unless already present.
- Do not run git commands.

## Output
- File diffs only.
- List changed files.
- Stop.
