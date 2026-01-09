/**
 * Pack Lockfile structure (Electron main).
 *
 * Stop Point 2.2 — Deterministic Install (Hardening).
 *
 * The lockfile is an immutable, complete list of all artefacts required for
 * a deterministic installation. It pins URLs, checksums, and paths for all
 * vanilla Minecraft artefacts needed on Windows.
 *
 * Requirements:
 * - Lockfile is immutable once written
 * - Contains complete list of all required artefacts
 * - All checksums are declared in the lockfile
 * - No remote metadata is used for verification once lockfile exists
 */

export type ArtifactKind =
  | "version_json"
  | "client_jar"
  | "asset_index"
  | "asset"
  | "library"
  | "native"
  | "runtime";

export type ChecksumAlgo = "sha1" | "sha256";

export interface ArtifactChecksum {
  readonly algo: ChecksumAlgo;
  readonly value: string; // hex lowercase
}

export interface PackLockfileArtifact {
  /**
   * Stable identifier for this artefact (e.g., "minecraft-client-1.21.4").
   */
  readonly name: string;

  /**
   * Kind of artefact.
   */
  readonly kind: ArtifactKind;

  /**
   * Download URL (if applicable).
   */
  readonly url: string;

  /**
   * Relative path from instance root (for Minecraft files) or runtime root (for runtime).
   * Examples:
   * - ".minecraft/versions/1.21.4/1.21.4.json"
   * - ".minecraft/libraries/com/mojang/patchy/1.3.9/patchy-1.3.9.jar"
   * - "runtimes/temurin/21/win-x64/bin/java.exe" (for runtime)
   */
  readonly path: string;

  /**
   * Checksum for verification.
   */
  readonly checksum: ArtifactChecksum;

  /**
   * File size in bytes (optional but recommended).
   */
  readonly size?: number;
}

export interface PackLockfileV1 {
  /**
   * Lockfile schema version. Always "1" for PackLockfile v1.
   */
  readonly schemaVersion: "1";

  /**
   * Pack identifier (from manifest, null if not set).
   */
  readonly packId: string | null;

  /**
   * Pack version (from manifest, null if not set).
   */
  readonly packVersion: string | null;

  /**
   * Minecraft version this lockfile is for.
   */
  readonly minecraftVersion: string;

  /**
   * ISO timestamp when this lockfile was generated.
   */
  readonly generatedAt: string;

  /**
   * Complete list of all artefacts required for installation.
   */
  readonly artifacts: readonly PackLockfileArtifact[];
}

/**
 * Type guard to validate a PackLockfile v1 structure.
 */
export function isPackLockfileV1(value: unknown): value is PackLockfileV1 {
  if (typeof value !== "object" || value === null) return false;

  const lf = value as Record<string, unknown>;

  if (lf.schemaVersion !== "1" || typeof lf.minecraftVersion !== "string" || typeof lf.generatedAt !== "string") {
    return false;
  }

  if (
    (lf.packId !== null && typeof lf.packId !== "string") ||
    (lf.packVersion !== null && typeof lf.packVersion !== "string")
  ) {
    return false;
  }

  if (!Array.isArray(lf.artifacts)) return false;

  for (const art of lf.artifacts) {
    if (
      typeof art !== "object" ||
      art === null ||
      typeof art.name !== "string" ||
      typeof art.kind !== "string" ||
      typeof art.url !== "string" ||
      typeof art.path !== "string" ||
      typeof art.checksum !== "object" ||
      art.checksum === null ||
      typeof art.checksum.algo !== "string" ||
      typeof art.checksum.value !== "string"
    ) {
      return false;
    }

    const validKinds: ArtifactKind[] = [
      "version_json",
      "client_jar",
      "asset_index",
      "asset",
      "library",
      "native",
      "runtime",
    ];
    if (!validKinds.includes(art.kind)) return false;

    const validAlgos: ChecksumAlgo[] = ["sha1", "sha256"];
    if (!validAlgos.includes(art.checksum.algo)) return false;

    if (art.size !== undefined && typeof art.size !== "number") return false;
  }

  return true;
}





