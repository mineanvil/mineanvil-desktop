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
import { performance } from "node:perf_hooks";
import type { PackLockfileV1, PackLockfileArtifact } from "../pack/packLockfile";
import { instanceRoot, minecraftDir, stagingDir } from "../paths";
import { sha1File } from "../net/downloader";
import { createLogger, isVerboseEnabled, type LogEntry, type Logger } from "../../shared/logging";

/**
 * Check if planner debug logging is enabled.
 */
function isPlannerDebugEnabled(env?: Record<string, string | undefined>): boolean {
  return env?.MINEANVIL_PLANNER_DEBUG === "1";
}

/**
 * Check if verify-all mode is enabled via environment flag.
 */
function isVerifyAllEnabled(env?: Record<string, string | undefined>): boolean {
  return env?.MINEANVIL_VERIFY_ALL === "1";
}

/**
 * Check if we should verify (hash) an artifact.
 * Returns true if:
 * - verify-all mode is enabled
 * - artifact is missing (caller should check this separately)
 * - size mismatch detected (if size is available in artifact)
 */
async function shouldVerifyArtifact(
  filePath: string,
  artifact: PackLockfileArtifact,
  verifyAll: boolean,
  profiler?: PlannerProfiler,
): Promise<{ shouldVerify: boolean; reason: string }> {
  // If verify-all is enabled, always hash
  if (verifyAll) {
    return { shouldVerify: true, reason: "verify-all flag enabled" };
  }

  // If size is available, check for size mismatch as a cheap suspicion check
  if (artifact.size !== undefined) {
    const start = performance.now();
    try {
      const stats = await fs.stat(filePath);
      const ms = performance.now() - start;
      profiler?.recordStat(ms);
      
      if (stats.size !== artifact.size) {
        return { shouldVerify: true, reason: `size mismatch: expected ${artifact.size}, got ${stats.size}` };
      }
    } catch {
      // File doesn't exist or can't be stat'd - caller should handle missing file case
      const ms = performance.now() - start;
      profiler?.recordStat(ms);
    }
  }

  // Default: don't hash (trust that file exists and size matches if available)
  return { shouldVerify: false, reason: "no suspicion indicators" };
}

/**
 * Performance profiler for installation planning.
 * Tracks timing for various operations and identifies slowest per-artifact operations.
 */
class PlannerProfiler {
  private readonly startTime: number;
  private existsCheckCount = 0;
  private existsCheckMs = 0;
  private statCount = 0;
  private statMs = 0;
  private hashCheckCount = 0;
  private hashCheckMs = 0;
  private resolvePathMs = 0;
  private readonly perArtifactOps: Array<{
    artifactPath: string;
    artifactName: string;
    operation: string;
    ms: number;
  }> = [];
  private readonly debugEnabled: boolean;

  constructor(debugEnabled: boolean) {
    this.startTime = performance.now();
    this.debugEnabled = debugEnabled;
  }

  /**
   * Record an exists check operation.
   */
  recordExistsCheck(ms: number): void {
    this.existsCheckCount++;
    this.existsCheckMs += ms;
  }

  /**
   * Record a stat operation.
   */
  recordStat(ms: number): void {
    this.statCount++;
    this.statMs += ms;
  }

  /**
   * Record a hash check operation.
   */
  recordHashCheck(ms: number): void {
    this.hashCheckCount++;
    this.hashCheckMs += ms;
  }

  /**
   * Record path resolution time.
   */
  recordResolvePath(ms: number): void {
    this.resolvePathMs += ms;
  }

  /**
   * Record a per-artifact operation for top 10 tracking.
   */
  recordPerArtifactOp(artifactPath: string, artifactName: string, operation: string, ms: number): void {
    this.perArtifactOps.push({ artifactPath, artifactName, operation, ms });
  }

  /**
   * Get the total elapsed time in milliseconds.
   */
  getTotalMs(): number {
    return performance.now() - this.startTime;
  }

  /**
   * Get the top N slowest per-artifact operations, sorted by duration.
   */
  getTopSlowestOps(limit: number = 10): Array<{ artifactPath: string; artifactName: string; operation: string; ms: number }> {
    return [...this.perArtifactOps]
      .sort((a, b) => b.ms - a.ms)
      .slice(0, limit);
  }

  /**
   * Get profiling summary for logging.
   */
  getSummary(): {
    totalMs: number;
    existsCheckCount: number;
    existsCheckMs: number;
    statCount: number;
    statMs: number;
    hashCheckCount: number;
    hashCheckMs: number;
    resolvePathMs: number;
    topSlowestOps: Array<{ artifactPath: string; artifactName: string; operation: string; ms: number }>;
  } {
    return {
      totalMs: this.getTotalMs(),
      existsCheckCount: this.existsCheckCount,
      existsCheckMs: Math.round(this.existsCheckMs),
      statCount: this.statCount,
      statMs: Math.round(this.statMs),
      hashCheckCount: this.hashCheckCount,
      hashCheckMs: Math.round(this.hashCheckMs),
      resolvePathMs: Math.round(this.resolvePathMs),
      topSlowestOps: this.getTopSlowestOps(10),
    };
  }

  /**
   * Check if debug logging is enabled.
   */
  isDebugEnabled(): boolean {
    return this.debugEnabled;
  }
}

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

async function fileExists(p: string, profiler?: PlannerProfiler): Promise<boolean> {
  const start = performance.now();
  try {
    await fs.access(p);
    const ms = performance.now() - start;
    profiler?.recordExistsCheck(ms);
    return true;
  } catch {
    const ms = performance.now() - start;
    profiler?.recordExistsCheck(ms);
    return false;
  }
}

async function verifyChecksum(
  filePath: string,
  expected: { algo: "sha1" | "sha256"; value: string },
  profiler?: PlannerProfiler,
  artifactPath?: string,
  artifactName?: string,
): Promise<boolean> {
  const start = performance.now();
  try {
    let actual: string;
    if (expected.algo === "sha1") {
      actual = await sha1File(filePath);
    } else if (expected.algo === "sha256") {
      const buf = await fs.readFile(filePath);
      actual = crypto.createHash("sha256").update(buf).digest("hex");
    } else {
      const ms = performance.now() - start;
      profiler?.recordHashCheck(ms);
      return false;
    }
    const ms = performance.now() - start;
    profiler?.recordHashCheck(ms);
    if (artifactPath && artifactName && profiler) {
      profiler.recordPerArtifactOp(artifactPath, artifactName, "hash", ms);
    }
    return actual.toLowerCase() === expected.value.toLowerCase();
  } catch {
    const ms = performance.now() - start;
    profiler?.recordHashCheck(ms);
    if (artifactPath && artifactName && profiler) {
      profiler.recordPerArtifactOp(artifactPath, artifactName, "hash", ms);
    }
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
  profiler?: PlannerProfiler,
  verifyAll: boolean = false,
): Promise<{ installed: boolean; verified: boolean; inStaging: boolean }> {
  const logger = getLogger();
  const artifactStart = performance.now();
  const instancePath = instanceRoot(instanceId);

  // Resolve full path
  const resolveStart = performance.now();
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
  const resolveMs = performance.now() - resolveStart;
  profiler?.recordResolvePath(resolveMs);

  // Check final location first (takes priority)
  const finalExistsStart = performance.now();
  const finalExists = await fileExists(fullPath, profiler);
  const finalExistsMs = performance.now() - finalExistsStart;
  if (profiler) {
    profiler.recordPerArtifactOp(artifact.path, artifact.name, "exists_final", finalExistsMs);
  }

  if (finalExists) {
    // Check if we should verify (hash) this artifact
    const verifyDecision = await shouldVerifyArtifact(fullPath, artifact, verifyAll, profiler);
    let verified: boolean;
    if (verifyDecision.shouldVerify) {
      // Hash the file to verify checksum
      verified = await verifyChecksum(fullPath, artifact.checksum, profiler, artifact.path, artifact.name);
    } else {
      // Skip hashing - assume verified based on existence and size match (if available)
      verified = true;
    }
    if (isVerboseEnabled(process.env) || profiler?.isDebugEnabled()) {
      logger.debug("artifact check (final location)", {
        name: artifact.name,
        installed: true,
        verified,
        inStaging: false,
        verifyReason: verifyDecision.reason,
      });
    }
    if (profiler?.isDebugEnabled()) {
      const artifactMs = performance.now() - artifactStart;
      logger.debug("artifact timing", {
        name: artifact.name,
        path: artifact.path,
        totalMs: Math.round(artifactMs),
        resolveMs: Math.round(resolveMs),
        existsMs: Math.round(finalExistsMs),
      });
    }
    // Final file exists - return its state (staging is irrelevant if final is valid)
    return { installed: true, verified, inStaging: false };
  }

  // Final location doesn't exist - check staging area
  const stagingPath = resolveStagingPath(artifact, instanceId);
  const stagingExistsStart = performance.now();
  const inStaging = await fileExists(stagingPath, profiler);
  const stagingExistsMs = performance.now() - stagingExistsStart;
  if (profiler) {
    profiler.recordPerArtifactOp(artifact.path, artifact.name, "exists_staging", stagingExistsMs);
  }

  if (inStaging) {
    // Check if we should verify (hash) this staging artifact
    const verifyDecision = await shouldVerifyArtifact(stagingPath, artifact, verifyAll, profiler);
    let stagingVerified: boolean;
    if (verifyDecision.shouldVerify) {
      // Hash the file to verify checksum
      stagingVerified = await verifyChecksum(stagingPath, artifact.checksum, profiler, artifact.path, artifact.name);
    } else {
      // Skip hashing - assume verified based on existence and size match (if available)
      stagingVerified = true;
    }
    if (stagingVerified) {
      if (isVerboseEnabled(process.env) || profiler?.isDebugEnabled()) {
        logger.debug("artifact found in staging and verified", {
          name: artifact.name,
          path: artifact.path,
        });
      }
      if (profiler?.isDebugEnabled()) {
        const artifactMs = performance.now() - artifactStart;
        logger.debug("artifact timing", {
          name: artifact.name,
          path: artifact.path,
          totalMs: Math.round(artifactMs),
          resolveMs: Math.round(resolveMs),
          existsFinalMs: Math.round(finalExistsMs),
          existsStagingMs: Math.round(stagingExistsMs),
        });
      }
      // Artifact is in staging and verified - needs promotion
      return { installed: false, verified: false, inStaging: true };
    } else {
      if (isVerboseEnabled(process.env) || profiler?.isDebugEnabled()) {
        logger.debug("artifact found in staging but corrupted", {
          name: artifact.name,
          path: artifact.path,
        });
      }
      if (profiler?.isDebugEnabled()) {
        const artifactMs = performance.now() - artifactStart;
        logger.debug("artifact timing", {
          name: artifact.name,
          path: artifact.path,
          totalMs: Math.round(artifactMs),
          resolveMs: Math.round(resolveMs),
          existsFinalMs: Math.round(finalExistsMs),
          existsStagingMs: Math.round(stagingExistsMs),
        });
      }
      // Staging artifact is corrupted - will be removed and reinstalled
      return { installed: false, verified: false, inStaging: false };
    }
  }

  // Neither final nor staging exists
  if (isVerboseEnabled(process.env) || profiler?.isDebugEnabled()) {
    logger.debug("artifact not found", { name: artifact.name, path: artifact.path });
  }
  if (profiler?.isDebugEnabled()) {
    const artifactMs = performance.now() - artifactStart;
    logger.debug("artifact timing", {
      name: artifact.name,
      path: artifact.path,
      totalMs: Math.round(artifactMs),
      resolveMs: Math.round(resolveMs),
      existsFinalMs: Math.round(finalExistsMs),
      existsStagingMs: Math.round(stagingExistsMs),
    });
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

  // Determine verify mode
  const verifyAll = isVerifyAllEnabled(process.env);
  const artifactCount = lockfile.artifacts.filter((a) => a.kind !== "runtime").length;
  const reason = verifyAll
    ? "MINEANVIL_VERIFY_ALL=1 flag set"
    : "hashing skipped unless artifact missing or size mismatch detected";

  // Log verify mode decision
  logger.info("planner_verify_mode", {
    verifyAll,
    reason,
    artifactCount,
  });

  // Create profiler for performance tracking
  const profiler = new PlannerProfiler(isPlannerDebugEnabled(process.env));

  const artifactPlans: ArtifactPlan[] = [];

  // Check each artefact in the lockfile (excluding runtime artifacts)
  for (const artifact of lockfile.artifacts) {
    // Skip runtime artifacts (should not be present, but defensive check)
    if (artifact.kind === "runtime") {
      continue;
    }

    const state = await checkArtifact(artifact, instanceId, profiler, verifyAll);
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

  // Log performance profile
  const profile = profiler.getSummary();
  logger.info("planner_profile", {
    totalMs: Math.round(profile.totalMs),
    existsCheckCount: profile.existsCheckCount,
    existsCheckMs: profile.existsCheckMs,
    statCount: profile.statCount,
    statMs: profile.statMs,
    hashCheckCount: profile.hashCheckCount,
    hashCheckMs: profile.hashCheckMs,
    resolvePathMs: profile.resolvePathMs,
    topSlowestOps: profile.topSlowestOps.map((op) => ({
      artifactPath: op.artifactPath,
      artifactName: op.artifactName,
      operation: op.operation,
      ms: Math.round(op.ms),
    })),
  });

  return {
    ok: true,
    plan: {
      lockfile,
      artifacts: artifactPlans,
    },
  };
}

