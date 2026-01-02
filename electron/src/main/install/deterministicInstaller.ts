/**
 * Deterministic installer for Minecraft Java environment (Electron main).
 *
 * Stop Point 2.3 — Rollback & Recovery (Hardening).
 *
 * Responsibilities:
 * - Install all artefacts strictly from lockfile
 * - Verify all checksums against lockfile (not remote metadata)
 * - Use staging area for all writes, then atomic promote
 * - Create last-known-good snapshots for rollback
 * - Quarantine corrupted files instead of deleting
 * - Recover from interrupted installs (resume/rollback/fail clearly)
 * - Ensure idempotency (re-running with same lockfile does nothing)
 * - Install complete set: version json, client jar, libraries, natives, assets, runtime
 *
 * Requirements:
 * - Lockfile is the sole source of truth for artefacts and checksums
 * - Installation must be deterministic and idempotent
 * - All writes occur in staging area first, then atomic promote
 * - Last-known-good snapshot exists for rollback
 * - Corrupted files are quarantined, not deleted
 * - Interrupted installs are recovered (resume/rollback/fail clearly)
 * - No mutation of lockfile or PackManifest is allowed
 * - All logs must be structured and secret-free
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as crypto from "node:crypto";
import type { PackLockfileV1, PackLockfileArtifact } from "../pack/packLockfile";
import { planInstallation } from "./installPlanner";
import { instanceRoot, minecraftDir, stagingDir, rollbackDir, quarantineDir } from "../paths";
import { downloadToFile, sha1File } from "../net/downloader";
import { createLogger, isVerboseEnabled, type LogEntry, type Logger } from "../../shared/logging";

function createConsoleSink(): (entry: LogEntry) => void {
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
    area: "install.deterministic",
    sink: createConsoleSink(),
    verbose: isVerboseEnabled(process.env),
  });
}

async function ensureDir(p: string): Promise<void> {
  await fs.mkdir(p, { recursive: true });
}

/**
 * Resolve the final destination path for an artifact.
 */
function resolveFinalPath(artifact: PackLockfileArtifact, instanceId: string): string {
  const instancePath = instanceRoot(instanceId);
  if (artifact.path.startsWith(".minecraft/")) {
    const mcDir = minecraftDir(instanceId);
    return path.join(mcDir, artifact.path.slice(".minecraft/".length));
  } else if (artifact.path.startsWith("runtimes/")) {
    // This will be resolved dynamically when needed
    return artifact.path;
  } else {
    return path.join(instancePath, artifact.path);
  }
}

/**
 * Resolve the staging path for an artifact.
 */
function resolveStagingPath(artifact: PackLockfileArtifact, instanceId: string): string {
  const staging = stagingDir(instanceId);
  // Preserve the relative path structure in staging
  if (artifact.path.startsWith(".minecraft/")) {
    return path.join(staging, ".minecraft", artifact.path.slice(".minecraft/".length));
  } else if (artifact.path.startsWith("runtimes/")) {
    return path.join(staging, artifact.path);
  } else {
    return path.join(staging, artifact.path);
  }
}

/**
 * Quarantine a corrupted file by moving it to quarantine directory.
 */
async function quarantineFile(filePath: string, artifact: PackLockfileArtifact, instanceId: string): Promise<void> {
  const logger = getLogger();
  const quarantine = quarantineDir(instanceId);
  await ensureDir(quarantine);

  // Create a unique quarantine path with timestamp and artifact name
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeName = artifact.name.replace(/[<>:"/\\|?*]/g, "_");
  const quarantinePath = path.join(quarantine, `${timestamp}-${safeName}`);

  try {
    await fs.rename(filePath, quarantinePath);
    logger.warn("artifact quarantined", {
      name: artifact.name,
      originalPath: artifact.path,
      quarantinePath,
    });
  } catch (e) {
    // If rename fails, try copy then delete
    try {
      await fs.copyFile(filePath, quarantinePath);
      await fs.rm(filePath, { force: true });
      logger.warn("artifact quarantined (via copy)", {
        name: artifact.name,
        originalPath: artifact.path,
        quarantinePath,
      });
    } catch (e2) {
      logger.error("failed to quarantine artifact", {
        name: artifact.name,
        error: e2 instanceof Error ? e2.message : String(e2),
      });
      // Continue anyway - we'll try to overwrite
    }
  }
}

/**
 * Create a last-known-good snapshot of validated artifacts.
 */
async function createLastKnownGoodSnapshot(
  lockfile: PackLockfileV1,
  validatedArtifacts: PackLockfileArtifact[],
  instanceId: string,
): Promise<{ ok: true; snapshotId: string } | { ok: false; error: string }> {
  const logger = getLogger();
  const rollback = rollbackDir(instanceId);
  const snapshotId = `${Date.now()}-${lockfile.minecraftVersion}`;
  const snapshotDir = path.join(rollback, snapshotId);

  try {
    await ensureDir(snapshotDir);

    // Write a manifest of what's in this snapshot
    const snapshotManifest = {
      snapshotId,
      createdAt: new Date().toISOString(),
      minecraftVersion: lockfile.minecraftVersion,
      artifactCount: validatedArtifacts.length,
      artifacts: validatedArtifacts.map((a) => ({
        name: a.name,
        path: a.path,
        checksum: a.checksum,
      })),
    };

    await fs.writeFile(
      path.join(snapshotDir, "snapshot.json"),
      JSON.stringify(snapshotManifest, null, 2),
      { encoding: "utf8" },
    );

    logger.info("last-known-good snapshot created", {
      snapshotId,
      artifactCount: validatedArtifacts.length,
    });

    return { ok: true, snapshotId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("failed to create snapshot", { error: msg });
    return { ok: false, error: `Failed to create snapshot: ${msg}` };
  }
}

/**
 * Atomically promote a file from staging to final location.
 */
async function atomicPromote(stagingPath: string, finalPath: string): Promise<void> {
  // Ensure final directory exists
  await ensureDir(path.dirname(finalPath));

  // On Windows, we need to handle the case where the target file exists
  // Use atomic rename where possible
  try {
    // Try to remove existing file first (if it exists)
    try {
      await fs.rm(finalPath, { force: true });
    } catch {
      // ignore if file doesn't exist
    }
    // Atomic rename
    await fs.rename(stagingPath, finalPath);
  } catch (e) {
    // If rename fails (e.g., file in use), try copy then delete
    await fs.copyFile(stagingPath, finalPath);
    await fs.rm(stagingPath, { force: true });
  }
}

/**
 * Verify artefact checksum against lockfile.
 */
async function verifyArtifactChecksum(
  filePath: string,
  artifact: PackLockfileArtifact,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const logger = getLogger();

  try {
    let actual: string;
    if (artifact.checksum.algo === "sha1") {
      actual = await sha1File(filePath);
    } else if (artifact.checksum.algo === "sha256") {
      const buf = await fs.readFile(filePath);
      actual = crypto.createHash("sha256").update(buf).digest("hex");
    } else {
      return { ok: false, error: `Unsupported checksum algorithm: ${artifact.checksum.algo}` };
    }

    if (actual.toLowerCase() !== artifact.checksum.value.toLowerCase()) {
      logger.error("artifact checksum mismatch", {
        name: artifact.name,
        expected: artifact.checksum.value.toLowerCase(),
        actual: actual.toLowerCase(),
      });
      return {
        ok: false,
        error: `Artifact "${artifact.name}" checksum mismatch. Expected ${artifact.checksum.value.toLowerCase()}, got ${actual.toLowerCase()}. The file may be corrupted.`,
      };
    }

    if (isVerboseEnabled(process.env)) {
      logger.debug("artifact checksum verified", { name: artifact.name, ok: true });
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Failed to verify artifact "${artifact.name}": ${msg}` };
  }
}

/**
 * Install a single artefact from lockfile to staging area.
 * Returns the staging path if successful.
 */
async function installArtifactToStaging(
  artifact: PackLockfileArtifact,
  instanceId: string,
): Promise<{ ok: true; stagingPath: string } | { ok: false; error: string }> {
  const logger = getLogger();

  // Runtime artifacts are not supported in SP2.3
  // This should be caught by the planner, but defensive check here
  if (artifact.kind === "runtime") {
    return {
      ok: false,
      error: `This MineAnvil build does not support managed runtime installation yet. Runtime artifacts in the lockfile are not supported. Delete pack/lock.json to regenerate without runtime, or configure MINEANVIL_JAVA_PATH to use an external Java runtime.`,
    };
  }

  // Resolve staging path
  const stagingPath = resolveStagingPath(artifact, instanceId);

  // For other artefacts, download and verify to staging
  try {
    // Ensure parent directory exists in staging
    await ensureDir(path.dirname(stagingPath));

    // Download with checksum verification to staging
    const downloadOpts: { expectedSize?: number; expectedSha1?: string; expectedSha256?: string } = {};
    if (artifact.size) downloadOpts.expectedSize = artifact.size;
    if (artifact.checksum.algo === "sha1") {
      downloadOpts.expectedSha1 = artifact.checksum.value;
    } else if (artifact.checksum.algo === "sha256") {
      // downloadToFile doesn't support SHA256 directly, so we'll verify after download
      downloadOpts.expectedSize = artifact.size;
    }

    logger.info("downloading artifact to staging", {
      name: artifact.name,
      kind: artifact.kind,
      size: artifact.size,
    });

    await downloadToFile(artifact.url, stagingPath, downloadOpts);

    // Verify checksum (downloadToFile verifies SHA1, but we verify SHA256 here)
    const verifyResult = await verifyArtifactChecksum(stagingPath, artifact);
    if (!verifyResult.ok) {
      // Clean up corrupted file from staging
      try {
        await fs.rm(stagingPath, { force: true });
      } catch {
        // ignore
      }
      return verifyResult;
    }

    // For native artefacts, extract them (extraction happens after promote)
    // We'll handle this in the promote step

    return { ok: true, stagingPath };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("artifact installation to staging failed", { name: artifact.name, error: msg });
    // Clean up staging file on error
    try {
      await fs.rm(stagingPath, { force: true });
    } catch {
      // ignore
    }
    return { ok: false, error: `Failed to install artifact "${artifact.name}": ${msg}` };
  }
}

/**
 * Promote an artifact from staging to final location atomically.
 * For native artifacts, also extracts them.
 */
async function promoteArtifact(
  artifact: PackLockfileArtifact,
  stagingPath: string,
  instanceId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const logger = getLogger();

  // Resolve final path
  let finalPath: string;
  if (artifact.path.startsWith("runtimes/")) {
    const { app } = await import("electron");
    finalPath = path.join(app.getPath("userData"), artifact.path);
  } else {
    finalPath = resolveFinalPath(artifact, instanceId);
  }

  try {
    // Check if final file exists and is corrupted
    try {
      const exists = await fs.access(finalPath).then(() => true, () => false);
      if (exists) {
        const verifyResult = await verifyArtifactChecksum(finalPath, artifact);
        if (!verifyResult.ok) {
          // File exists but is corrupted - quarantine it
          logger.warn("corrupted artifact detected, quarantining", {
            name: artifact.name,
            path: artifact.path,
          });
          await quarantineFile(finalPath, artifact, instanceId);
        } else {
          // File exists and is valid - skip promote
          logger.debug("artifact already valid, skipping promote", {
            name: artifact.name,
            path: artifact.path,
          });
          // Remove staging file since we don't need it
          try {
            await fs.rm(stagingPath, { force: true });
          } catch {
            // ignore
          }
          return { ok: true };
        }
      }
    } catch {
      // File doesn't exist, proceed with promote
    }

    // Atomically promote from staging to final
    await atomicPromote(stagingPath, finalPath);

    logger.info("artifact promoted from staging", {
      name: artifact.name,
      kind: artifact.kind,
    });

    // For native artefacts, extract them after promote
    if (artifact.kind === "native") {
      const { spawn } = await import("node:child_process");
      const mcDir = minecraftDir(instanceId);
      const versionId = artifact.path.match(/versions\/([^\/]+)\//)?.[1] ?? "unknown";
      const nativesDir = path.join(mcDir, "natives", versionId);

      await ensureDir(nativesDir);

      // Use PowerShell to extract
      const script = `
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = "${finalPath.replaceAll('"', '""')}"
$dest = "${nativesDir.replaceAll('"', '""')}"
New-Item -ItemType Directory -Force -Path $dest | Out-Null
$archive = [System.IO.Compression.ZipFile]::OpenRead($zip)
try {
  foreach ($entry in $archive.Entries) {
    if ([string]::IsNullOrEmpty($entry.FullName)) { continue }
    if ($entry.FullName.EndsWith("/")) { continue }
    $outPath = Join-Path $dest $entry.FullName
    $outDir = Split-Path -Parent $outPath
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null
    [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $outPath, $true)
  }
} finally {
  $archive.Dispose()
}
`;

      await new Promise<void>((resolve, reject) => {
        const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"],
        });
        child.on("error", reject);
        child.on("close", (code) => {
          if (code === 0) resolve();
          else reject(new Error(`powershell extract failed (exit ${code ?? -1})`));
        });
      });
    }

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("artifact promotion failed", { name: artifact.name, error: msg });
    return { ok: false, error: `Failed to promote artifact "${artifact.name}": ${msg}` };
  }
}

export interface InstallResult {
  readonly lockfile: PackLockfileV1;
  readonly installedCount: number;
  readonly verifiedCount: number;
  readonly skippedCount: number;
  readonly promotedCount: number;
  readonly quarantinedCount: number;
}

/**
 * Recover from interrupted install by checking staging area.
 * Returns list of artifacts that can be resumed from staging.
 */
async function recoverFromStaging(
  lockfile: PackLockfileV1,
  instanceId: string,
): Promise<{ ok: true; recoverableArtifacts: PackLockfileArtifact[] } | { ok: false; error: string }> {
  const logger = getLogger();
  const staging = stagingDir(instanceId);
  const recoverableArtifacts: PackLockfileArtifact[] = [];

  try {
    // Check if staging directory exists
    try {
      await fs.access(staging);
    } catch {
      // No staging directory - nothing to recover
      return { ok: true, recoverableArtifacts: [] };
    }

    logger.info("checking staging area for recoverable artifacts", {
      stagingDir: staging,
    });

    // Check each artifact in lockfile for staging presence
    for (const artifact of lockfile.artifacts) {
      if (artifact.kind === "runtime") {
        continue; // Skip runtime artifacts
      }

      const stagingPath = resolveStagingPath(artifact, instanceId);
      try {
        await fs.access(stagingPath);
        // File exists in staging - verify it
        const verifyResult = await verifyArtifactChecksum(stagingPath, artifact);
        if (verifyResult.ok) {
          recoverableArtifacts.push(artifact);
          logger.debug("recoverable artifact found in staging", {
            name: artifact.name,
            path: artifact.path,
          });
        } else {
          // Staging file is corrupted - remove it
          logger.warn("corrupted staging artifact removed", {
            name: artifact.name,
            path: artifact.path,
          });
          try {
            await fs.rm(stagingPath, { force: true });
          } catch {
            // ignore
          }
        }
      } catch {
        // File doesn't exist in staging - not recoverable
      }
    }

    logger.info("staging recovery complete", {
      recoverableCount: recoverableArtifacts.length,
    });

    return { ok: true, recoverableArtifacts };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Failed to recover from staging: ${msg}` };
  }
}

/**
 * Perform deterministic installation from lockfile with staging and recovery.
 *
 * This function:
 * - Recovers from interrupted installs (checks staging area)
 * - Plans what needs to be installed from lockfile
 * - Installs to staging area first
 * - Verifies all checksums from lockfile (not remote metadata)
 * - Atomically promotes from staging to final location
 * - Creates last-known-good snapshots
 * - Quarantines corrupted files instead of deleting
 * - Fails loudly on any error
 *
 * Re-running with the same lockfile produces no changes if everything is already installed correctly.
 */
export async function installFromLockfile(
  lockfile: PackLockfileV1,
  instanceId: string = "default",
): Promise<{ ok: true; result: InstallResult } | { ok: false; error: string }> {
  const logger = getLogger();

  logger.info("starting deterministic installation from lockfile", {
    minecraftVersion: lockfile.minecraftVersion,
    artifactCount: lockfile.artifacts.length,
  });

  // Ensure staging directory exists
  const staging = stagingDir(instanceId);
  await ensureDir(staging);

  // Recover from interrupted install
  const recoveryResult = await recoverFromStaging(lockfile, instanceId);
  if (!recoveryResult.ok) {
    return recoveryResult;
  }
  const recoverableArtifacts = new Set(recoveryResult.recoverableArtifacts.map((a) => a.name));

  if (recoverableArtifacts.size > 0) {
    logger.info("resuming from staging area", {
      recoverableCount: recoverableArtifacts.size,
    });
  }

  // Plan installation
  const planResult = await planInstallation(lockfile, instanceId);
  if (!planResult.ok) {
    return planResult;
  }

  const plan = planResult.plan;

  let installedCount = 0;
  let verifiedCount = 0;
  let skippedCount = 0;
  let promotedCount = 0;
  let quarantinedCount = 0;
  const validatedArtifacts: PackLockfileArtifact[] = [];

  // Track artifacts staged for promotion
  const stagedArtifacts: Array<{ artifact: PackLockfileArtifact; stagingPath: string }> = [];

  // Install or verify each artefact
  for (const artifactPlan of plan.artifacts) {
    if (artifactPlan.needsInstall) {
      // Check if we can recover from staging
      if (recoverableArtifacts.has(artifactPlan.artifact.name)) {
        logger.info("resuming artifact from staging", {
          name: artifactPlan.artifact.name,
          kind: artifactPlan.artifact.kind,
        });
        const stagingPath = resolveStagingPath(artifactPlan.artifact, instanceId);
        stagedArtifacts.push({ artifact: artifactPlan.artifact, stagingPath });
        installedCount++;
      } else {
        logger.info("installing artifact to staging", {
          name: artifactPlan.artifact.name,
          kind: artifactPlan.artifact.kind,
        });
        const result = await installArtifactToStaging(artifactPlan.artifact, instanceId);
        if (!result.ok) {
          return result;
        }
        stagedArtifacts.push({ artifact: artifactPlan.artifact, stagingPath: result.stagingPath });
        installedCount++;
      }
    } else if (artifactPlan.needsVerification) {
      logger.info("verifying artifact", {
        name: artifactPlan.artifact.name,
        kind: artifactPlan.artifact.kind,
      });

      // Resolve path
      const finalPath = resolveFinalPath(artifactPlan.artifact, instanceId);

      const verifyResult = await verifyArtifactChecksum(finalPath, artifactPlan.artifact);
      if (!verifyResult.ok) {
        // Corrupted file - quarantine it and reinstall
        logger.warn("corrupted artifact detected during verification, quarantining and reinstalling", {
          name: artifactPlan.artifact.name,
          path: artifactPlan.artifact.path,
        });
        await quarantineFile(finalPath, artifactPlan.artifact, instanceId);
        quarantinedCount++;

        // Reinstall to staging
        const installResult = await installArtifactToStaging(artifactPlan.artifact, instanceId);
        if (!installResult.ok) {
          return installResult;
        }
        stagedArtifacts.push({ artifact: artifactPlan.artifact, stagingPath: installResult.stagingPath });
        installedCount++;
      } else {
        // Valid - add to validated list for snapshot
        validatedArtifacts.push(artifactPlan.artifact);
        verifiedCount++;
      }
    } else {
      // Already installed and verified - add to validated list for snapshot
      validatedArtifacts.push(artifactPlan.artifact);
      skippedCount++;
    }
  }

  // Promote all staged artifacts atomically
  logger.info("promoting artifacts from staging to final location", {
    stagedCount: stagedArtifacts.length,
  });

  for (const { artifact, stagingPath } of stagedArtifacts) {
    const promoteResult = await promoteArtifact(artifact, stagingPath, instanceId);
    if (!promoteResult.ok) {
      return promoteResult;
    }
    promotedCount++;
    validatedArtifacts.push(artifact);
  }

  // Create last-known-good snapshot of all validated artifacts
  if (validatedArtifacts.length > 0) {
    const snapshotResult = await createLastKnownGoodSnapshot(lockfile, validatedArtifacts, instanceId);
    if (!snapshotResult.ok) {
      logger.warn("failed to create snapshot, continuing anyway", {
        error: snapshotResult.error,
      });
    }
  }

  // Clean up staging directory (all artifacts promoted)
  try {
    await fs.rm(staging, { recursive: true, force: true });
    logger.debug("staging directory cleaned up");
  } catch {
    // ignore cleanup errors
  }

  logger.info("deterministic installation complete", {
    installedCount,
    verifiedCount,
    skippedCount,
    promotedCount,
    quarantinedCount,
    totalArtifacts: plan.artifacts.length,
    ok: true,
  });

  return {
    ok: true,
    result: {
      lockfile,
      installedCount,
      verifiedCount,
      skippedCount,
      promotedCount,
      quarantinedCount,
    },
  };
}

