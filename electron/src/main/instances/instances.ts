/**
 * Instance management (Electron main).
 *
 * Windows-focused, but should not hard-crash on other platforms.
 * Uses Electron `app.getPath("userData")` for storage.
 */

import { app } from "electron";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { InstanceDescriptor } from "../../core/types";

type InstanceMetadataFile = {
  id: string;
  name: string;
};

async function writeJsonAtomic(p: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(p), { recursive: true });
  const tmp = `${p}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), { encoding: "utf8" });
  // Best-effort replace: remove existing, then rename tmp into place.
  // If we crash in-between, the next run can repair by rewriting.
  try {
    await fs.rm(p, { force: true });
  } catch {
    // ignore
  }
  await fs.rename(tmp, p);
}

async function tryReadInstanceMetadata(p: string): Promise<InstanceMetadataFile | null> {
  try {
    const raw = await fs.readFile(p, { encoding: "utf8" });
    const parsed = JSON.parse(raw) as Partial<InstanceMetadataFile> | null;
    if (!parsed || typeof parsed.id !== "string" || typeof parsed.name !== "string") return null;
    if (!parsed.id.trim() || !parsed.name.trim()) return null;
    return { id: parsed.id, name: parsed.name };
  } catch {
    return null;
  }
}

export async function ensureDefaultInstance(): Promise<InstanceDescriptor> {
  const instanceId = "default";
  const instanceRoot = path.join(app.getPath("userData"), "instances", "default");

  await fs.mkdir(instanceRoot, { recursive: true });

  // Common subfolders (names are "or similar" per prompt).
  await fs.mkdir(path.join(instanceRoot, ".minecraft"), { recursive: true });
  await fs.mkdir(path.join(instanceRoot, "logs"), { recursive: true });
  await fs.mkdir(path.join(instanceRoot, "downloads"), { recursive: true });

  const metadataPath = path.join(instanceRoot, "instance.json");
  const expectedMetadata: InstanceMetadataFile = { id: instanceId, name: "Default" };

  // Idempotency: treat "exists but corrupted/partial" as missing and repair it.
  const existing = await tryReadInstanceMetadata(metadataPath);
  if (!existing || existing.id !== instanceId) {
    await writeJsonAtomic(metadataPath, expectedMetadata);
  }

  return {
    id: instanceId,
    name: expectedMetadata.name,
    path: instanceRoot,
  };
}



