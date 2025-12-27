/**
 * Build a dry-run launch plan (Electron main).
 *
 * No actual Minecraft launching yet:
 * - Uses `java -version` as a safe placeholder command.
 */

import type { LaunchPlan } from "../../core/types";
import { ensureDefaultInstance } from "../instances/instances";
import { resolveJavaRuntime } from "../runtime/runtime";

export async function buildLaunchPlan(): Promise<LaunchPlan> {
  const instance = await ensureDefaultInstance();
  const runtime = await resolveJavaRuntime();

  const notes: string[] = [];
  notes.push(`instancePath=${instance.path}`);
  notes.push(`javaPath=${runtime.javaPath}`);
  if (runtime.javaVersion) notes.push(`javaVersion=${runtime.javaVersion}`);

  return {
    instanceId: instance.id,
    instancePath: instance.path,
    javaPath: runtime.javaPath,
    // Placeholder args (dry-run)
    args: ["-version"],
    env: {},
    notes,
  };
}


