# P13: Vanilla Minecraft download + launch (Windows runner, browser-safe renderer)

Read and obey `.prompts/00-rules.md`.

## Goal
Implement a minimal but correct Vanilla Minecraft Java launcher pipeline:
- Select a Minecraft version (default: 1.21.4 or latest stable placeholder)
- Download version manifest + version JSON
- Download client jar
- Download required libraries (including natives)
- Download assets index + assets
- Build correct classpath and launch args
- Launch via Java using the managed runtime (P12), falling back to PATH java

This runs in Electron main on Windows.
Renderer remains browser-safe and only calls IPC.

## Task

### 1) Folder layout (use existing instance from P11)
Use instance root from `ensureDefaultInstance()`:
- `<instancePath>/.minecraft/`
  - `versions/<versionId>/<versionId>.json`
  - `versions/<versionId>/<versionId>.jar`
  - `libraries/...`
  - `assets/indexes/<assetIndexId>.json`
  - `assets/objects/<hashPrefix>/<hash>`
  - `natives/<versionId>/` (extracted native DLLs)
  - `logs/`

Do not depend on external launcher installations.

### 2) Implement Mojang metadata fetchers
Create `electron/src/main/minecraft/metadata.ts`:

- `fetchVersionManifest(): Promise<VersionManifest>`
  - GET https://piston-meta.mojang.com/mc/game/version_manifest_v2.json (or official equivalent)
  - Parse JSON
  - Verbose logging in debug mode

- `resolveVersion(versionIdOrLatest: string): Promise<{ versionId: string; versionJsonUrl: string }>`
  - If "latest", resolve to manifest.latest.release
  - Else find matching versionId

- `fetchVersionJson(url: string): Promise<VersionJson>`
  - Download and parse version JSON

### 3) Implement downloader utilities (robust + diagnosable)
Create `electron/src/main/net/downloader.ts`:

- `downloadToFile(url, destPath, opts)`
  - Ensure parent dirs exist
  - If file exists and size matches expected (if known), skip
  - Download with fetch streaming
  - Basic retry (e.g. 3 attempts)
  - Log bytes downloaded when MINEANVIL_DEBUG=1

- `sha1File(path): Promise<string>` helper (Node crypto)
- For assets and libraries where SHA1 is provided, verify SHA1.
- Never log tokens or auth headers (not used here).

### 4) Download client jar + libraries + natives
Create `electron/src/main/minecraft/install.ts`:

- `ensureVanillaInstalled(instancePath: string, versionIdOrLatest: string): Promise<InstallResult>`
  Steps:
  1) Fetch manifest + resolve version + fetch version JSON
  2) Save version JSON to `versions/<id>/<id>.json`
  3) Download client jar:
     - versionJson.downloads.client.url
     - verify sha1 if present
     - save to `versions/<id>/<id>.jar`
  4) Download libraries:
     - For each library in versionJson.libraries:
       - Choose artifact by OS rules (windows)
       - Download artifact to `libraries/<path>`
       - Verify SHA1 if present
  5) Natives:
     - For libraries with `natives` for windows and `downloads.classifiers`:
       - Download native classifier jar
       - Extract its contents to `natives/<versionId>/`
       - Respect `extract.exclude` if present
       - Use a simple zip extraction method; if a dependency is required, add it explicitly and keep it minimal.
  6) Assets:
     - Download asset index JSON to `assets/indexes/<assetIndexId>.json`
     - For each object in index.objects:
       - Download from `https://resources.download.minecraft.net/<hashPrefix>/<hash>`
       - Save under `assets/objects/<hashPrefix>/<hash>`
       - Verify SHA1 using the object hash

Return `InstallResult` including:
- versionId
- instancePath
- counts (libraries/assets downloaded/skipped)
- nativesDir
- assetIndexId
- notes[] for diagnostics

### 5) Build launch arguments correctly (vanilla)
Create `electron/src/main/minecraft/launch.ts`:

- `buildVanillaLaunchCommand(params): Promise<{ javaPath: string; args: string[]; cwd: string; env: Record<string,string>; summary: LaunchSummary }>`
  Requirements:
  - Use runtime resolver from P12 (prefer managed runtime)
  - Compute classpath:
    - all library jars (artifact paths for windows)
    - plus `versions/<id>/<id>.jar`
  - Use mainClass from version JSON: `versionJson.mainClass`
  - Provide minimal required game args:
    - `--username` (placeholder: "Player" if not known)
    - `--version` versionId
    - `--gameDir` instance .minecraft path
    - `--assetsDir` assets path
    - `--assetIndex` assetIndexId
    - `--uuid` placeholder if not known
    - `--accessToken` placeholder "0" for now (we will use real token later)
    - `--userType` "msa" (placeholder)
  - JVM args from versionJson.arguments.jvm (handle legacy minecraftArguments if present)
  - Must set `-Djava.library.path=<nativesDir>`
  - Add memory defaults (safe): `-Xmx2G -Xms512M` (can be config later)
  - Ensure Windows path quoting is correct
  - Add verbose notes in summary when debug enabled

- `launchVanilla(params): Promise<{ ok: boolean; pid?: number; error?: string }>`
  - Spawn java with args
  - Pipe stdout/stderr to a log file under `.minecraft/logs/mineanvil-launch-<timestamp>.log`
  - Also keep last ~200 lines in memory for IPC error reporting on failure
  - Return pid on success

### 6) IPC surface
Update `electron/src/shared/ipc-types.ts` MineAnvilApi:
- Add:
  - `installVanilla(version: string): Promise<{ ok: boolean; versionId?: string; error?: string; notes?: string[] }>`
  - `getLaunchCommand(version: string): Promise<{ ok: boolean; command?: { javaPath: string; args: string[]; cwd: string }; error?: string }>`
  - `launchVanilla(version: string): Promise<{ ok: boolean; pid?: number; error?: string }>`

Update `electron/src/main/ipc.ts`:
- Implement handlers:
  - `mineanvil:installVanilla`
  - `mineanvil:getLaunchCommand`
  - `mineanvil:launchVanilla`

Update preload accordingly.

### 7) Renderer (browser safe)
Update `src/bridge/mineanvil.ts` stub:
- Implement these new methods returning `{ ok:false, error:"... Windows/Electron only" }`

Update `src/App.tsx` minimal UI:
- Add buttons:
  - "Install Vanilla (Windows)"
  - "Show Launch Command"
  - "Launch Vanilla (Windows)"
- Display results in Diagnostics area (JSON block is fine)
- Log success/failure events (no secrets)

### 8) Logging, diagnostics, safety
- Respect `MINEANVIL_DEBUG=1` for detailed progress logs.
- Never log auth tokens. (For now accessToken is placeholder.)
- Add clear error messages including:
  - which stage failed (manifest/versionJson/jar/libs/assets/natives/spawn)
  - path involved
  - HTTP status code for download failures
- Do not crash the main process on failure.

## Constraints
- Vanilla only, Windows x64 only for now.
- No Fabric/Forge.
- No real Microsoft/Minecraft access token wiring yet.
- Keep dependencies minimal.
- Do not run git commands.

## Output
- File diffs only.
- List changed files.
- Stop.
