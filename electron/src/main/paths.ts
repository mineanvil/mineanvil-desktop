/**
 * Instance isolation paths (Electron main).
 *
 * Stop Point 1.1 — Clean Machine Launch (Instance Isolation).
 *
 * Requirements:
 * - Resolve base data directory via Electron app paths (no hardcoded user paths)
 * - Ensure a stable default instance layout exists:
 *   - <base>/instances/default/
 *   - <base>/instances/default/logs/
 *   - <base>/instances/default/minecraft/
 *
 * Notes:
 * - This module is Electron-main only (imports `electron`).
 * - Do not log absolute filesystem paths from here.
 */

import { app } from "electron";
import * as fs from "node:fs/promises";
import * as path from "node:path";

export const DEFAULT_INSTANCE_ID = "default" as const;

export function baseDataDir(): string {
  return app.getPath("userData");
}

export function instanceRoot(instanceId: string = DEFAULT_INSTANCE_ID): string {
  return path.join(baseDataDir(), "instances", instanceId);
}

export function logsDir(instanceId: string = DEFAULT_INSTANCE_ID): string {
  return path.join(instanceRoot(instanceId), "logs");
}

export function minecraftDir(instanceId: string = DEFAULT_INSTANCE_ID): string {
  return path.join(instanceRoot(instanceId), "minecraft");
}

export async function ensureDefaultInstanceDirs(): Promise<{
  instanceRoot: string;
  logsDir: string;
  minecraftDir: string;
}> {
  const root = instanceRoot(DEFAULT_INSTANCE_ID);
  const logs = logsDir(DEFAULT_INSTANCE_ID);
  const mc = minecraftDir(DEFAULT_INSTANCE_ID);

  await fs.mkdir(root, { recursive: true });
  await fs.mkdir(logs, { recursive: true });
  await fs.mkdir(mc, { recursive: true });

  return { instanceRoot: root, logsDir: logs, minecraftDir: mc };
}


