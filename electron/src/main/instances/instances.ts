/**
 * Instance management (Electron main).
 *
 * Windows-focused, but should not hard-crash on other platforms.
 * Uses Electron `app.getPath("userData")` for storage.
 */

import { app } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import type { InstanceDescriptor } from "../../core/types";

type InstanceMetadataFile = {
  id: string;
  name: string;
};

export async function ensureDefaultInstance(): Promise<InstanceDescriptor> {
  const instanceId = "default";
  const instanceRoot = path.join(app.getPath("userData"), "instances", "default");

  await fs.mkdir(instanceRoot, { recursive: true });

  // Common subfolders (names are "or similar" per prompt).
  await fs.mkdir(path.join(instanceRoot, ".minecraft"), { recursive: true });
  await fs.mkdir(path.join(instanceRoot, "logs"), { recursive: true });
  await fs.mkdir(path.join(instanceRoot, "downloads"), { recursive: true });

  const metadataPath = path.join(instanceRoot, "instance.json");
  const metadata: InstanceMetadataFile = { id: instanceId, name: "Default" };

  try {
    await fs.access(metadataPath);
  } catch {
    // Create metadata file if missing.
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), { encoding: "utf8" });
  }

  return {
    id: instanceId,
    name: metadata.name,
    path: instanceRoot,
  };
}



