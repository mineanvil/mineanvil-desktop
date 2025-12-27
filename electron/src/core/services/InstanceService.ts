import type { InstanceId, InstanceInfo } from "../types";

/**
 * InstanceService
 *
 * Responsibility:
 * - Ensure a playable instance exists for the user (create or repair as needed).
 * - List known instances for selection in the UI.
 *
 * Important:
 * - "Instance" refers to a launchable game directory/configuration.
 * - No filesystem access in core; implementation decides where/how to store.
 */
export interface InstanceService {
  /**
   * Ensure an instance exists and is ready for launch.
   * The implementation may create a default instance when none exists.
   */
  ensureInstance(): Promise<InstanceInfo>;

  /** Enumerate all known instances. */
  listInstances(): Promise<InstanceInfo[]>;

  /** Optional helper to fetch details for a specific instance. */
  getInstance?(id: InstanceId): Promise<InstanceInfo | null>;
}


