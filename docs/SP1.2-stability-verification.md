# Stop Point 1.2 — Stability Verification (Deterministic Re-run)

This note records the **stability verification checklist** for repeated runs of MineAnvil and the current understanding of what **state** exists on disk.

Per `docs/STOP_POINTS.md`, Stop Point 1.2 is only complete when this is **executed on a Windows VM / Windows machine** (the reference runtime for Electron).

## What “state” means for MineAnvil (on disk)

MineAnvil stores state under Electron `app.getPath("userData")` with the app name set to `MineAnvil` (see `electron/src/main/main.ts`).

On Windows, the base path is expected to be:

- `%APPDATA%\MineAnvil\`

MineAnvil state includes:

- **Instance directory layout**
  - `%APPDATA%\MineAnvil\instances\default\`
    - `.minecraft\` (primary game directory; must not be duplicated as `minecraft\`)
    - `logs\`
    - `downloads\` *(created when instance is “ensured” via instance code paths; may not exist after a pure “boot only” run)*
    - `instance.json` *(created once when instance is “ensured”)*
- **Installed versions (vanilla)**
  - `%APPDATA%\MineAnvil\instances\default\.minecraft\versions\...`
  - `%APPDATA%\MineAnvil\instances\default\.minecraft\libraries\...`
  - `%APPDATA%\MineAnvil\instances\default\.minecraft\assets\...`
  - `%APPDATA%\MineAnvil\instances\default\.minecraft\natives\<version>\...`
  - `%APPDATA%\MineAnvil\instances\default\.minecraft\mineanvil\latest-release.json` *(if “latest” is used; pins the resolved version after the first install)*
- **Logs**
  - `%APPDATA%\MineAnvil\instances\default\logs\mineanvil-main.log` *(append-only; may rotate to `.1`, `.2`, ... if oversized)*
  - `%APPDATA%\MineAnvil\instances\default\logs\mineanvil-renderer.log` *(append-only; may rotate similarly)*
  - `%APPDATA%\MineAnvil\instances\default\.minecraft\logs\mineanvil-launch-<timestamp>.log` *(one per launch)*
- **Config files**
  - **Runtime configuration is env-driven** (e.g. Microsoft Client ID); there is no required on-disk config file for SP1.2.
- **Other userData state that may change across runs**
  - `%APPDATA%\MineAnvil\secrets\tokens.json` *(encrypted token store; may change due to refresh / sign-in / sign-out)*
  - `%APPDATA%\MineAnvil\runtimes\...` and `%APPDATA%\MineAnvil\downloads\...` *(managed Java runtime install artifacts)*

## Expected invariants across runs (Run 1 → Run 2 → Run 3)

### Instance layout invariants

- The instance root remains: `%APPDATA%\MineAnvil\instances\default\`
- `.minecraft\` is the only populated Minecraft directory under the instance (no parallel `minecraft\` folder)
- `instance.json` content is stable after creation (current shape is `{ id, name }`)

### Installer / version invariants (steady state)

After the first successful install reaches a “steady state”:

- Re-running the same install does **not** create duplicate `versions/`, `libraries/`, or `assets/` trees
- “latest” resolution becomes stable because `latest-release.json` is written once and then reused

### Logging invariants

- Main and renderer logs are **append-only**, and only rotate when crossing size limits
- Launch logs are **per-run timestamped**, not overwritten

## Allowed per-run changes (explicitly ignore in diffs)

These are expected to change between runs and should be excluded when asserting stability:

- `instances/default/logs/mineanvil-main.log` *(and rotated siblings `mineanvil-main.log.1`, etc, if rotation occurs)*
- `instances/default/logs/mineanvil-renderer.log` *(and rotated siblings, if rotation occurs)*
- `instances/default/.minecraft/logs/mineanvil-launch-*.log`
- `secrets/tokens.json` *(token refresh/sign-in churn; contents are encrypted)*
- If Run 1 performed the first install using `"latest"`, the creation of:
  - `.minecraft/mineanvil/latest-release.json` *(includes a `resolvedAt` timestamp; should not be rewritten on Run 2/3)*

## Stability verification checklist (3 runs)

Reference plan: `docs/SP1.2-repeatability-validation.md`.

### Preconditions

- Use a clean Windows VM snapshot (preferred) or delete `%APPDATA%\MineAnvil\` before starting.
- Ensure required environment configuration is present to allow the app to reach the intended state for each run.

### Run procedure (repeat 3 times)

For each run:

- Start MineAnvil
- Reach the same “steady” state each time (choose **one** and be consistent):
  - **Idle-only**: open → reach idle-ready UI → close, or
  - **Install+launch once**: perform one vanilla install/launch → close
- After the app exits, capture a filesystem manifest of `%APPDATA%\MineAnvil\instances\default\` excluding “Allowed per-run changes”

### Pass criteria

- If Run 1 included first-time downloads, expect Run 1 → Run 2 changes.
- The key stability assertion is:
  - **Run 2 == Run 3** (ignoring allowed per-run changes)

## Execution status / observed violations

- **This checklist is not executable on macOS in this repo** (Electron is Windows-only; see `BUILDING.md`).
- **Observed violations in this environment**: none (not executed).

Important nuance when executing on Windows:

- A pure “boot only” run creates `instances/default/.minecraft` and `instances/default/logs` early, but `downloads/` and `instance.json` are created by instance “ensure” code paths used by actions like launch planning / install / launch.
  - If your checklist expects `downloads/` and `instance.json` to exist, make sure each run performs an action that calls the instance ensure path before capturing manifests.


