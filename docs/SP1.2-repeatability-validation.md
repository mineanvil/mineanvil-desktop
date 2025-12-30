# Stop Point 1.2 — Deterministic Re-run (Repeatability Validation)

This document is the **repeatability test plan** for MineAnvil on the **same machine**.

Goal: prove that **re-running MineAnvil 3 times** produces the same outcome **without corruption, duplication, or undefined behaviour**, per `docs/STOP_POINTS.md` (Stop Point 1.2).

## Scope

- Target: **Windows VM / Windows machine** (reference runtime for Electron).
- This test is **not** about ownership verification (Stop Point 1.1).
- This test is about **idempotency + stability** of on-disk instance state across repeated runs.

## What “repeatable” means here

Across **Run 1 → Run 2 → Run 3**, the instance directory must satisfy:

- **Layout stable**: top-level directories and file locations stay consistent (no “migrating” back and forth).
- **No duplication**: repeated runs do not create duplicate directories (e.g. both `minecraft/` and `.minecraft/` populated) or duplicate installs.
- **No unexpected mutations**: outside of explicitly allowed per-run changes, the file tree contents remain unchanged.

### Allowed / expected per-run changes (explicitly ignore in diffs)

These are expected to change each run and should be excluded from “unexpected state changes” checks:

- `instances/default/logs/mineanvil-main.log` (append-only main-process log)
- `.minecraft/logs/mineanvil-launch-*.log` (timestamped launch logs per run)

Everything else should be stable after the system has reached a “steady state” (i.e. after the first successful install + launch).

## Where the instance data lives

MineAnvil uses Electron `app.getPath("userData")` with the app name set to `MineAnvil`, so on Windows the base path should be:

- `%APPDATA%\MineAnvil\`

The default instance root should be:

- `%APPDATA%\MineAnvil\instances\default\`

Expected subfolders:

- `logs\`
- `downloads\`
- `.minecraft\`

## Preconditions

- Use a **clean Windows VM snapshot** (recommended) or a known-clean Windows user profile.
- Ensure required configuration is present (see `BUILDING.md` for how you run the app in Windows dev mode).
- Ensure the VM has stable networking (to avoid “flaky download” noise on Run 1).

## Test procedure (3 runs)

### 0) Start from a known state

Option A (preferred): revert VM snapshot to “clean machine” state.

Option B: keep the VM but delete MineAnvil user data before starting:

- Delete `%APPDATA%\MineAnvil\` (if present)

Record what you did:

- Reset method: `snapshot revert` / `manual delete`

### 1) Run 1 — First run (boot + optional install/launch)

1. Start MineAnvil.
2. Let it reach an idle-ready state.
3. (Recommended) Trigger a single vanilla install/launch once so the instance reaches steady state.
4. Close MineAnvil cleanly.

After closing, capture a filesystem manifest (“snapshot”) of the instance directory.

### 2) Run 2 — Second run (repeat)

1. Start MineAnvil again.
2. Perform the same action as Run 1 (or do nothing, if Run 1 did nothing).
3. Close MineAnvil cleanly.

Capture the second manifest.

### 3) Run 3 — Third run (repeat again)

Repeat Run 2 once more and capture the third manifest.

## How to capture “expected vs observed” deterministically

You will generate a **manifest JSON** per run containing:

- relative path
- file size
- SHA256 hash

### PowerShell: manifest generator

Run these in PowerShell (non-admin is fine). Adjust `$root` if your `userData` path differs.

```powershell
$root = Join-Path $env:APPDATA "MineAnvil\instances\default"

function New-MineAnvilManifest($outPath) {
  if (!(Test-Path $root)) { throw "Instance root not found: $root" }

  $ignored = @(
    "logs\mineanvil-main.log",
    ".minecraft\logs\mineanvil-launch-*.log"
  )

  $items = Get-ChildItem -LiteralPath $root -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($root.Length).TrimStart("\","/")
    $ignore = $false
    foreach ($p in $ignored) {
      if ($rel -like $p) { $ignore = $true; break }
    }
    if ($ignore) { return $null }

    $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName).Hash
    [PSCustomObject]@{
      path = $rel
      size = $_.Length
      sha256 = $hash
    }
  } | Where-Object { $_ -ne $null } | Sort-Object path

  $items | ConvertTo-Json -Depth 4 | Out-File -Encoding UTF8 $outPath
}

New-MineAnvilManifest "mineanvil-manifest-run1.json"
```

Repeat after each run, writing:

- `mineanvil-manifest-run1.json`
- `mineanvil-manifest-run2.json`
- `mineanvil-manifest-run3.json`

### PowerShell: diff manifests

```powershell
Compare-Object `
  (Get-Content .\mineanvil-manifest-run1.json -Raw | ConvertFrom-Json) `
  (Get-Content .\mineanvil-manifest-run2.json -Raw | ConvertFrom-Json) `
  -Property path,size,sha256
```

Expected:

- Run 2 matches Run 1 once the instance is in steady state (ignoring allowed log churn).
- Run 3 matches Run 2.

If Run 1 includes initial install downloads, you may see changes from Run 1 → Run 2. In that case, the key assertion is:

- **Run 2 == Run 3** (no further mutations or duplication).

## Verification checklist (expected vs observed)

Fill this in as you test.

| Check | Expected | Observed (Run 1) | Observed (Run 2) | Observed (Run 3) | Pass/Fail |
|---|---|---:|---:|---:|---|
| Instance root exists | `%APPDATA%\MineAnvil\instances\default\` present |  |  |  |  |
| Subfolders exist | `logs/`, `downloads/`, `.minecraft/` present |  |  |  |  |
| No legacy duplicate folder | No populated `instances\default\minecraft\` alongside `.minecraft\` |  |  |  |  |
| `instance.json` stable | `instances\default\instance.json` unchanged after creation |  |  |  |  |
| No duplicated installs | No second copy of libraries/assets/versions created |  |  |  |  |
| No unexpected mutations | Manifests match (ignoring allowed log churn) |  |  |  |  |
| Predictable re-run | Run 2 == Run 3 (ignoring allowed log churn) |  |  |  |  |

## Notes / failure capture

If any check fails:

- Attach the three manifest files.
- Describe what action you took in each run (idle only vs install+launch).
- Record any error dialogs shown by MineAnvil.


