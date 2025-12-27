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

import type { LaunchPlan } from "../core/types";

export const IPC_CHANNELS = {
  ping: "mineanvil:ping",
  authGetStatus: "mineanvil:authGetStatus",
  authSignIn: "mineanvil:authSignIn",
  authSignOut: "mineanvil:authSignOut",
  getLaunchPlan: "mineanvil:getLaunchPlan",
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

/**
 * API exposed to the renderer via `contextBridge.exposeInMainWorld`.
 * The renderer should never import from `electron` directly.
 */
export interface PingResult {
  readonly ok: boolean;
  /** Unix epoch millis. */
  readonly ts: number;
}

export interface AuthStatus {
  readonly signedIn: boolean;
  /** Display name (non-secret). */
  readonly displayName?: string;
  /** Minecraft UUID or account identifier (non-secret). */
  readonly uuid?: string;
  /** Token expiry (epoch ms). Optional; for debugging only. */
  readonly expiresAt?: number;
  /** Whether Minecraft: Java is owned (best-effort). */
  readonly minecraftOwned?: boolean;
}

export interface AuthSignInResult {
  readonly ok: boolean;
  readonly error?: string;
}

export interface GetLaunchPlanResult {
  readonly ok: boolean;
  readonly plan?: LaunchPlan;
  readonly error?: string;
}

/**
 * API exposed to the renderer via `contextBridge.exposeInMainWorld`.
 * The renderer should never import from `electron` directly.
 */
export interface MineAnvilApi {
  /** Test call to validate wiring. */
  ping(): Promise<PingResult>;

  /** Retrieve basic auth/session status for UI gating. */
  authGetStatus(): Promise<AuthStatus>;

  /** Start interactive sign-in (Electron/Windows only). */
  authSignIn(): Promise<AuthSignInResult>;

  /** Sign out (Electron/Windows only). */
  authSignOut(): Promise<AuthSignInResult>;

  /** Build a dry-run launch plan (Electron/Windows only). */
  getLaunchPlan(): Promise<GetLaunchPlanResult>;
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


