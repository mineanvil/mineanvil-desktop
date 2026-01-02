/**
 * Pack Manifest v1 structure (Electron main).
 *
 * Stop Point 2.1 — Pack Manifest.
 * Stop Point 2.2 — Deterministic Install.
 *
 * The Pack Manifest is the authoritative source of truth for a managed
 * Minecraft Java environment. It is declarative and immutable once written.
 *
 * Requirements:
 * - Manifest must be declarative, not imperative
 * - Manifest is treated as immutable once written for this stop point
 * - Manifest contents are stable across repeated runs on the same machine
 */

import type { RuntimeManifest } from "../runtime/managedRuntime";

export type PackManifestV1 = {
  /**
   * Manifest format version. Always "1" for PackManifest v1.
   */
  manifestVersion: "1";

  /**
   * ISO timestamp when this manifest was first created.
   * This value is stable across runs on the same machine.
   */
  createdAt: string;

  /**
   * Instance identifier this manifest belongs to.
   */
  instanceId: string;

  /**
   * Pack identifier (null until pack installation is implemented).
   * Reserved for future use in Layer 2.
   */
  packId: string | null;

  /**
   * Pack version (null until pack installation is implemented).
   * Reserved for future use in Layer 2.
   */
  packVersion: string | null;

  /**
   * Minecraft version to install (required for deterministic installation).
   * Must be a specific version ID (e.g., "1.21.4"), not "latest".
   * If missing, deterministic installation will fail with a clear error.
   */
  minecraftVersion?: string;

  /**
   * Java runtime manifest for deterministic installation.
   * If missing, uses DEFAULT_RUNTIME_MANIFEST as fallback.
   * If present, must include valid downloadUrl and sha256.
   */
  javaRuntime?: RuntimeManifest;
};

/**
 * Type guard to validate a PackManifest v1 structure.
 */
export function isPackManifestV1(value: unknown): value is PackManifestV1 {
  if (typeof value !== "object" || value === null) return false;

  const m = value as Record<string, unknown>;

  if (
    m.manifestVersion !== "1" ||
    typeof m.createdAt !== "string" ||
    typeof m.instanceId !== "string" ||
    (m.packId !== null && typeof m.packId !== "string") ||
    (m.packVersion !== null && typeof m.packVersion !== "string")
  ) {
    return false;
  }

  // Validate optional minecraftVersion
  if (m.minecraftVersion !== undefined && typeof m.minecraftVersion !== "string") {
    return false;
  }

  // Validate optional javaRuntime
  if (m.javaRuntime !== undefined) {
    const rt = m.javaRuntime as Record<string, unknown>;
    if (
      typeof rt !== "object" ||
      rt === null ||
      typeof rt.vendor !== "string" ||
      typeof rt.version !== "string" ||
      rt.platform !== "win-x64" ||
      typeof rt.downloadUrl !== "string" ||
      typeof rt.sha256 !== "string" ||
      rt.archiveType !== "zip" ||
      typeof rt.javaRelativePath !== "string"
    ) {
      return false;
    }
  }

  return true;
}

