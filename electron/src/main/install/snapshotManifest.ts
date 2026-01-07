/**
 * Snapshot manifest structure (Electron main).
 *
 * Stop Point 2.3 — Rollback & Recovery.
 *
 * Defines the authoritative schema for snapshot manifests used for rollback.
 * Version 1 is the current format.
 */

export interface SnapshotManifestArtifact {
  logicalName: string;
  relativePath: string;
  checksum: {
    algo: "sha1" | "sha256";
    value: string;
  };
  size: number;
}

export interface SnapshotManifestV1 {
  version: 1;
  snapshotId: string;
  createdAt: string;
  minecraftVersion: string;
  authority: "lockfile";
  artifactCount: number;
  artifacts: SnapshotManifestArtifact[];
}

export type SnapshotManifest = SnapshotManifestV1;

/**
 * Type guard to validate a SnapshotManifest v1 structure.
 */
export function isSnapshotManifestV1(value: unknown): value is SnapshotManifestV1 {
  if (typeof value !== "object" || value === null) return false;

  const m = value as any;

  return (
    m.version === 1 &&
    typeof m.snapshotId === "string" &&
    typeof m.createdAt === "string" &&
    typeof m.minecraftVersion === "string" &&
    m.authority === "lockfile" &&
    typeof m.artifactCount === "number" &&
    Array.isArray(m.artifacts) &&
    m.artifacts.every((a: any) =>
      typeof a === "object" &&
      a !== null &&
      typeof a.logicalName === "string" &&
      typeof a.relativePath === "string" &&
      typeof a.checksum === "object" &&
      a.checksum !== null &&
      (a.checksum.algo === "sha1" || a.checksum.algo === "sha256") &&
      typeof a.checksum.value === "string" &&
      typeof a.size === "number"
    )
  );
}

/**
 * Legacy snapshot manifest (without version field).
 * Used for backward compatibility.
 */
export interface LegacySnapshotManifest {
  snapshotId?: string;
  createdAt?: string;
  minecraftVersion?: string;
  authority?: string | null;
  artifactCount?: number;
  artifacts?: Array<{
    name?: string;
    logicalName?: string;
    path?: string;
    relativePath?: string;
    checksum?: {
      algo?: string;
      value?: string;
    };
    size?: number;
  }>;
}

/**
 * Check if a manifest is a legacy format (missing version field).
 */
export function isLegacySnapshotManifest(value: unknown): value is LegacySnapshotManifest {
  if (typeof value !== "object" || value === null) return false;
  const m = value as any;
  return m.version === undefined || m.version === null;
}

/**
 * Attempt to convert a legacy manifest to v1 format.
 * Returns null if conversion is not possible.
 */
export function convertLegacyToV1(
  legacy: LegacySnapshotManifest,
  snapshotId: string,
): SnapshotManifestV1 | null {
  // Must have artifacts array
  if (!Array.isArray(legacy.artifacts) || legacy.artifacts.length === 0) {
    return null;
  }

  const convertedArtifacts: SnapshotManifestArtifact[] = [];

  for (const artifact of legacy.artifacts) {
    // Need at least logicalName/name and relativePath/path
    const logicalName = artifact.logicalName ?? artifact.name;
    const relativePath = artifact.relativePath ?? artifact.path;

    if (!logicalName || !relativePath) {
      continue; // Skip invalid artifacts
    }

    // Need checksum
    if (!artifact.checksum || !artifact.checksum.algo || !artifact.checksum.value) {
      continue; // Skip artifacts without checksum
    }

    const algo = artifact.checksum.algo === "sha256" ? "sha256" : "sha1";

    convertedArtifacts.push({
      logicalName,
      relativePath,
      checksum: {
        algo,
        value: artifact.checksum.value,
      },
      size: artifact.size ?? 0, // Default to 0 if missing
    });
  }

  if (convertedArtifacts.length === 0) {
    return null; // No valid artifacts
  }

  return {
    version: 1,
    snapshotId: legacy.snapshotId ?? snapshotId,
    createdAt: legacy.createdAt ?? new Date().toISOString(),
    minecraftVersion: legacy.minecraftVersion ?? "unknown",
    authority: "lockfile",
    artifactCount: convertedArtifacts.length,
    artifacts: convertedArtifacts,
  };
}


