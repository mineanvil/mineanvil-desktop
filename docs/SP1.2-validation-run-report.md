# Stop Point 1.2 — Deterministic Re-run (Validation Run Report)

This document records **execution results** for the repeatability plan:

- Reference plan: `docs/SP1.2-repeatability-validation.md`
- Reference checklist/invariants: `docs/SP1.2-stability-verification.md`

Per `docs/STOP_POINTS.md`, Stop Point 1.2 is only complete once this validation is **executed on a clean Windows machine / Windows VM** and shows **predictable, repeatable outcomes** across consecutive runs.

---

## Execution environment

- Date: 2025-12-30
- Executor: Cursor agent (local repo inspection + documentation only)
- Host OS: macOS (darwin 25.1.0)

### Execution status

- **Windows runs executed**: **No (blocked in this environment)**
- **Reason**: this repository’s Electron runtime is Windows-targeted for stop point evidence, and this environment does not provide a Windows VM to perform the required on-disk repeatability checks under `%APPDATA%\MineAnvil\...`.

This report is therefore a **run-ready worksheet** that must be completed on Windows. No claims of SP1.2 completion are made here.

---

## Required artifacts (Windows)

After each run, capture the filesystem manifest JSONs described in the reference plan:

- `mineanvil-manifest-run1.json`
- `mineanvil-manifest-run2.json`
- `mineanvil-manifest-run3.json`

These manifests must be generated from:

- `%APPDATA%\MineAnvil\instances\default\`

…excluding “allowed per-run changes” (logs, tokens) exactly as described in `docs/SP1.2-repeatability-validation.md`.

---

## Test procedure (Windows) — record what you actually did

### 0) Reset method

Choose one and record it:

- Reset method: `snapshot revert` / `manual delete`
- If manual delete used: confirmed `%APPDATA%\MineAnvil\` deleted before Run 1: Yes/No

### Steady-state action (must be consistent across runs)

Pick one and use it for Run 1/2/3:

- Mode: `idle-only` / `install+launch once`
- Notes (what you clicked / what version / what instance): _<fill>_

---

## Verification checklist (expected vs observed)

Fill in the “Observed” columns while executing on Windows.

| Check | Expected | Observed (Run 1) | Observed (Run 2) | Observed (Run 3) | Pass/Fail |
|---|---|---|---|---|---|
| Instance root exists | `%APPDATA%\MineAnvil\instances\default\` present |  |  |  |  |
| Subfolders exist | `logs/`, `downloads/`, `.minecraft/` present *(see note below)* |  |  |  |  |
| No legacy duplicate folder | No populated `instances\default\minecraft\` alongside `.minecraft\` |  |  |  |  |
| `instance.json` stable | `instances\default\instance.json` unchanged after creation |  |  |  |  |
| No duplicated installs | No duplicate `libraries/`, `assets/`, `versions/` trees created |  |  |  |  |
| No unexpected mutations | Manifests match (ignoring allowed per-run changes) |  |  |  |  |
| Predictable re-run | **Run 2 == Run 3** (ignoring allowed per-run changes) |  |  |  |  |

Important nuance (from `docs/SP1.2-stability-verification.md`):

- A pure “boot only” run may not create `downloads/` or `instance.json` unless an action triggers the instance “ensure” path. If your checklist expects `downloads/` and `instance.json`, use the `install+launch once` mode (or otherwise ensure the same code path runs each time) before capturing manifests.

---

## Manifest diff results (Windows)

Paste the output of your comparisons here.

### Run 1 vs Run 2

_Compare-Object output:_

```text
<paste>
```

### Run 2 vs Run 3

_Compare-Object output:_

```text
<paste>
```

Expected:

- If Run 1 includes first-time downloads, Run 1 → Run 2 may differ.
- **The critical assertion is Run 2 == Run 3** (excluding allowed churn).

---

## Notes / issues observed (Windows)

Record:

- Any error dialogs
- Any retries required
- Any duplicated directories/files found (paths)
- Any manifest mismatches (paths + why they might have changed)

---

## Current conclusion (this repo workspace)

- **SP1.2 validation run status**: **Not executed (requires Windows evidence)**
- **Next action**: run the reference plan on a clean Windows VM, attach manifests, and then update `docs/STOP_POINTS.md` SP1.2 checkboxes based on the observed results.


