/**
 * Installation planner for deterministic install (Electron main).
 *
 * Stop Point 2.3 — Rollback & Recovery (Hardening).
 *
 * Responsibilities:
 * - Analyze lockfile to determine what needs to be installed
 * - Check current state of installed artefacts against lockfile
 * - Check staging area for recoverable artifacts
 * - Generate a plan of what needs to be done
 *
 * Requirements:
 * - All decisions are based solely on lockfile contents
 * - Plan is deterministic (same lockfile + same state = same plan)
 * - All checksums come from lockfile, not remote metadata
 * - Staging artifacts are detected and can be resumed
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as crypto from "node:crypto";
import type { PackLockfileV1, PackLockfileArtifact } from "../pack/packLockfile";
import { instanceRoot, minecraftDir, stagingDir } from "../paths";
import { sha1File } from "../net/downloader";
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
    area: "install.planner",
    sink: createConsoleSink(),
    verbose: isVerboseEnabled(process.env),
  });
}

export interface ArtifactPlan {
  readonly artifact: PackLockfileArtifact;
  readonly needsInstall: boolean;
  readonly needsVerification: boolean;
  readonly inStaging: boolean;
}

export interface InstallPlan {
  readonly lockfile: PackLockfileV1;
  readonly artifacts: readonly ArtifactPlan[];
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function verifyChecksum(filePath: string, expected: { algo: "sha1" | "sha256"; value: string }): Promise<boolean> {
  try {
    if (expected.algo === "sha1") {
      const actual = await sha1File(filePath);
      return actual.toLowerCase() === expected.value.toLowerCase();
    } else if (expected.algo === "sha256") {
      const buf = await fs.readFile(filePath);
      const hash = crypto.createHash("sha256").update(buf).digest("hex");
      return hash.toLowerCase() === expected.value.toLowerCase();
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Resolve staging path for an artifact.
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
 * Check if an artefact is installed and verified according to lockfile.
 * Also checks staging area for recoverable artifacts.
 * Priority: final location > staging area
 */
async function checkArtifact(
  artifact: PackLockfileArtifact,
  instanceId: string,
): Promise<{ installed: boolean; verified: boolean; inStaging: boolean }> {
  const logger = getLogger();
  const instancePath = instanceRoot(instanceId);

  // Resolve full path
  let fullPath: string;
  if (artifact.path.startsWith(".minecraft/")) {
    const mcDir = minecraftDir(instanceId);
    fullPath = path.join(mcDir, artifact.path.slice(".minecraft/".length));
  } else if (artifact.path.startsWith("runtimes/")) {
    const { app } = await import("electron");
    fullPath = path.join(app.getPath("userData"), artifact.path);
  } else {
    // Relative to instance root
    fullPath = path.join(instancePath, artifact.path);
  }

  // Check final location first (takes priority)
  const finalExists = await fileExists(fullPath);
  if (finalExists) {
    // Verify checksum from lockfile
    const verified = await verifyChecksum(fullPath, artifact.checksum);
    if (isVerboseEnabled(process.env)) {
      logger.debug("artifact check (final location)", {
        name: artifact.name,
        installed: true,
        verified,
        inStaging: false,
      });
    }
    // Final file exists - return its state (staging is irrelevant if final is valid)
    return { installed: true, verified, inStaging: false };
  }

  // Final location doesn't exist - check staging area
  const stagingPath = resolveStagingPath(artifact, instanceId);
  const inStaging = await fileExists(stagingPath);
  if (inStaging) {
    // Verify staging artifact
    const stagingVerified = await verifyChecksum(stagingPath, artifact.checksum);
    if (stagingVerified) {
      if (isVerboseEnabled(process.env)) {
        logger.debug("artifact found in staging and verified", {
          name: artifact.name,
          path: artifact.path,
        });
      }
      // Artifact is in staging and verified - needs promotion
      return { installed: false, verified: false, inStaging: true };
    } else {
      if (isVerboseEnabled(process.env)) {
        logger.debug("artifact found in staging but corrupted", {
          name: artifact.name,
          path: artifact.path,
        });
      }
      // Staging artifact is corrupted - will be removed and reinstalled
      return { installed: false, verified: false, inStaging: false };
    }
  }

  // Neither final nor staging exists
  if (isVerboseEnabled(process.env)) {
    logger.debug("artifact not found", { name: artifact.name, path: artifact.path });
  }
  return { installed: false, verified: false, inStaging: false };
}

/**
 * Plan what needs to be installed based on lockfile and current state.
 *
 * This function is deterministic: same lockfile + same state = same plan.
 * All checksums come from the lockfile, not remote metadata.
 */
export async function planInstallation(
  lockfile: PackLockfileV1,
  instanceId: string = "default",
): Promise<{ ok: true; plan: InstallPlan } | { ok: false; error: string }> {
  const logger = getLogger();
  logger.info("planning installation from lockfile", {
    minecraftVersion: lockfile.minecraftVersion,
    artifactCount: lockfile.artifacts.length,
  });

  // Check for runtime artifacts (not supported in SP2.2)
  const runtimeArtifacts = lockfile.artifacts.filter((a) => a.kind === "runtime");
  if (runtimeArtifacts.length > 0) {
    return {
      ok: false,
      error: `This MineAnvil build does not support managed runtime installation yet. The lockfile contains ${runtimeArtifacts.length} runtime artifact(s). Delete pack/lock.json to regenerate without runtime, or configure MINEANVIL_JAVA_PATH to use an external Java runtime.`,
    };
  }

  const artifactPlans: ArtifactPlan[] = [];

  // Check each artefact in the lockfile (excluding runtime artifacts)
  for (const artifact of lockfile.artifacts) {
    // Skip runtime artifacts (should not be present, but defensive check)
    if (artifact.kind === "runtime") {
      continue;
    }

    const state = await checkArtifact(artifact, instanceId);
    // If final file is installed and verified, we don't need to do anything
    // If staging exists and is valid, we need to promote it (even if final exists, to ensure consistency)
    // If final file exists but is not verified, we need to verify it
    artifactPlans.push({
      artifact,
      needsInstall: (!state.installed && state.inStaging) || (!state.installed && !state.inStaging),
      needsVerification: state.installed && !state.verified && !state.inStaging,
      inStaging: state.inStaging,
    });
  }

  const needsInstallCount = artifactPlans.filter((p) => p.needsInstall).length;
  const needsVerificationCount = artifactPlans.filter((p) => p.needsVerification).length;

  logger.info("installation plan complete", {
    totalArtifacts: artifactPlans.length,
    needsInstall: needsInstallCount,
    needsVerification: needsVerificationCount,
  });

  return {
    ok: true,
    plan: {
      lockfile,
      artifacts: artifactPlans,
    },
  };
}

