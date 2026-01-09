import type {
  AuthStatus,
  AppendRendererLogResult,
  FailureInfo,
  GameId,
  GamesListResult,
  GameGetStatusResult,
  GamePrepareResult,
  GameLaunchResult,
  GameMode,
  MineAnvilApi,
  PingResult,
} from "../../electron/src/shared/ipc-types";
import type { LogEntry } from "../../electron/src/shared/logging";

let warned = false;
type BrowserStubApi = MineAnvilApi & { __dev: { setAuthStatus: (status: AuthStatus) => void } };

let browserStub: BrowserStubApi | null = null;
let browserAuthStatus: AuthStatus = { signedIn: false };

function toMinecraftGameId(gameId: GameId): boolean {
  return gameId === "minecraft";
}

/**
 * Backward compatibility: older preloads may not expose the new `game*` methods yet.
 * We polyfill them by delegating to the existing Minecraft-specific API where possible.
 */
function ensureGameApi(api: MineAnvilApi): MineAnvilApi {
  const anyApi = api as any;
  const hasGameApi =
    typeof anyApi.gamesList === "function" &&
    typeof anyApi.gameGetStatus === "function" &&
    typeof anyApi.gamePrepare === "function" &&
    typeof anyApi.gameLaunch === "function";

  if (hasGameApi) return api;

  const gamesList = async (): Promise<GamesListResult> => ({
    ok: true,
    games: [{ id: "minecraft", label: "Minecraft" }],
  });

  const gameGetStatus = async (gameId: GameId): Promise<GameGetStatusResult> => {
    if (!toMinecraftGameId(gameId)) {
      return { ok: false, error: `Unknown game: ${String(gameId)}` };
    }

    const status = await api.authGetStatus();
    if (!status.signedIn) {
      return {
        ok: true,
        status: { gameId: "minecraft", readiness: "blocked", message: "Sign in required", demoAvailable: false },
      };
    }

    const username = status.displayName;
    if (status.ownershipState === "OWNED") {
      return {
        ok: true,
        status: { gameId: "minecraft", readiness: "ready", message: "Ready", username, demoAvailable: true },
      };
    }

    return {
      ok: true,
      status: { gameId: "minecraft", readiness: "demo", message: "Minecraft license not found", username, demoAvailable: true },
    };
  };

  const gamePrepare = async (gameId: GameId): Promise<GamePrepareResult> => {
    if (!toMinecraftGameId(gameId)) {
      return { ok: false, error: `Unknown game: ${String(gameId)}` };
    }

    // Best-effort: use existing primitives if available.
    if (typeof api.ensureRuntime === "function") {
      const rt = await api.ensureRuntime();
      if (!rt.ok) return { ok: false, error: rt.error, failure: rt.failure };
    }

    if (typeof api.installVanilla === "function") {
      const install = await api.installVanilla("latest");
      if (!install.ok) return { ok: false, error: install.error, failure: install.failure };
    }

    if (typeof api.getLaunchPlan === "function") {
      const plan = await api.getLaunchPlan();
      if (!plan.ok) return { ok: false, error: plan.error, failure: plan.failure };
    }

    return { ok: true };
  };

  const gameLaunch = async (gameId: GameId, mode: GameMode): Promise<GameLaunchResult> => {
    if (!toMinecraftGameId(gameId)) {
      return { ok: false, error: `Unknown game: ${String(gameId)}` };
    }

    if (typeof api.launchVanilla !== "function") {
      return { ok: false, error: "launchVanilla not available" };
    }

    const res = await api.launchVanilla("latest", mode === "demo" ? "demo" : undefined);
    return { ok: Boolean(res.ok), pid: res.pid, error: res.error, failure: res.failure };
  };

  return {
    ...api,
    gamesList,
    gameGetStatus,
    gamePrepare,
    gameLaunch,
  };
}

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
    gamesList: async (): Promise<GamesListResult> => ({
      ok: true,
      games: [{ id: "minecraft" as GameId, label: "Minecraft" }],
    }),
    gameGetStatus: async (_gameId: GameId): Promise<GameGetStatusResult> => ({
      ok: true,
      status: {
        gameId: "minecraft" as GameId,
        readiness: "unknown",
        message: "Available in Electron on Windows",
        demoAvailable: true,
      },
    }),
    gamePrepare: async (_gameId: GameId): Promise<GamePrepareResult> => ({
      ok: false,
      error: "gamePrepare is only available in Electron on Windows",
      failure: notElectronFailure("LAUNCH", "gamePrepare"),
    }),
    gameLaunch: async (_gameId: GameId, _mode: GameMode): Promise<GameLaunchResult> => ({
      ok: false,
      error: "gameLaunch is only available in Electron on Windows",
      failure: notElectronFailure("LAUNCH", "gameLaunch"),
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
    closeWindow: async () => ({
      ok: false,
    }),
    checkMinecraftLauncher: async () => ({
      ok: false,
      installed: false,
      error: "checkMinecraftLauncher is only available in Electron on Windows",
      failure: notElectronFailure("RUNTIME", "checkMinecraftLauncher"),
    }),
    installMinecraftLauncher: async () => ({
      ok: false,
      error: "installMinecraftLauncher is only available in Electron on Windows",
      failure: notElectronFailure("RUNTIME", "installMinecraftLauncher"),
    }),
    cancelMinecraftLauncherInstall: async () => ({
      ok: false,
      error: "cancelMinecraftLauncherInstall is only available in Electron on Windows",
    }),
    pickLocalInstaller: async () => ({
      ok: false,
      error: "pickLocalInstaller is only available in Electron on Windows",
    }),
    openInstaller: async () => ({
      ok: false,
      error: "openInstaller is only available in Electron on Windows",
    }),
    showInstallerInFolder: async () => ({
      ok: false,
      error: "showInstallerInFolder is only available in Electron on Windows",
    }),
    resetLockfile: async () => ({
      ok: false,
      error: "resetLockfile is only available in Electron on Windows",
      failure: notElectronFailure("LAUNCH", "resetLockfile"),
    }),
    getStartupError: async () => ({
      error: null,
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
  if (typeof window !== "undefined" && window.mineanvil) return ensureGameApi(window.mineanvil);
  if (!browserStub) browserStub = createBrowserStub();
  return browserStub;
}


