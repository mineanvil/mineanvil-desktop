import type { OwnershipVerification } from "../types";

/**
 * OwnershipService
 *
 * Responsibility:
 * - Verify that the signed-in user owns Minecraft: Java Edition.
 *
 * Notes:
 * - The concrete implementation will live outside core (platform layer) and may
 *   call network APIs, caches, etc.
 * - Core only models the contract and expected result shape.
 */
export interface OwnershipService {
  verifyMinecraftJavaOwnership(): Promise<OwnershipVerification>;
}



