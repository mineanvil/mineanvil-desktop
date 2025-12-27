/**
 * Core domain types shared across MineAnvil's core services.
 *
 * IMPORTANT:
 * - This folder is "core": it must contain NO Electron imports and NO side effects.
 * - Only types/interfaces live here (no IO, no implementations).
 */

/** Branded string type helper to prevent mixing identifiers. */
export type Brand<T, B extends string> = T & { readonly __brand: B };

/** A stable, unique identifier for an instance. */
export type InstanceId = Brand<string, "InstanceId">;

/** A stable, unique identifier for a Java runtime installation. */
export type JavaRuntimeId = Brand<string, "JavaRuntimeId">;

/** Minimal authenticated session state. Never place secrets/tokens here. */
export interface Session {
  /** Whether the user is signed in at all. */
  readonly signedIn: boolean;
  /** Optional stable user identifier (non-secret). */
  readonly userId?: string;
  /** Optional display name (non-secret). */
  readonly displayName?: string;
}

/** A high-level summary of the Minecraft account the user is trying to use. */
export interface MinecraftAccount {
  /** Non-secret identifier (e.g., UUID). */
  readonly id: string;
  /** Display name / in-game name. */
  readonly name: string;
}

/** Result of verifying ownership for Minecraft: Java Edition. */
export interface OwnershipVerification {
  /** Whether ownership is confirmed. */
  readonly ownsMinecraftJava: boolean;
  /** The account that was verified (if known). */
  readonly account?: MinecraftAccount;
  /**
   * Optional human-safe message describing why verification failed.
   * Must not include tokens, cookies, or raw HTTP responses.
   */
  readonly reason?: string;
}

/** Minimal instance information suitable for listing/selecting an instance. */
export interface InstanceInfo {
  readonly id: InstanceId;
  /** Human-facing name (e.g., "Vanilla 1.21 - Survival"). */
  readonly name: string;
  /** Optional game version, if known. */
  readonly minecraftVersion?: string;
  /** Optional modloader identifier, if applicable. */
  readonly modloader?: "vanilla" | "fabric" | "forge" | "neoforge" | "quilt" | string;
}

/** A minimal Java runtime descriptor. */
export interface JavaRuntimeInfo {
  readonly id: JavaRuntimeId;
  /** Java major version (e.g., 17, 21). */
  readonly majorVersion: number;
  /** CPU architecture identifier (e.g., x64, arm64). */
  readonly arch?: string;
  /** OS identifier (e.g., windows, linux). */
  readonly platform?: string;
}

/** Parameters required to launch a specific instance. */
export interface LaunchRequest {
  readonly instanceId: InstanceId;
  /**
   * Optional: prefer a specific runtime (otherwise the launcher chooses).
   * This is only an identifier; core does not access the filesystem here.
   */
  readonly javaRuntimeId?: JavaRuntimeId;
}

/** Outcome of a launch request (no process control yet; that's platform layer). */
export interface LaunchResult {
  /** True when the platform layer successfully started the game. */
  readonly started: boolean;
  /** Optional non-secret process identifier, if applicable. */
  readonly pid?: number;
  /** Optional human-safe failure reason. */
  readonly reason?: string;
}

/** A structured diagnostics payload collected for support/export. */
export interface DiagnosticsBundle {
  /** ISO timestamp when the bundle was collected. */
  readonly collectedAt: string;
  /** Optional app version string. */
  readonly appVersion?: string;
  /** Platform summary (non-secret). */
  readonly environment?: Record<string, string | number | boolean | null>;
  /** Logs captured in-memory (format defined by shared logging contract later). */
  readonly logs?: ReadonlyArray<Record<string, unknown>>;
}


