/**
 * Deterministic installer for Minecraft Java environment (Electron main).
 *
 * Stop Point 2.2 — Deterministic Install (Hardening).
 *
 * Responsibilities:
 * - Install all artefacts strictly from lockfile
 * - Verify all checksums against lockfile (not remote metadata)
 * - Fail loudly on any mismatch or corruption
 * - Ensure idempotency (re-running with same lockfile does nothing)
 * - Install complete set: version json, client jar, libraries, natives, assets, runtime
 *
 * Requirements:
 * - Lockfile is the sole source of truth for artefacts and checksums
 * - Installation must be deterministic and idempotent
 * - All checksums must be verified from lockfile
 * - Partial installs must fail loudly
 * - No mutation of lockfile is allowed
 * - All logs must be structured and secret-free
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as crypto from "node:crypto";
import type { PackLockfileV1, PackLockfileArtifact } from "../pack/packLockfile";
import { planInstallation } from "./installPlanner";
import { instanceRoot, minecraftDir } from "../paths";
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
 * Install a single artefact from lockfile.
 */
async function installArtifact(
  artifact: PackLockfileArtifact,
  instanceId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
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

  // Runtime artifacts are not supported in SP2.2
  // This should be caught by the planner, but defensive check here
  if (artifact.kind === "runtime") {
    return {
      ok: false,
      error: `This MineAnvil build does not support managed runtime installation yet. Runtime artifacts in the lockfile are not supported. Delete pack/lock.json to regenerate without runtime, or configure MINEANVIL_JAVA_PATH to use an external Java runtime.`,
    };
  }

  // For other artefacts, download and verify
  try {
    // Ensure parent directory exists
    await ensureDir(path.dirname(fullPath));

    // Download with checksum verification
    const downloadOpts: { expectedSize?: number; expectedSha1?: string; expectedSha256?: string } = {};
    if (artifact.size) downloadOpts.expectedSize = artifact.size;
    if (artifact.checksum.algo === "sha1") {
      downloadOpts.expectedSha1 = artifact.checksum.value;
    } else if (artifact.checksum.algo === "sha256") {
      // downloadToFile doesn't support SHA256 directly, so we'll verify after download
      downloadOpts.expectedSize = artifact.size;
    }

    logger.info("downloading artifact", {
      name: artifact.name,
      kind: artifact.kind,
      size: artifact.size,
    });

    await downloadToFile(artifact.url, fullPath, downloadOpts);

    // Verify checksum (downloadToFile verifies SHA1, but we verify SHA256 here)
    const verifyResult = await verifyArtifactChecksum(fullPath, artifact);
    if (!verifyResult.ok) {
      // Clean up corrupted file
      try {
        await fs.rm(fullPath, { force: true });
      } catch {
        // ignore
      }
      return verifyResult;
    }

    // For native artefacts, extract them
    if (artifact.kind === "native") {
      // Extract native JAR to natives directory
      const { spawn } = await import("node:child_process");
      const mcDir = minecraftDir(instanceId);
      const versionId = artifact.path.match(/versions\/([^\/]+)\//)?.[1] ?? "unknown";
      const nativesDir = path.join(mcDir, "natives", versionId);

      await ensureDir(nativesDir);

      // Use PowerShell to extract (same as in install.ts)
      const script = `
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = "${fullPath.replaceAll('"', '""')}"
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
    logger.error("artifact installation failed", { name: artifact.name, error: msg });
    return { ok: false, error: `Failed to install artifact "${artifact.name}": ${msg}` };
  }
}

export interface InstallResult {
  readonly lockfile: PackLockfileV1;
  readonly installedCount: number;
  readonly verifiedCount: number;
  readonly skippedCount: number;
}

/**
 * Perform deterministic installation from lockfile.
 *
 * This function:
 * - Plans what needs to be installed from lockfile
 * - Installs only what's needed (idempotent)
 * - Verifies all checksums from lockfile (not remote metadata)
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

  // Plan installation
  const planResult = await planInstallation(lockfile, instanceId);
  if (!planResult.ok) {
    return planResult;
  }

  const plan = planResult.plan;

  let installedCount = 0;
  let verifiedCount = 0;
  let skippedCount = 0;

  // Install or verify each artefact
  for (const artifactPlan of plan.artifacts) {
    if (artifactPlan.needsInstall) {
      logger.info("installing artifact", {
        name: artifactPlan.artifact.name,
        kind: artifactPlan.artifact.kind,
      });
      const result = await installArtifact(artifactPlan.artifact, instanceId);
      if (!result.ok) {
        return result;
      }
      installedCount++;
    } else if (artifactPlan.needsVerification) {
      logger.info("verifying artifact", {
        name: artifactPlan.artifact.name,
        kind: artifactPlan.artifact.kind,
      });

      // Resolve path
      const instancePath = instanceRoot(instanceId);
      let fullPath: string;
      if (artifactPlan.artifact.path.startsWith(".minecraft/")) {
        const mcDir = minecraftDir(instanceId);
        fullPath = path.join(mcDir, artifactPlan.artifact.path.slice(".minecraft/".length));
      } else if (artifactPlan.artifact.path.startsWith("runtimes/")) {
        const { app } = await import("electron");
        fullPath = path.join(app.getPath("userData"), artifactPlan.artifact.path);
      } else {
        fullPath = path.join(instancePath, artifactPlan.artifact.path);
      }

      const verifyResult = await verifyArtifactChecksum(fullPath, artifactPlan.artifact);
      if (!verifyResult.ok) {
        return verifyResult;
      }
      verifiedCount++;
    } else {
      skippedCount++;
    }
  }

  logger.info("deterministic installation complete", {
    installedCount,
    verifiedCount,
    skippedCount,
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
    },
  };
}

