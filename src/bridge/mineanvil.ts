import type { AuthStatus, MineAnvilApi, PingResult } from "../../electron/src/shared/ipc-types";

let warned = false;
type BrowserStubApi = MineAnvilApi & { __dev: { setAuthStatus: (status: AuthStatus) => void } };

let browserStub: BrowserStubApi | null = null;
let browserAuthStatus: AuthStatus = { signedIn: false };

function warnOnce(): void {
  if (warned) return;
  warned = true;
  // Prefer a proper renderer logger later; console is acceptable for now.
  console.warn("[MineAnvil] window.mineanvil not found; using browser stub API");
}

function createBrowserStub(): BrowserStubApi {
  warnOnce();

  const stub: BrowserStubApi = {
    ping: async (): Promise<PingResult> => ({ ok: true, ts: Date.now() }),
    authGetStatus: async (): Promise<AuthStatus> => browserAuthStatus,
    authSignIn: async () => ({
      ok: false,
      error: "authSignIn is only available in Electron on Windows",
    }),
    authSignOut: async () => ({
      ok: false,
      error: "authSignOut is only available in Electron on Windows",
    }),
    getLaunchPlan: async () => ({
      ok: false,
      error: "getLaunchPlan is only available in Electron on Windows",
    }),
    ensureRuntime: async () => ({
      ok: false,
      error: "ensureRuntime is only available in Electron on Windows",
    }),
    getRuntimeStatus: async () => ({
      ok: false,
      installed: false,
      error: "getRuntimeStatus is only available in Electron on Windows",
    }),
    // Dev-only escape hatch for browser mode. Not part of the public API contract.
    __dev: {
      setAuthStatus: (status: AuthStatus) => {
        browserAuthStatus = status;
      },
    },
  };

  return stub;
}

/**
 * Get a typed MineAnvil API that works in:
 * - Browser mode (Vite dev on macOS): returns a stub implementation
 * - Electron mode (Windows runner): returns the preload-exposed API
 */
export function getMineAnvilApi(): MineAnvilApi {
  if (typeof window !== "undefined" && window.mineanvil) return window.mineanvil;
  if (!browserStub) browserStub = createBrowserStub();
  return browserStub;
}


