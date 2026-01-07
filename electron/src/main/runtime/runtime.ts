/**
 * Java runtime resolution (Electron main).
 *
 * Stage 1:
 * - Locate `java` on PATH (windows: java.exe, else: java).
 * - Run `java -version` and capture output for diagnostics.
 *
 * No managed runtime downloads yet.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import * as path from "node:path";
import type { RuntimeDescriptor } from "../../core/types";
import { DEFAULT_RUNTIME_MANIFEST, ensureManagedRuntime } from "./managedRuntime";

function truncate(s: string, max = 800): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…(truncated)`;
}

function findOnPath(exeName: string): string | null {
  const pathEnv = process.env.PATH ?? "";
  const parts = pathEnv.split(path.delimiter).filter(Boolean);

  // On Windows, also try common executable extensions if exeName has none.
  const candidates =
    process.platform === "win32" && !exeName.toLowerCase().endsWith(".exe") ? [`${exeName}.exe`, exeName] : [exeName];

  for (const dir of parts) {
    for (const candidate of candidates) {
      const full = path.join(dir, candidate);
      try {
        if (existsSync(full)) return full;
      } catch {
        // ignore
      }
    }
  }
  return null;
}

async function getJavaVersion(javaPath: string): Promise<string | undefined> {
  return await new Promise((resolve) => {
    const child = spawn(javaPath, ["-version"], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    const chunks: Buffer[] = [];
    child.stdout.on("data", (d) => chunks.push(Buffer.from(d)));
    child.stderr.on("data", (d) => chunks.push(Buffer.from(d)));

    child.on("error", () => resolve(undefined));
    child.on("close", () => {
      const out = Buffer.concat(chunks).toString("utf8");
      resolve(truncate(out.trim()));
    });
  });
}

export async function resolveJavaRuntime(): Promise<RuntimeDescriptor> {
  const exe = process.platform === "win32" ? "java.exe" : "java";
  const found = findOnPath(exe);

  if (!found) {
    throw new Error("Java was not found on PATH. Install Java and ensure it is available on PATH.");
  }

  const javaVersion = await getJavaVersion(found);

  return {
    kind: "system",
    javaPath: found,
    javaVersion,
  };
}

/**
 * Resolve bundled Java runtime (packaged builds only).
 *
 * Stop Point 1.6 — Bundled Java Runtime (Portable Builds)
 *
 * Returns the bundled java.exe path if:
 * - Running in a packaged Electron app (process.resourcesPath defined)
 * - Platform is Windows
 * - resources/java/win32-x64/runtime/bin/java.exe exists
 *
 * Otherwise returns null.
 */
function resolveBundledJava(): string | null {
  // Only available in packaged builds
  if (!process.resourcesPath) {
    return null;
  }

  // Only supported on Windows
  if (process.platform !== "win32") {
    return null;
  }

  // Deterministic path (no globbing)
  const javaExe = path.join(process.resourcesPath, "java", "win32-x64", "runtime", "bin", "java.exe");

  if (existsSync(javaExe)) {
    return javaExe;
  }

  return null;
}

/**
 * Prefer bundled runtime first (SP1.6), then managed runtime (dev mode), then fall back to PATH java.
 *
 * This allows MineAnvil portable builds to work fully offline.
 */
export async function resolveJavaRuntimePreferManaged(): Promise<RuntimeDescriptor> {
  // SP1.6: Check for bundled Java first (packaged builds)
  const bundled = resolveBundledJava();
  if (bundled) {
    const javaVersion = await getJavaVersion(bundled);
    return {
      kind: "system",
      javaPath: bundled,
      javaVersion,
    };
  }

  // Dev mode: Try managed runtime installation
  let managedError: string | null = null;
  try {
    return await ensureManagedRuntime(DEFAULT_RUNTIME_MANIFEST);
  } catch (e) {
    managedError = e instanceof Error ? e.message : String(e);
  }

  try {
    return await resolveJavaRuntime();
  } catch (e) {
    const fallbackError = e instanceof Error ? e.message : String(e);
    throw new Error(`Managed runtime failed: ${managedError}; PATH java failed: ${fallbackError}`);
  }
}


