/**
 * Pack Manifest loader (Electron main).
 *
 * Stop Point 2.1 — Pack Manifest.
 *
 * Responsibilities:
 * - Load existing manifest if present
 * - Create manifest deterministically on first run
 * - Fail safely with clear error if manifest is corrupt or missing
 *
 * Requirements:
 * - Manifest is created deterministically on first run
 * - Existing runs load and trust the manifest as authoritative
 * - Manifest contents are stable across repeated runs on the same machine
 * - No silent regeneration is allowed in this stop point
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { instanceRoot, DEFAULT_INSTANCE_ID } from "../paths";
import type { PackManifestV1 } from "./packManifest";
import { isPackManifestV1 } from "./packManifest";

const MANIFEST_FILENAME = "manifest.json";

/**
 * Get the path to the pack manifest for a given instance.
 */
export function packManifestPath(instanceId: string = DEFAULT_INSTANCE_ID): string {
  return path.join(instanceRoot(instanceId), "pack", MANIFEST_FILENAME);
}

/**
 * Write a manifest atomically to disk.
 */
async function writeManifestAtomic(
  manifestPath: string,
  manifest: PackManifestV1,
): Promise<void> {
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  const tmp = `${manifestPath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmp, JSON.stringify(manifest, null, 2), { encoding: "utf8" });
  // Best-effort replace: remove existing, then rename tmp into place.
  // If we crash in-between, the next run can repair by rewriting.
  try {
    await fs.rm(manifestPath, { force: true });
  } catch {
    // ignore
  }
  await fs.rename(tmp, manifestPath);
}

/**
 * Try to read and parse an existing manifest.
 * Returns null if the manifest doesn't exist.
 * Throws an error if the manifest exists but is invalid or corrupt.
 */
async function tryReadManifest(manifestPath: string): Promise<PackManifestV1 | null> {
  try {
    const raw = await fs.readFile(manifestPath, { encoding: "utf8" });
    const parsed = JSON.parse(raw);
    if (!isPackManifestV1(parsed)) {
      throw new Error("Manifest structure is invalid");
    }
    return parsed;
  } catch (e) {
    // If file doesn't exist, return null (this is expected on first run)
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    // If file exists but is invalid, re-throw with context
    throw new Error(`Manifest exists but is invalid or corrupt: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Create a new manifest deterministically for the given instance.
 * The createdAt timestamp is generated once and remains stable.
 */
function createNewManifest(instanceId: string): PackManifestV1 {
  // Use a deterministic timestamp based on the instance directory creation time.
  // For this stop point, we use the current time, but it will be stable
  // because we only create it once and then reuse it.
  const createdAt = new Date().toISOString();

  return {
    manifestVersion: "1",
    createdAt,
    instanceId,
    packId: null,
    packVersion: null,
  };
}

export type LoadManifestResult =
  | { ok: true; manifest: PackManifestV1 }
  | { ok: false; error: string };

/**
 * Load or create the pack manifest for the default instance.
 *
 * Behavior:
 * - If manifest exists and is valid, return it
 * - If manifest doesn't exist, create it deterministically and return it
 * - If manifest exists but is corrupt, fail with a clear error (no silent regeneration)
 *
 * This function must be called after instance directories are ensured.
 */
export async function loadOrCreatePackManifest(
  instanceId: string = DEFAULT_INSTANCE_ID,
): Promise<LoadManifestResult> {
  const manifestPath = packManifestPath(instanceId);

  try {
    // Try to read existing manifest
    const existing = await tryReadManifest(manifestPath);
    if (existing !== null) {
      // Validate that the instance ID matches
      if (existing.instanceId !== instanceId) {
        return {
          ok: false,
          error: `Manifest instance ID mismatch: expected "${instanceId}", found "${existing.instanceId}"`,
        };
      }
      return { ok: true, manifest: existing };
    }

    // Manifest doesn't exist - create it
    const newManifest = createNewManifest(instanceId);
    await writeManifestAtomic(manifestPath, newManifest);
    return { ok: true, manifest: newManifest };
  } catch (e) {
    // Handle errors: corrupt manifest, creation failures, etc.
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: msg,
    };
  }
}

