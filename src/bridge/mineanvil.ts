import type { AuthStatus, MineAnvilApi, PingResult } from "../../electron/src/shared/ipc-types";

let warned = false;

function warnOnce(): void {
  if (warned) return;
  warned = true;
  // Prefer a proper renderer logger later; console is acceptable for now.
  console.warn("[MineAnvil] window.mineanvil not found; using browser stub API");
}

function createBrowserStub(): MineAnvilApi {
  warnOnce();

  return {
    ping: async (): Promise<PingResult> => ({ ok: true, ts: Date.now() }),
    authGetStatus: async (): Promise<AuthStatus> => ({
      signedIn: false,
    }),
  };
}

/**
 * Get a typed MineAnvil API that works in:
 * - Browser mode (Vite dev on macOS): returns a stub implementation
 * - Electron mode (Windows runner): returns the preload-exposed API
 */
export function getMineAnvilApi(): MineAnvilApi {
  if (typeof window !== "undefined" && window.mineanvil) return window.mineanvil;
  return createBrowserStub();
}


