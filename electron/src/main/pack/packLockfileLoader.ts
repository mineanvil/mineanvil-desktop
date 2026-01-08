/**
 * Pack Lockfile loader and generator (Electron main).
 *
 * Stop Point 2.2 — Deterministic Install (Hardening).
 *
 * Responsibilities:
 * - Load existing lockfile if present
 * - Generate lockfile deterministically from upstream metadata if missing
 * - Fail loudly if lockfile is corrupt or mismatched
 * - Never silently regenerate an existing lockfile
 *
 * Requirements:
 * - Lockfile is generated deterministically from version metadata
 * - If lockfile exists, it is treated as authoritative
 * - All checksums come from the lockfile, not remote metadata
 * - No mutation of lockfile once written
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { instanceRoot, DEFAULT_INSTANCE_ID } from "../paths";
import type { PackManifestV1 } from "./packManifest";
import type {
  PackLockfileV1,
  PackLockfileArtifact,
} from "./packLockfile";
import { isPackLockfileV1 } from "./packLockfile";
import { resolveVersion, fetchVersionJson } from "../minecraft/metadata";
import type { VersionJson } from "../minecraft/metadata";
import { createLogger, isVerboseEnabled, type LogEntry, type Logger } from "../../shared/logging";

const LOCKFILE_FILENAME = "lock.json";

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
    area: "pack.lockfile",
    sink: createConsoleSink(),
    verbose: isVerboseEnabled(process.env),
  });
}

/**
 * Get the path to the pack lockfile for a given instance.
 */
export function packLockfilePath(instanceId: string = DEFAULT_INSTANCE_ID): string {
  return path.join(instanceRoot(instanceId), "pack", LOCKFILE_FILENAME);
}

/**
 * Write a lockfile atomically to disk.
 */
async function writeLockfileAtomic(lockfilePath: string, lockfile: PackLockfileV1): Promise<void> {
  await fs.mkdir(path.dirname(lockfilePath), { recursive: true });
  const tmp = `${lockfilePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmp, JSON.stringify(lockfile, null, 2), { encoding: "utf8" });
  try {
    await fs.rm(lockfilePath, { force: true });
  } catch {
    // ignore
  }
  await fs.rename(tmp, lockfilePath);
}

/**
 * Try to read and parse an existing lockfile.
 * Returns null if the lockfile doesn't exist.
 * Throws an error if the lockfile exists but is invalid or corrupt.
 */
async function tryReadLockfile(lockfilePath: string): Promise<PackLockfileV1 | null> {
  try {
    const raw = await fs.readFile(lockfilePath, { encoding: "utf8" });
    const parsed = JSON.parse(raw);
    if (!isPackLockfileV1(parsed)) {
      throw new Error("Lockfile structure is invalid");
    }
    return parsed;
  } catch (e) {
    // If file doesn't exist, return null (this is expected on first run)
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    // If file exists but is invalid, re-throw with context
    throw new Error(`Lockfile exists but is invalid or corrupt: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Generate lockfile artefacts from version JSON for Windows.
 */
async function generateLockfileFromVersion(
  versionId: string,
  versionJson: VersionJson,
  versionJsonUrl: string,
  instanceId: string,
): Promise<PackLockfileArtifact[]> {
  const logger = getLogger();
  const artifacts: PackLockfileArtifact[] = [];

  // Download version JSON to compute its checksum
  const { downloadToFile, sha1File } = await import("../net/downloader");
  const { minecraftDir } = await import("../paths");
  const mcDir = minecraftDir(instanceId);
  const versionDir = path.join(mcDir, "versions", versionId);
  await fs.mkdir(versionDir, { recursive: true });
  const versionJsonPath = path.join(versionDir, `${versionId}.json`);

  // Download version JSON if not already present
  try {
    await downloadToFile(versionJsonUrl, versionJsonPath, {});
  } catch {
    // If download fails, we'll compute checksum during install
    logger.warn("version json download failed during lockfile generation, will compute checksum during install");
  }

  // Compute version JSON checksum
  let versionJsonSha1 = "";
  try {
    versionJsonSha1 = await sha1File(versionJsonPath);
  } catch {
    // If file doesn't exist, checksum will be computed during install
    logger.warn("version json not found for checksum computation, will compute during install");
  }

  // Version JSON artifact
  artifacts.push({
    name: `minecraft-version-json-${versionId}`,
    kind: "version_json",
    url: versionJsonUrl,
    path: `.minecraft/versions/${versionId}/${versionId}.json`,
    checksum: {
      algo: "sha1",
      value: versionJsonSha1.toLowerCase(),
    },
  });

  // Client jar
  const client = versionJson.downloads?.client;
  if (client?.url && client?.sha1) {
    artifacts.push({
      name: `minecraft-client-${versionId}`,
      kind: "client_jar",
      url: client.url,
      path: `.minecraft/versions/${versionId}/${versionId}.jar`,
      checksum: {
        algo: "sha1",
        value: client.sha1.toLowerCase(),
      },
      size: client.size,
    });
  }

  // Asset index
  const assetIndex = versionJson.assetIndex;
  if (assetIndex?.id && assetIndex?.url) {
    artifacts.push({
      name: `minecraft-asset-index-${assetIndex.id}`,
      kind: "asset_index",
      url: assetIndex.url,
      path: `.minecraft/assets/indexes/${assetIndex.id}.json`,
      checksum: {
        algo: "sha1",
        value: (assetIndex.sha1 ?? "").toLowerCase(),
      },
      size: assetIndex.size,
    });
  }

  // Libraries (Windows only)
  if (versionJson.libraries) {
    for (const lib of versionJson.libraries) {
      // Check Windows rules
      const rules = lib.rules;
      let allowed = true;
      if (rules && rules.length > 0) {
        allowed = false;
        for (const r of rules) {
          const osName = r.os?.name;
          const matches = !osName || osName === "windows";
          if (matches) allowed = r.action === "allow";
        }
      }
      if (!allowed) continue;

      // Library artifact
      const artifact = lib.downloads?.artifact;
      if (artifact?.url && artifact?.sha1 && artifact?.path) {
        artifacts.push({
          name: `library-${lib.name.replace(/[:.]/g, "-")}`,
          kind: "library",
          url: artifact.url,
          path: `.minecraft/libraries/${artifact.path}`,
          checksum: {
            algo: "sha1",
            value: artifact.sha1.toLowerCase(),
          },
          size: artifact.size,
        });
      }

      // Native classifier (Windows)
      const nativesKey = lib.natives?.windows;
      if (nativesKey && lib.downloads?.classifiers) {
        const classifierKey = nativesKey.replace("${arch}", "64");
        const classifier = lib.downloads.classifiers[classifierKey];
        if (classifier?.url && classifier?.sha1 && classifier?.path) {
          artifacts.push({
            name: `native-${lib.name.replace(/[:.]/g, "-")}-windows-64`,
            kind: "native",
            url: classifier.url,
            path: `.minecraft/libraries/${classifier.path}`,
            checksum: {
              algo: "sha1",
              value: classifier.sha1.toLowerCase(),
            },
            size: classifier.size,
          });
        }
      }
    }
  }

  // Assets - we need to fetch the asset index first
  if (assetIndex?.id && assetIndex?.url) {
    try {
      const { downloadToFile } = await import("../net/downloader");
      const { minecraftDir } = await import("../paths");
      const mcDir = minecraftDir(instanceId);
      const assetIndexPath = path.join(mcDir, "assets", "indexes", `${assetIndex.id}.json`);

      // Download asset index temporarily to read it
      await downloadToFile(assetIndex.url, assetIndexPath, {
        expectedSize: assetIndex.size,
        expectedSha1: assetIndex.sha1,
      });

      const assetIndexJson = JSON.parse(await fs.readFile(assetIndexPath, { encoding: "utf8" })) as {
        objects?: Record<string, { hash: string; size: number }>;
      };

      if (assetIndexJson.objects) {
        for (const [key, obj] of Object.entries(assetIndexJson.objects)) {
          const hash = obj.hash;
          const prefix = hash.slice(0, 2);
          const assetUrl = `https://resources.download.minecraft.net/${prefix}/${hash}`;
          artifacts.push({
            name: `asset-${key.replace(/[\/\\]/g, "-")}`,
            kind: "asset",
            url: assetUrl,
            path: `.minecraft/assets/objects/${prefix}/${hash}`,
            checksum: {
              algo: "sha1",
              value: hash.toLowerCase(),
            },
            size: obj.size,
          });
        }
      }
    } catch (e) {
      logger.warn("failed to generate asset list from index", { error: e instanceof Error ? e.message : String(e) });
      // Continue without assets - they can be added later
    }
  }

  return artifacts;
}


/**
 * Generate a new lockfile deterministically from manifest and upstream metadata.
 */
async function generateLockfile(
  manifest: PackManifestV1,
  instanceId: string,
): Promise<{ ok: true; lockfile: PackLockfileV1 } | { ok: false; error: string }> {
  const logger = getLogger();

  if (!manifest.minecraftVersion || manifest.minecraftVersion.trim() === "") {
    return {
      ok: false,
      error: "Cannot generate lockfile: manifest is missing minecraftVersion",
    };
  }

  logger.info("generating lockfile", { minecraftVersion: manifest.minecraftVersion });

  // Resolve version and fetch version JSON
  const resolved = await resolveVersion(manifest.minecraftVersion);
  if (resolved.versionId !== manifest.minecraftVersion) {
    return {
      ok: false,
      error: `Version resolution mismatch: requested ${manifest.minecraftVersion}, got ${resolved.versionId}`,
    };
  }

  const versionJson = await fetchVersionJson(resolved.versionJsonUrl);

  // Generate artefacts from version JSON
  // Note: Runtime artifacts are NOT included in SP2.2. Managed runtime installation
  // is deferred until a future stop point with pinned URL+checksum.
  const artifacts = await generateLockfileFromVersion(
    manifest.minecraftVersion,
    versionJson,
    resolved.versionJsonUrl,
    instanceId,
  );


  const lockfile: PackLockfileV1 = {
    schemaVersion: "1",
    packId: manifest.packId,
    packVersion: manifest.packVersion,
    minecraftVersion: manifest.minecraftVersion,
    generatedAt: new Date().toISOString(),
    artifacts,
  };

  return { ok: true, lockfile };
}

export type LoadLockfileResult =
  | { ok: true; lockfile: PackLockfileV1 }
  | { ok: false; error: string };

/**
 * Load or generate the pack lockfile for the given instance.
 *
 * Behavior:
 * - If lockfile exists and is valid, return it (authoritative)
 * - If lockfile doesn't exist, generate it deterministically and return it
 * - If lockfile exists but is corrupt, fail with a clear error (no silent regeneration)
 * - If lockfile exists but doesn't match manifest, fail with a clear error
 *
 * This function must be called after manifest is loaded.
 */
export async function loadOrGenerateLockfile(
  manifest: PackManifestV1,
  instanceId: string = DEFAULT_INSTANCE_ID,
): Promise<LoadLockfileResult> {
  const logger = getLogger();
  const lockfilePath = packLockfilePath(instanceId);

  try {
    // Try to read existing lockfile
    const existing = await tryReadLockfile(lockfilePath);
    if (existing !== null) {
      // Validate that lockfile matches manifest
      if (existing.minecraftVersion !== manifest.minecraftVersion) {
        return {
          ok: false,
          error: `Lockfile Minecraft version mismatch: expected "${manifest.minecraftVersion}", found "${existing.minecraftVersion}". Lockfile is authoritative and cannot be regenerated.`,
        };
      }

      // Check for runtime artifacts (not supported in SP2.2)
      const runtimeArtifacts = existing.artifacts.filter((a) => a.kind === "runtime");
      if (runtimeArtifacts.length > 0) {
        return {
          ok: false,
          error: `This MineAnvil build does not support managed runtime installation yet. The lockfile contains ${runtimeArtifacts.length} runtime artifact(s). Delete pack/lock.json to regenerate without runtime, or configure MINEANVIL_JAVA_PATH to use an external Java runtime.`,
        };
      }

      if (existing.packId !== manifest.packId || existing.packVersion !== manifest.packVersion) {
        // Pack ID/version mismatch is a warning but not fatal
        logger.warn("lockfile pack id/version mismatch with manifest", {
          lockfilePackId: existing.packId,
          manifestPackId: manifest.packId,
        });
      }

      logger.info("lockfile loaded", {
        minecraftVersion: existing.minecraftVersion,
        artifactCount: existing.artifacts.length,
      });
      return { ok: true, lockfile: existing };
    }

    // Lockfile doesn't exist - generate it
    if (!manifest.minecraftVersion) {
      return {
        ok: false,
        error: "Cannot generate lockfile: manifest is missing minecraftVersion",
      };
    }

    logger.info("generating new lockfile", { minecraftVersion: manifest.minecraftVersion });
    const generateResult = await generateLockfile(manifest, instanceId);
    if (!generateResult.ok) {
      return generateResult;
    }

    // Write lockfile atomically
    await writeLockfileAtomic(lockfilePath, generateResult.lockfile);

    logger.info("lockfile generated and saved", {
      minecraftVersion: generateResult.lockfile.minecraftVersion,
      artifactCount: generateResult.lockfile.artifacts.length,
    });

    return { ok: true, lockfile: generateResult.lockfile };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: `Lockfile operation failed: ${msg}`,
    };
  }
}

/**
 * Reset (delete and regenerate) the lockfile for an instance.
 * This is a recovery operation for when the lockfile is mismatched or corrupted.
 *
 * Steps:
 * 1. Delete the existing lockfile
 * 2. Regenerate it by calling loadOrGenerateLockfile
 *
 * @param manifest - The pack manifest to regenerate the lockfile from
 * @param instanceId - The instance ID (defaults to default instance)
 * @returns Result indicating success or failure
 */
export async function resetLockfile(
  manifest: PackManifestV1,
  instanceId: string = DEFAULT_INSTANCE_ID,
): Promise<{ ok: true; lockfile: PackLockfileV1 } | { ok: false; error: string }> {
  const logger = getLogger();
  const lockfilePath = packLockfilePath(instanceId);

  try {
    // Log reset start
    logger.info("lockfile reset started", {
      instanceId,
      lockfilePath,
      expectedVersion: manifest.minecraftVersion,
    });

    // Delete existing lockfile if it exists
    try {
      await fs.unlink(lockfilePath);
      logger.info("lockfile deleted", { lockfilePath });
    } catch (e) {
      // If file doesn't exist, that's OK - we're about to regenerate it
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
        throw e;
      }
      logger.info("lockfile did not exist (already deleted)", { lockfilePath });
    }

    // Regenerate lockfile
    const result = await loadOrGenerateLockfile(manifest, instanceId);

    if (result.ok) {
      logger.info("lockfile reset complete", {
        minecraftVersion: result.lockfile.minecraftVersion,
        artifactCount: result.lockfile.artifacts.length,
      });
      return { ok: true, lockfile: result.lockfile };
    } else {
      logger.error("lockfile regeneration failed", { error: result.error });
      return { ok: false, error: result.error };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("lockfile reset failed", { error: msg });
    return {
      ok: false,
      error: `Lockfile reset failed: ${msg}`,
    };
  }
}

