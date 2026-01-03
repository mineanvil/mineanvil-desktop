#!/usr/bin/env node
/**
 * Validate a snapshot manifest for rollback compatibility.
 *
 * Exit codes:
 * - 0: Snapshot is valid for rollback
 * - 1: Snapshot is invalid or cannot be used for rollback
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
  console.error("Usage: node scripts/validation/validate-snapshot.ts <snapshotId> [instanceId]");
  console.error("");
  console.error("Validates a snapshot manifest for rollback compatibility.");
  console.error("Exit code 0 if valid, 1 if invalid.");
  process.exit(1);
}

const snapshotId = args[0];
const instanceId = args[1] ?? "default";

/**
 * Type guard for v1 snapshot manifest.
 */
function isSnapshotManifestV1(value: any): boolean {
  if (typeof value !== "object" || value === null) return false;

  return (
    value.version === 1 &&
    typeof value.snapshotId === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.minecraftVersion === "string" &&
    value.authority === "lockfile" &&
    typeof value.artifactCount === "number" &&
    Array.isArray(value.artifacts) &&
    value.artifacts.every((a: any) =>
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
 * Check if manifest is legacy format (missing version field).
 */
function isLegacySnapshotManifest(value: any): boolean {
  if (typeof value !== "object" || value === null) return false;
  return value.version === undefined || value.version === null;
}

/**
 * Attempt to convert legacy manifest to v1 format.
 */
function convertLegacyToV1(legacy: any, snapshotId: string): any | null {
  // Must have artifacts array
  if (!Array.isArray(legacy.artifacts) || legacy.artifacts.length === 0) {
    return null;
  }

  const convertedArtifacts: any[] = [];

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

async function main() {
  // Resolve paths
  const appData = process.env.APPDATA || (process.platform === "win32" ? "" : "");
  if (!appData) {
    console.error("APPDATA environment variable not set");
    process.exit(1);
  }

  const rollbackDir = path.join(appData, "MineAnvil", "instances", instanceId, ".rollback");
  const snapshotDir = path.join(rollbackDir, snapshotId);
  const v1ManifestPath = path.join(snapshotDir, "snapshot.v1.json");
  const legacyManifestPath = path.join(snapshotDir, "snapshot.json");

  try {
    // Check if snapshot directory exists
    await fs.access(snapshotDir);

    // Prefer v1 manifest, check legacy for detection
    let manifestPath: string;
    let isV1 = false;
    try {
      await fs.access(v1ManifestPath);
      manifestPath = v1ManifestPath;
      isV1 = true;
    } catch {
      // Check if legacy manifest exists
      try {
        await fs.access(legacyManifestPath);
        manifestPath = legacyManifestPath;
        isV1 = false;
      } catch {
        console.error(`Snapshot manifest not found: ${snapshotId}. Expected snapshot.v1.json or snapshot.json.`);
        process.exit(1);
      }
    }

    // Read manifest
    const manifestContent = await fs.readFile(manifestPath, { encoding: "utf8" });
    const manifest = JSON.parse(manifestContent);

    if (isV1) {
      // V1 manifest - validate structure
      if (isSnapshotManifestV1(manifest)) {
        console.log(`Snapshot ${snapshotId} is valid (v1 format with materialized files)`);
        process.exit(0);
      } else {
        console.error(`Snapshot ${snapshotId} manifest snapshot.v1.json is invalid or corrupted`);
        process.exit(1);
      }
    } else {
      // Legacy manifest - reject
      console.error(`Snapshot ${snapshotId} is a legacy snapshot (metadata only)`);
      console.error("Legacy snapshots contain metadata only and cannot be used for rollback.");
      console.error("Create a new snapshot by running install again.");
      process.exit(1);
    }
  } catch (e: any) {
    if (e.code === "ENOENT") {
      console.error(`Snapshot not found: ${snapshotId}`);
      process.exit(1);
    }
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`Failed to validate snapshot: ${msg}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Unexpected error:", e);
  process.exit(1);
});
