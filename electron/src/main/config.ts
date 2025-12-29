/**
 * Electron main configuration helpers.
 *
 * Stage 2:
 * - Load dev-only `.env` via dotenv (not committed)
 * - Provide typed getters for required configuration
 *
 * SECURITY:
 * - Never log secret values. (MS_CLIENT_ID is not a secret, but still not logged.)
 */

import * as path from "node:path";

const PLACEHOLDER_MS_CLIENT_ID = "YOUR_MICROSOFT_PUBLIC_CLIENT_ID";

let envLoaded = false;

function isDev(): boolean {
  // Dev-only env loading: do not attempt to read `.env` in production.
  // (Packaged builds and production environments should provide real env vars.)
  return process.env.NODE_ENV !== "production";
}

/**
 * In dev only, load `.env` from project root (process.cwd()).
 * Failures are ignored (env vars may already be provided by the shell/CI).
 */
export function loadEnvOnce(): void {
  if (envLoaded) return;
  envLoaded = true;

  if (!isDev()) return;

  try {
    // Optional dependency: if `dotenv` is not installed, we simply skip loading `.env`.
    // This avoids crashing the app with "Cannot find module 'dotenv'".
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const dotenv = require("dotenv") as { config: (opts: { path: string }) => unknown };
    dotenv.config({ path: path.resolve(process.cwd(), ".env") });
  } catch {
    // Ignore failures; dev may still provide env vars via shell.
  }
}

export function getMsClientId(): string {
  loadEnvOnce();

  const raw = (process.env.MS_CLIENT_ID ?? "").trim();
  if (!raw || raw === PLACEHOLDER_MS_CLIENT_ID) {
    throw new Error(
      "Microsoft Client ID not configured. Set MS_CLIENT_ID in .env (dev) or environment.",
    );
  }
  return raw;
}

export function validateRequiredConfig(): { ok: true } | { ok: false; message: string } {
  try {
    // Reuse the single source of truth for MS_CLIENT_ID validation.
    void getMsClientId();
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: msg };
  }
}


