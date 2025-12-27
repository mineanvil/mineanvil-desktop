import type { JavaRuntimeInfo } from "../types";

/**
 * RuntimeService
 *
 * Responsibility:
 * - Ensure a compatible Java runtime is available for launching Minecraft.
 *
 * Notes:
 * - Implementations may download/install runtimes, validate versions, etc.
 * - Core only defines the contract and minimal runtime description.
 */
export interface RuntimeService {
  /** Ensure a suitable Java runtime exists and return its descriptor. */
  ensureJavaRuntime(): Promise<JavaRuntimeInfo>;
}


