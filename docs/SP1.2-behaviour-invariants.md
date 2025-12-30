# Stop Point 1.2 — Stability: Behaviour invariants (Deterministic Re-run)

This note defines the **stability invariants** MineAnvil must satisfy across repeated runs on the **same machine**, and what is **allowed** vs **not allowed** to change between runs.

Scope: Layer 1 / Stop Point 1.2 only. This is a **spec + verification procedure**; it does not claim execution has occurred in this repo on macOS.

## Invariants (must hold across Run 1 → Run 2 → Run 3)

### Instance directory layout

Base storage is Electron `app.getPath("userData")` (Windows expected: `%APPDATA%\MineAnvil\`).

For the default instance:

- `%APPDATA%\MineAnvil\instances\default\` exists
- `%APPDATA%\MineAnvil\instances\default\.minecraft\` exists and is the **only** Minecraft game directory under the instance
  - **Forbidden**: a sibling `%APPDATA%\MineAnvil\instances\default\minecraft\` directory (duplicate/parallel gameDir)
- `%APPDATA%\MineAnvil\instances\default\logs\` exists
- `%APPDATA%\MineAnvil\instances\default\downloads\` exists once the instance “ensure” path has been executed
- `%APPDATA%\MineAnvil\instances\default\instance.json` exists after “ensure”, and is stable after creation
  - If the file is missing/corrupt, it is **repaired** on the next run (idempotent recovery).

### Installed Minecraft versions (steady state)

After the first successful install reaches steady state:

- Re-running the same install does **not** create duplicate `versions/`, `libraries/`, `assets/`, `natives/` trees.
- If `"latest"` was used:
  - `.minecraft/mineanvil/latest-release.json` **pins** the resolved version after first creation.
  - Subsequent runs reuse the pinned version rather than re-resolving via network.

### Config files

- There is **no required on-disk config file** for SP1.2.
- Required configuration is env-driven (example: `MS_CLIENT_ID`); missing/placeholder values fail fast without writing new config state to disk.

### Runtime metadata (Java)

- Startup Java validation must be deterministic for a given machine configuration:
  - With the same `MINEANVIL_JAVA_PATH` / `MINEANVIL_ALLOW_PATH_JAVA` inputs and the same installed Java, startup behaviour should match across runs.
- If/when the managed runtime path is used:
  - Managed runtime install location is stable:
    - `%APPDATA%\MineAnvil\runtimes\<vendor>\<version>\<platform>\...`
  - The managed runtime is not repeatedly re-downloaded once the expected `java.exe` exists.

### Logs

- Instance logs are persistent across runs:
  - `instances/default/logs/mineanvil-main.log` is **append-only**
  - `instances/default/logs/mineanvil-renderer.log` is **append-only**
  - Rotation may occur only when size thresholds are exceeded (bounded `.1`, `.2`, `.3`)
- Launch logs are per-launch and never overwritten:
  - `instances/default/.minecraft/logs/mineanvil-launch-<timestamp>.log`

## Allowed per-run changes (explicitly ignore in diffs)

These changes are expected and should be excluded when asserting stability:

- Append-only growth and possible rotation of:
  - `instances/default/logs/mineanvil-main.log*`
  - `instances/default/logs/mineanvil-renderer.log*`
- New per-launch timestamped files:
  - `instances/default/.minecraft/logs/mineanvil-launch-*.log`
- Token store churn:
  - `secrets/tokens.json` (encrypted; may change due to refresh/sign-in/sign-out)
- First-run materialization:
  - Any first-run downloads/caches that appear on Run 1 but stabilize by Run 2.
- If Run 1 used `"latest"`:
  - Creation of `.minecraft/mineanvil/latest-release.json` (contains a `resolvedAt` timestamp)
  - **Not allowed** after that: rewriting this file on Run 2/3 unless it was missing/corrupt.

## Not allowed (violations)

Any of the following indicates non-determinism / corruption risk:

- Creation of a parallel `minecraft/` folder alongside `.minecraft/` under the instance
- Unbounded duplication of `versions/`, `libraries/`, `assets/`, `natives/` across runs
- `instance.json` changing shape or identity across runs (once created), except repair of a missing/corrupt file
- Silent deletion or corruption of previously installed version artifacts
- Writes occurring outside MineAnvil-controlled directories (`app.getPath("userData")` subtree)
- Secrets/tokens appearing in any logs

## Verification procedure (Windows VM; 3 runs)

Reference: `docs/SP1.2-repeatability-validation.md` and `docs/SP1.2-stability-verification.md`.

- Start from a clean Windows VM snapshot, or delete `%APPDATA%\MineAnvil\` before Run 1.
- Choose one consistent “steady state” to reach each run (e.g. idle-ready UI only, or install+launch once).
- After each run exits, capture a filesystem manifest of `%APPDATA%\MineAnvil\` and compare:
  - Expect Run 1 → Run 2 changes due to first-run downloads.
  - The determinism assertion is **Run 2 == Run 3** after excluding “Allowed per-run changes”.


