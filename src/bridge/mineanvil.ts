import type {
  AuthStatus,
  AppendRendererLogResult,
  FailureInfo,
  MineAnvilApi,
  PingResult,
} from "../../electron/src/shared/ipc-types";
import type { LogEntry } from "../../electron/src/shared/logging";

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

  const notElectronFailure = (category: FailureInfo["category"], action: string): FailureInfo => ({
    category,
    kind: "PERMANENT",
    canRetry: false,
    userMessage: `${action} is only available in Electron on Windows`,
  });

  const stub: BrowserStubApi = {
    ping: async (): Promise<PingResult> => ({ ok: true, ts: Date.now() }),
    appendRendererLog: async (_entry: LogEntry): Promise<AppendRendererLogResult> => ({ ok: false }),
    authGetStatus: async (): Promise<AuthStatus> => browserAuthStatus,
    authSignIn: async () => ({
      ok: false,
      error: "authSignIn is only available in Electron on Windows",
      failure: notElectronFailure("AUTHENTICATION", "authSignIn"),
    }),
    authSignOut: async () => ({
      ok: false,
      error: "authSignOut is only available in Electron on Windows",
      failure: notElectronFailure("AUTHENTICATION", "authSignOut"),
    }),
    getLaunchPlan: async () => ({
      ok: false,
      error: "getLaunchPlan is only available in Electron on Windows",
      failure: notElectronFailure("LAUNCH", "getLaunchPlan"),
    }),
    ensureRuntime: async () => ({
      ok: false,
      error: "ensureRuntime is only available in Electron on Windows",
      failure: notElectronFailure("RUNTIME", "ensureRuntime"),
    }),
    getRuntimeStatus: async () => ({
      ok: false,
      installed: false,
      error: "getRuntimeStatus is only available in Electron on Windows",
      failure: notElectronFailure("RUNTIME", "getRuntimeStatus"),
    }),
    installVanilla: async () => ({
      ok: false,
      error: "installVanilla is only available in Electron on Windows",
      failure: notElectronFailure("LAUNCH", "installVanilla"),
    }),
    getLaunchCommand: async () => ({
      ok: false,
      error: "getLaunchCommand is only available in Electron on Windows",
      failure: notElectronFailure("LAUNCH", "getLaunchCommand"),
    }),
    launchVanilla: async () => ({
      ok: false,
      error: "launchVanilla is only available in Electron on Windows",
      failure: notElectronFailure("LAUNCH", "launchVanilla"),
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


