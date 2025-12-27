import type { LaunchRequest, LaunchResult } from "../types";

/**
 * LaunchService
 *
 * Responsibility:
 * - Coordinate launching a selected instance using a compatible runtime.
 *
 * Notes:
 * - Actual process spawning is platform-specific and must not occur in core.
 * - This interface models intent + outcome only.
 */
export interface LaunchService {
  launch(request: LaunchRequest): Promise<LaunchResult>;
}


