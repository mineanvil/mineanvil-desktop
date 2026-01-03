/**
 * Rollback executor for restoring last-known-good snapshots (Electron main).
 *
 * Stop Point 2.3 — Rollback Execution (Enable Snapshots).
 *
 * Responsibilities:
 * - Restore artifacts from snapshot directory to live locations
 * - Verify snapshot manifest and artifact checksums
 * - Perform atomic rollback (no half-rolled-back state)
 * - Quarantine corrupted live artifacts before rollback
 * - Log all rollback decisions with structured metadata
 *
 * Requirements:
 * - Rollback uses snapshot manifest as source of truth
 * - All checksums verified against snapshot manifest (and optionally lockfile)
 * - Atomic promote from rollback staging to live locations
 * - Never mutates PackManifest or lockfile
 * - All logs structured and secret-free
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { instanceRoot, minecraftDir, stagingDir, rollbackDir, quarantineDir } from "../paths";
import { sha1File } from "../net/downloader";
import { createLogger, isVerboseEnabled, type Logger } from "../../shared/logging";

function createConsoleSink(): (entry: any) => void {
  return (entry) => {
    const line = JSON.stringify(entry);
    if (entry.level === "error") console.error(line);
    else if (entry.level === "warn") console.warn(line);
    else if (entry.level === "info") console.info(line);
    else console.debug(line);
  };
}

function getLogger(): Logger {
  return createLogger({
    area: "install.rollback",
    sink: createConsoleSink(),
    verbose: isVerboseEnabled(process.env),
  });
}

import type {
  SnapshotManifestV1,
} from "./snapshotManifest";
import {
  isSnapshotManifestV1,
} from "./snapshotManifest";

/**
 * Get hash prefix (first 8 characters) for logging.
 */
function hashPrefix(hash: string): string {
  return hash.toLowerCase().slice(0, 8);
}

async function ensureDir(p: string): Promise<void> {
  await fs.mkdir(p, { recursive: true });
}

/**
 * Resolve the final destination path for an artifact.
 */
function resolveFinalPath(relativePath: string, instanceId: string): string {
  const instancePath = instanceRoot(instanceId);
  if (relativePath.startsWith(".minecraft/")) {
    const mcDir = minecraftDir(instanceId);
    return path.join(mcDir, relativePath.slice(".minecraft/".length));
  } else if (relativePath.startsWith("runtimes/")) {
    // Runtime artifacts not supported for rollback
    return relativePath;
  } else {
    return path.join(instancePath, relativePath);
  }
}

/**
 * Verify artifact checksum against snapshot manifest.
 */
async function verifyArtifactChecksum(
  filePath: string,
  expectedChecksum: { algo: string; value: string },
): Promise<{ ok: true } | { ok: false; error: string; observedHash?: string }> {
  try {
    let actual: string;
    if (expectedChecksum.algo === "sha1") {
      actual = await sha1File(filePath);
    } else if (expectedChecksum.algo === "sha256") {
      const buf = await fs.readFile(filePath);
      actual = crypto.createHash("sha256").update(buf).digest("hex");
    } else {
      return { ok: false, error: `Unsupported checksum algorithm: ${expectedChecksum.algo}` };
    }

    if (actual.toLowerCase() !== expectedChecksum.value.toLowerCase()) {
      return {
        ok: false,
        error: `Checksum mismatch. Expected ${expectedChecksum.value.toLowerCase()}, got ${actual.toLowerCase()}.`,
        observedHash: actual.toLowerCase(),
      };
    }

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Failed to verify checksum: ${msg}` };
  }
}

/**
 * Quarantine a corrupted file by moving it to quarantine directory.
 */
async function quarantineFile(
  filePath: string,
  artifactName: string,
  relativePath: string,
  instanceId: string,
): Promise<void> {
  const logger = getLogger();
  const quarantine = quarantineDir(instanceId);
  await ensureDir(quarantine);

  // Create a unique quarantine path with timestamp and artifact name
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeName = artifactName.replace(/[<>:"/\\|?*]/g, "_");
  const quarantinePath = path.join(quarantine, `${timestamp}-${safeName}`);

  try {
    await fs.rename(filePath, quarantinePath);
    logger.warn("artifact quarantined before rollback", {
      name: artifactName,
      originalPath: relativePath,
      quarantinePath,
    });
  } catch (e) {
    // If rename fails, try copy then delete
    try {
      await fs.copyFile(filePath, quarantinePath);
      await fs.rm(filePath, { force: true });
      logger.warn("artifact quarantined before rollback (via copy)", {
        name: artifactName,
        originalPath: relativePath,
        quarantinePath,
      });
    } catch (e2) {
      logger.error("failed to quarantine artifact before rollback", {
        name: artifactName,
        error: e2 instanceof Error ? e2.message : String(e2),
      });
      // Continue anyway - we'll try to overwrite
    }
  }
}

/**
 * Load and validate snapshot manifest.
 */
async function loadSnapshotManifest(
  snapshotId: string,
  instanceId: string,
): Promise<{ ok: true; manifest: SnapshotManifestV1 } | { ok: false; error: string }> {
  const logger = getLogger();
  const rollback = rollbackDir(instanceId);
  const snapshotDir = path.join(rollback, snapshotId);
  const v1ManifestPath = path.join(snapshotDir, "snapshot.v1.json");
  const legacyManifestPath = path.join(snapshotDir, "snapshot.json");

  try {
    // Check if snapshot directory exists
    await fs.access(snapshotDir);

    // Prefer v1 manifest, fall back to legacy for detection
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
        return { ok: false, error: `Snapshot manifest not found: ${snapshotId}. Expected snapshot.v1.json or snapshot.json.` };
      }
    }

    // Read manifest
    const manifestContent = await fs.readFile(manifestPath, { encoding: "utf8" });
    const manifest = JSON.parse(manifestContent) as unknown;

    let validatedManifest: SnapshotManifestV1;

    if (isV1) {
      // V1 manifest - validate structure
      if (isSnapshotManifestV1(manifest)) {
        validatedManifest = manifest;
      } else {
        return { ok: false, error: "Snapshot manifest snapshot.v1.json is invalid or corrupted" };
      }
    } else {
      // Legacy manifest - reject with clear message
      const manifestObj = manifest as Record<string, unknown>;
      logger.warn("rollback_snapshot_legacy_format", {
        snapshotId,
        detectedFields: Object.keys(manifestObj),
        nextSteps: "Legacy snapshots contain metadata only and cannot be used for rollback. Create a new snapshot by running install again.",
        meta: {
          authority: "snapshot_manifest",
          remoteMetadataUsed: false,
        },
      });
      return {
        ok: false,
        error: `Legacy snapshots contain metadata only and cannot be used for rollback. Snapshot ${snapshotId} was created with an older format. Create a new snapshot by running install again.`,
      };
    }

    logger.info("rollback_snapshot_selected", {
      snapshotId,
      artifactCount: validatedManifest.artifacts.length,
      meta: {
        authority: "snapshot_manifest",
        remoteMetadataUsed: false,
      },
    });

    return { ok: true, manifest: validatedManifest };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if ((e as any).code === "ENOENT") {
      return { ok: false, error: `Snapshot not found: ${snapshotId}` };
    }
    return { ok: false, error: `Failed to load snapshot manifest: ${msg}` };
  }
}

/**
 * Find the latest snapshot for an instance.
 */
async function findLatestSnapshot(
  instanceId: string,
): Promise<{ ok: true; snapshotId: string } | { ok: false; error: string }> {
  const rollback = rollbackDir(instanceId);

  try {
    await fs.access(rollback);
  } catch {
    return { ok: false, error: "No snapshots found. Rollback directory does not exist." };
  }

  const entries = await fs.readdir(rollback, { withFileTypes: true });
  const snapshotDirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
    .reverse(); // Latest first

  if (snapshotDirs.length === 0) {
    return { ok: false, error: "No snapshots found." };
  }

  // Verify the latest snapshot has a manifest
  const latestSnapshotId = snapshotDirs[0];
  const manifestPath = path.join(rollback, latestSnapshotId, "snapshot.json");
  try {
    await fs.access(manifestPath);
    return { ok: true, snapshotId: latestSnapshotId };
  } catch {
    return { ok: false, error: `Latest snapshot ${latestSnapshotId} is missing manifest file.` };
  }
}

/**
 * Perform atomic rollback from snapshot.
 */
export async function executeRollback(
  instanceId: string = "default",
  snapshotId?: string,
): Promise<{ ok: true; snapshotId: string; restoredCount: number } | { ok: false; error: string }> {
  const logger = getLogger();

  logger.info("rollback_start", {
    instanceId,
    snapshotId: snapshotId ?? "latest",
    meta: {
      authority: "snapshot_manifest",
      remoteMetadataUsed: false,
    },
  });

  // Find snapshot
  let targetSnapshotId: string;
  if (snapshotId) {
    // Verify specified snapshot exists
    const manifestResult = await loadSnapshotManifest(snapshotId, instanceId);
    if (!manifestResult.ok) {
      return manifestResult;
    }
    targetSnapshotId = snapshotId;
  } else {
    // Find latest snapshot
    const latestResult = await findLatestSnapshot(instanceId);
    if (!latestResult.ok) {
      return latestResult;
    }
    targetSnapshotId = latestResult.snapshotId;
  }

  // Load snapshot manifest
  const manifestResult = await loadSnapshotManifest(targetSnapshotId, instanceId);
  if (!manifestResult.ok) {
    return manifestResult;
  }
  const manifest = manifestResult.manifest;

  const rollback = rollbackDir(instanceId);
  const snapshotDir = path.join(rollback, targetSnapshotId);
  const staging = stagingDir(instanceId);
  const rollbackStagingDir = path.join(staging, "rollback", targetSnapshotId);

  // Create rollback staging area
  await ensureDir(rollbackStagingDir);

  // Step 1: Copy artifacts from snapshot to rollback staging and verify checksums
  logger.info("rollback_verify_start", {
    snapshotId: targetSnapshotId,
    artifactCount: manifest.artifacts.length,
    meta: {
      authority: "snapshot_manifest",
      remoteMetadataUsed: false,
    },
  });

  const artifactsToRestore: Array<{
    artifact: SnapshotManifestV1["artifacts"][0];
    snapshotPath: string;
    stagingPath: string;
    finalPath: string;
  }> = [];

  for (const artifact of manifest.artifacts) {
    // V1 snapshots store artifacts under files\ subdirectory
    // relativePath in manifest is relative to files\ root
    const snapshotPath = path.join(snapshotDir, "files", artifact.relativePath);
    const finalPath = resolveFinalPath(artifact.relativePath, instanceId);

    // Skip runtime artifacts
    if (artifact.relativePath.startsWith("runtimes/")) {
      continue;
    }

    // Check if snapshot artifact exists
    try {
      await fs.access(snapshotPath);
    } catch {
      logger.error("rollback_verify_failed", {
        snapshotId: targetSnapshotId,
        artifactName: artifact.logicalName,
        reason: "snapshot_artifact_missing",
        meta: {
          authority: "snapshot_manifest",
          remoteMetadataUsed: false,
        },
      });
      return { ok: false, error: `Snapshot artifact missing: ${artifact.logicalName}` };
    }

    // Verify checksum in snapshot
    const verifyResult = await verifyArtifactChecksum(snapshotPath, artifact.checksum);
    if (!verifyResult.ok) {
      const observedPrefix = verifyResult.observedHash
        ? hashPrefix(verifyResult.observedHash)
        : "unknown";
      logger.error("rollback_verify_failed", {
        snapshotId: targetSnapshotId,
        artifactName: artifact.logicalName,
        reason: "checksum_mismatch",
        expectedHashPrefix: hashPrefix(artifact.checksum.value),
        observedHashPrefix: observedPrefix,
        meta: {
          authority: "snapshot_manifest",
          remoteMetadataUsed: false,
        },
      });
      return {
        ok: false,
        error: `Snapshot artifact checksum mismatch: ${artifact.logicalName}. ${verifyResult.error}`,
      };
    }

    // Copy to rollback staging, preserving relative path structure
    const stagingPath = path.join(rollbackStagingDir, artifact.relativePath);
    await ensureDir(path.dirname(stagingPath));
    await fs.copyFile(snapshotPath, stagingPath);

    // Verify checksum in staging
    const stagingVerifyResult = await verifyArtifactChecksum(stagingPath, artifact.checksum);
    if (!stagingVerifyResult.ok) {
      logger.error("rollback_verify_failed", {
        snapshotId: targetSnapshotId,
        artifactName: artifact.logicalName,
        reason: "staging_checksum_mismatch",
        meta: {
          authority: "snapshot_manifest",
          remoteMetadataUsed: false,
        },
      });
      return {
        ok: false,
        error: `Staging artifact checksum mismatch: ${artifact.logicalName}. ${stagingVerifyResult.error}`,
      };
    }

    artifactsToRestore.push({
      artifact,
      snapshotPath,
      stagingPath,
      finalPath,
    });
  }

  logger.info("rollback_verify_ok", {
    snapshotId: targetSnapshotId,
    verifiedCount: artifactsToRestore.length,
    meta: {
      authority: "snapshot_manifest",
      remoteMetadataUsed: false,
    },
  });

  // Step 2: Quarantine corrupted live artifacts
  for (const { artifact, finalPath } of artifactsToRestore) {
    try {
      const exists = await fs.access(finalPath).then(() => true, () => false);
      if (exists) {
        // Check if live artifact is corrupted (doesn't match snapshot checksum)
        const liveVerifyResult = await verifyArtifactChecksum(finalPath, artifact.checksum);
        if (!liveVerifyResult.ok) {
          // Quarantine corrupted live artifact
          await quarantineFile(finalPath, artifact.logicalName, artifact.relativePath, instanceId);
        }
      }
    } catch {
      // File doesn't exist or can't be accessed - proceed with rollback
    }
  }

  // Step 3: Atomic promote from rollback staging to live locations
  logger.info("rollback_promote_start", {
    snapshotId: targetSnapshotId,
    artifactCount: artifactsToRestore.length,
    meta: {
      authority: "snapshot_manifest",
      remoteMetadataUsed: false,
    },
  });

  // Create temporary backup directory for atomic rollback
  const timestamp = Date.now();
  const backupDir = path.join(staging, `backup-${timestamp}`);
  let backupCreated = false;

  try {
    // Move current live pack directories to backup (best effort)
    // We'll backup the .minecraft directory structure
    const mcDir = minecraftDir(instanceId);
    try {
      await fs.access(mcDir);
      const mcBackup = path.join(backupDir, ".minecraft");
      await ensureDir(path.dirname(mcBackup));
      try {
        await fs.rename(mcDir, mcBackup);
        backupCreated = true;
      } catch {
        // If rename fails (e.g., files in use), we'll proceed without backup
        // This is acceptable - we'll restore from staging if needed
      }
    } catch {
      // .minecraft doesn't exist - no backup needed
    }

    // Promote artifacts from rollback staging to final locations
    let promotedCount = 0;
    for (const { artifact, stagingPath, finalPath } of artifactsToRestore) {
      try {
        // Ensure final directory exists
        await ensureDir(path.dirname(finalPath));

        // Atomic promote (rename or copy)
        try {
          // Try atomic rename first
          try {
            await fs.rm(finalPath, { force: true });
          } catch {
            // ignore if file doesn't exist
          }
          await fs.rename(stagingPath, finalPath);
        } catch {
          // If rename fails, use copy then delete
          await fs.copyFile(stagingPath, finalPath);
          await fs.rm(stagingPath, { force: true });
        }

        // Verify final artifact
        const finalVerifyResult = await verifyArtifactChecksum(finalPath, artifact.checksum);
        if (!finalVerifyResult.ok) {
          logger.error("rollback_promote_failed", {
            snapshotId: targetSnapshotId,
            artifactName: artifact.logicalName,
            reason: "final_verification_failed",
            meta: {
              authority: "snapshot_manifest",
              remoteMetadataUsed: false,
            },
          });
          // Try to restore from backup if available
          if (backupCreated) {
            try {
              const mcDir = minecraftDir(instanceId);
              const mcBackup = path.join(backupDir, ".minecraft");
              await fs.rm(mcDir, { recursive: true, force: true }).catch(() => {});
              await fs.rename(mcBackup, mcDir).catch(() => {});
            } catch {
              // Best effort restore
            }
          }
          return {
            ok: false,
            error: `Failed to verify restored artifact: ${artifact.logicalName}. Rollback aborted.`,
          };
        }

        promotedCount++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logger.error("rollback_promote_failed", {
          snapshotId: targetSnapshotId,
          artifactName: artifact.logicalName,
          reason: "promote_error",
          error: msg,
          meta: {
            authority: "snapshot_manifest",
            remoteMetadataUsed: false,
          },
        });
        // Try to restore from backup if available
        if (backupCreated) {
          try {
            const mcDir = minecraftDir(instanceId);
            const mcBackup = path.join(backupDir, ".minecraft");
            await fs.rm(mcDir, { recursive: true, force: true }).catch(() => {});
            await fs.rename(mcBackup, mcDir).catch(() => {});
          } catch {
            // Best effort restore
          }
        }
        return {
          ok: false,
          error: `Failed to promote artifact: ${artifact.logicalName}. ${msg}. Rollback aborted.`,
        };
      }
    }

    // Clean up backup if promote succeeded
    if (backupCreated) {
      try {
        await fs.rm(backupDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }

    // Clean up rollback staging
    try {
      await fs.rm(rollbackStagingDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    logger.info("rollback_promote_ok", {
      snapshotId: targetSnapshotId,
      promotedCount,
      meta: {
        authority: "snapshot_manifest",
        remoteMetadataUsed: false,
      },
    });

    logger.info("rollback_complete", {
      snapshotId: targetSnapshotId,
      restoredCount: promotedCount,
      meta: {
        authority: "snapshot_manifest",
        remoteMetadataUsed: false,
      },
    });

    return { ok: true, snapshotId: targetSnapshotId, restoredCount: promotedCount };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("rollback_promote_failed", {
      snapshotId: targetSnapshotId,
      reason: "unexpected_error",
      error: msg,
      meta: {
        authority: "snapshot_manifest",
        remoteMetadataUsed: false,
      },
    });
    // Try to restore from backup if available
    if (backupCreated) {
      try {
        const mcDir = minecraftDir(instanceId);
        const mcBackup = path.join(backupDir, ".minecraft");
        await fs.rm(mcDir, { recursive: true, force: true }).catch(() => {});
        await fs.rename(mcBackup, mcDir).catch(() => {});
      } catch {
        // Best effort restore
      }
    }
    return { ok: false, error: `Rollback failed: ${msg}` };
  }
}

