# SP1.3 — Logging Persistence (Failure Transparency)

This note documents MineAnvil’s log persistence guarantees for Stop Point 1.3.

## Windows log locations (predictable)

MineAnvil stores instance-scoped logs under the Electron `userData` directory:

- **Base directory**: `app.getPath("userData")`
  - On Windows this resolves under **`%APPDATA%\\MineAnvil`** (stable because `app.setName("MineAnvil")` is set before any `app.getPath(...)` calls).
- **Default instance logs directory**: `<userData>\\instances\\default\\logs\\`

Files:

- **Main process**: `<userData>\\instances\\default\\logs\\mineanvil-main.log`
- **Renderer**: `<userData>\\instances\\default\\logs\\mineanvil-renderer.log`

## Persistence across runs

- Both files are opened in **append** mode, so logs **persist across app restarts**.
- On startup, MineAnvil performs a **best-effort size-based rotation** to keep logs bounded:
  - If a log exceeds ~5 MiB, it is renamed to `.1` and older suffixes are shifted (`.2`, `.3`).

## Structured + readable

- Logs are written as **JSON Lines** (one JSON object per line).
- Canonical shape is defined in `electron/src/shared/logging.ts`:
  - `ts` (ISO timestamp), `level`, `area`, `message`, optional `meta`

## No secrets in logs (re-confirmed)

Rules:

- Call sites must not put secrets into `meta`.
- The shared logging helper applies best-effort redaction for common secret keys (e.g. `token`, `authorization`, `password`).
- Renderer-to-disk persistence is implemented via a typed IPC method that **re-applies redaction in the main process** before writing.

Notes:

- OAuth/token flows log only **presence/metadata** (e.g. “hasRefreshToken”, expiry), not the token values themselves.

## Debug / verbose mode

- Set `MINEANVIL_DEBUG=1` to enable verbose (`debug`) log emission where supported.


