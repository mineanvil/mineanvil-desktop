import type { DiagnosticsBundle } from "../types";

/**
 * DiagnosticsService
 *
 * Responsibility:
 * - Collect non-sensitive diagnostics useful for support (env summary, recent logs, etc.).
 * - Export the collected diagnostics as an opaque byte payload (e.g., zip file).
 *
 * Constraints:
 * - No filesystem access in core; export is returned as bytes to be persisted elsewhere.
 * - Must not include secrets (tokens, cookies, auth headers, etc.).
 */
export interface DiagnosticsService {
  /** Collect a snapshot of diagnostics. */
  collect(): Promise<DiagnosticsBundle>;

  /**
   * Export a bundle into an opaque byte array (format determined by implementation).
   * The platform layer can then save/share these bytes.
   */
  exportBundle(bundle: DiagnosticsBundle): Promise<Uint8Array>;
}



