/**
 * Installation planner for deterministic install (Electron main).
 *
 * Stop Point 2.2 — Deterministic Install (Hardening).
 *
 * Responsibilities:
 * - Analyze lockfile to determine what needs to be installed
 * - Check current state of installed artefacts against lockfile
 * - Generate a plan of what needs to be done
 *
 * Requirements:
 * - All decisions are based solely on lockfile contents
 * - Plan is deterministic (same lockfile + same state = same plan)
 * - All checksums come from lockfile, not remote metadata
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as crypto from "node:crypto";
import type { PackLockfileV1, PackLockfileArtifact } from "../pack/packLockfile";
import { instanceRoot, minecraftDir } from "../paths";
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
 * Check if an artefact is installed and verified according to lockfile.
 */
async function checkArtifact(
  artifact: PackLockfileArtifact,
  instanceId: string,
): Promise<{ installed: boolean; verified: boolean }> {
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

  // Check if file exists
  if (!(await fileExists(fullPath))) {
    if (isVerboseEnabled(process.env)) {
      logger.debug("artifact not found", { name: artifact.name, path: artifact.path });
    }
    return { installed: false, verified: false };
  }

  // Verify checksum from lockfile
  const verified = await verifyChecksum(fullPath, artifact.checksum);
  if (isVerboseEnabled(process.env)) {
    logger.debug("artifact check", {
      name: artifact.name,
      installed: true,
      verified,
    });
  }

  return { installed: true, verified };
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
    artifactPlans.push({
      artifact,
      needsInstall: !state.installed,
      needsVerification: state.installed && !state.verified,
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

