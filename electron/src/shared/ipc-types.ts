/**
 * Typed IPC contracts shared between:
 * - Electron main process (`electron/src/main/**`)
 * - Electron preload (`electron/src/preload/**`)
 * - Renderer (later, via a thin adapter)
 *
 * IMPORTANT:
 * - Keep this file free of Electron imports so it can be shared safely.
 * - Types only; no runtime side effects.
 */

import type { LaunchPlan, RuntimeDescriptor } from "../core/types";
import type { LogEntry } from "./logging";

export const IPC_CHANNELS = {
  ping: "mineanvil:ping",
  appendRendererLog: "mineanvil:appendRendererLog",
  authGetStatus: "mineanvil:authGetStatus",
  authSignIn: "mineanvil:authSignIn",
  authSignOut: "mineanvil:authSignOut",
  getLaunchPlan: "mineanvil:getLaunchPlan",
  ensureRuntime: "mineanvil:ensureRuntime",
  getRuntimeStatus: "mineanvil:getRuntimeStatus",
  installVanilla: "mineanvil:installVanilla",
  getLaunchCommand: "mineanvil:getLaunchCommand",
  launchVanilla: "mineanvil:launchVanilla",
  closeWindow: "mineanvil:closeWindow",
  checkMinecraftLauncher: "mineanvil:checkMinecraftLauncher",
  installMinecraftLauncher: "mineanvil:installMinecraftLauncher",
  cancelMinecraftLauncherInstall: "mineanvil:cancelMinecraftLauncherInstall",
  pickLocalInstaller: "mineanvil:pickLocalInstaller",
  openInstaller: "mineanvil:openInstaller",
  showInstallerInFolder: "mineanvil:showInstallerInFolder",
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

/**
 * Stop Point 1.3 — Failure Transparency
 *
 * A typed failure envelope so callers can distinguish:
 * - category (auth/ownership/runtime/launch)
 * - retryability (temporary vs permanent)
 *
 * SECURITY:
 * - Never include secrets (tokens, auth codes) in `userMessage` or `debug`.
 */
export type FailureCategory = "AUTHENTICATION" | "OWNERSHIP" | "RUNTIME" | "LAUNCH";
export type FailureKind = "TEMPORARY" | "PERMANENT";

export interface FailureInfo {
  readonly category: FailureCategory;
  readonly kind: FailureKind;
  /** Plain-language, user-facing text suitable for UI. */
  readonly userMessage: string;
  /**
   * Whether retrying the same action (without changing inputs) is meaningful.
   * Example: transient network error => true; unsupported platform => false.
   */
  readonly canRetry: boolean;
  /** Optional, non-secret debug metadata for diagnostics (safe to export). */
  readonly debug?: Record<string, unknown>;
}

/**
 * API exposed to the renderer via `contextBridge.exposeInMainWorld`.
 * The renderer should never import from `electron` directly.
 */
export interface PingResult {
  readonly ok: boolean;
  /** Unix epoch millis. */
  readonly ts: number;
}

export interface AppendRendererLogResult {
  readonly ok: boolean;
}

export type OwnershipState =
  | "OWNED"
  | "NOT_OWNED"
  | "UNVERIFIED_APP_NOT_APPROVED"
  | "UNVERIFIED_TEMPORARY";

export type AuthStatus =
  | {
      readonly signedIn: false;
      /** Token expiry (epoch ms). Optional; for debugging only. */
      readonly expiresAt?: number;
    }
  | {
      readonly signedIn: true;
      /** Token expiry (epoch ms). Optional; for debugging only. */
      readonly expiresAt?: number;
      /** Ownership verification state for Minecraft: Java Edition. */
      readonly ownershipState: OwnershipState;
      /** Back-compat: whether Minecraft: Java is owned (best-effort). */
      readonly minecraftOwned?: boolean;
      /** Display name (non-secret). Present only when ownership is verified. */
      readonly displayName?: string;
      /** Minecraft UUID or account identifier (non-secret). Present only when ownership is verified. */
      readonly uuid?: string;
    };

export interface AuthSignInResult {
  readonly ok: boolean;
  readonly error?: string;
  readonly failure?: FailureInfo;
}

export interface GetLaunchPlanResult {
  readonly ok: boolean;
  readonly plan?: LaunchPlan;
  readonly error?: string;
  readonly failure?: FailureInfo;
}

export interface EnsureRuntimeResult {
  readonly ok: boolean;
  readonly runtime?: RuntimeDescriptor;
  readonly error?: string;
  readonly failure?: FailureInfo;
}

export interface GetRuntimeStatusResult {
  readonly ok: boolean;
  readonly installed: boolean;
  readonly runtime?: RuntimeDescriptor;
  readonly error?: string;
  readonly failure?: FailureInfo;
}

export interface InstallVanillaResult {
  readonly ok: boolean;
  readonly versionId?: string;
  readonly notes?: string[];
  readonly error?: string;
  readonly failure?: FailureInfo;
}

export interface GetLaunchCommandResult {
  readonly ok: boolean;
  readonly command?: { javaPath: string; args: string[]; cwd: string };
  readonly error?: string;
  readonly failure?: FailureInfo;
}

export interface LaunchVanillaResult {
  readonly ok: boolean;
  readonly pid?: number;
  readonly error?: string;
  readonly failure?: FailureInfo;
}

export interface CloseWindowResult {
  readonly ok: boolean;
}

export type MinecraftLauncherInstallProgressState = "preparing" | "downloading" | "installing" | "verifying" | "complete" | "error";

export interface MinecraftLauncherInstallProgress {
  readonly state: MinecraftLauncherInstallProgressState;
  readonly message: string;
  readonly error?: string;
}

export interface CheckMinecraftLauncherResult {
  readonly ok: boolean;
  readonly installed: boolean;
  readonly error?: string;
  readonly failure?: FailureInfo;
}

export interface InstallMinecraftLauncherResult {
  readonly ok: boolean;
  readonly error?: string;
  readonly failure?: FailureInfo;
  readonly usedMethod?: "winget" | "official" | "store" | "msi";
  readonly stillWaiting?: boolean;
  readonly installerPath?: string;
}

export interface CancelMinecraftLauncherInstallResult {
  readonly ok: boolean;
  readonly error?: string;
}

export interface PickLocalInstallerResult {
  readonly ok: boolean;
  readonly filePath?: string;
  readonly cancelled?: boolean;
  readonly error?: string;
}

export interface OpenInstallerResult {
  readonly ok: boolean;
  readonly error?: string;
}

export interface ShowInstallerInFolderResult {
  readonly ok: boolean;
  readonly error?: string;
}

/**
 * API exposed to the renderer via `contextBridge.exposeInMainWorld`.
 * The renderer should never import from `electron` directly.
 */
export interface MineAnvilApi {
  /** Test call to validate wiring. */
  ping(): Promise<PingResult>;

  /**
   * Append a structured renderer log entry to the on-disk instance logs (Electron only).
   *
   * SECURITY:
   * - Never include secrets in meta; the main process applies best-effort redaction again.
   * - This is best-effort and should never block the UI.
   */
  appendRendererLog(entry: LogEntry): Promise<AppendRendererLogResult>;

  /** Retrieve basic auth/session status for UI gating. */
  authGetStatus(): Promise<AuthStatus>;

  /** Start interactive sign-in (Electron/Windows only). */
  authSignIn(): Promise<AuthSignInResult>;

  /** Sign out (Electron/Windows only). */
  authSignOut(): Promise<AuthSignInResult>;

  /** Build a dry-run launch plan (Electron/Windows only). */
  getLaunchPlan(): Promise<GetLaunchPlanResult>;

  /** Ensure a managed/runtime is available (Electron/Windows only). */
  ensureRuntime(): Promise<EnsureRuntimeResult>;

  /** Check whether managed runtime is installed (Electron/Windows only). */
  getRuntimeStatus(): Promise<GetRuntimeStatusResult>;

  /** Install vanilla Minecraft for a version (Electron/Windows only). */
  installVanilla(version: string): Promise<InstallVanillaResult>;

  /** Build the launch command (Electron/Windows only). */
  getLaunchCommand(version: string): Promise<GetLaunchCommandResult>;

  /** Launch vanilla Minecraft (Electron/Windows only). */
  launchVanilla(version: string, launchMode?: "normal" | "demo"): Promise<LaunchVanillaResult>;

  /** Close the main window (Electron/Windows only). */
  closeWindow(): Promise<CloseWindowResult>;

  /** Check if Minecraft Launcher is installed (Electron/Windows only). */
  checkMinecraftLauncher(): Promise<CheckMinecraftLauncherResult>;

  /**
   * Install Minecraft Launcher (Electron/Windows only).
   * Progress updates are sent via progress callback.
   */
  installMinecraftLauncher(options?: {
    preferStore?: boolean;
    msiPath?: string;
  }): Promise<InstallMinecraftLauncherResult>;

  /** Cancel ongoing Minecraft Launcher installation (Electron/Windows only). */
  cancelMinecraftLauncherInstall(): Promise<CancelMinecraftLauncherInstallResult>;

  /** Show file picker for local installer (Electron/Windows only). */
  pickLocalInstaller(): Promise<PickLocalInstallerResult>;

  /** Open downloaded installer with default application (Electron/Windows only). */
  openInstaller(installerPath: string): Promise<OpenInstallerResult>;

  /** Show downloaded installer file in Explorer (Electron/Windows only). */
  showInstallerInFolder(installerPath: string): Promise<ShowInstallerInFolderResult>;
}

declare global {
  interface Window {
    /**
     * Preload-exposed API.
     *
     * NOTE: The renderer may still run in a normal browser (Vite dev), where
     * this object will be absent until we add a browser-safe adapter later.
     */
    mineanvil?: MineAnvilApi;
  }
}


