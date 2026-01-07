/**
 * Java version selection for Minecraft versions (SP1.7).
 *
 * Determines which Java major version (17 or 21) is required for a given
 * Minecraft version, and resolves the appropriate bundled runtime path.
 *
 * Selection rule:
 * - Minecraft >= 1.20.5: Java 21
 * - Minecraft < 1.20.5: Java 17
 *
 * Resolution order (per major version):
 * 1. Bundled runtime (always preferred in packaged builds)
 * 2. MINEANVIL_JAVA_PATH (dev only)
 * 3. PATH (dev only, requires MINEANVIL_ALLOW_PATH_JAVA=1)
 */

import { existsSync } from "node:fs";
import * as path from "node:path";
import { spawn } from "node:child_process";

/**
 * Parse Minecraft version string into comparable components.
 * Examples: "1.21.11" -> {major: 1, minor: 21, patch: 11}
 */
function parseMinecraftVersion(version: string): { major: number; minor: number; patch: number } {
  const parts = version.split(".").map((p) => Number.parseInt(p, 10));
  return {
    major: parts[0] ?? 0,
    minor: parts[1] ?? 0,
    patch: parts[2] ?? 0,
  };
}

/**
 * Compare two Minecraft versions.
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
function compareVersions(a: string, b: string): number {
  const va = parseMinecraftVersion(a);
  const vb = parseMinecraftVersion(b);

  if (va.major !== vb.major) return va.major - vb.major;
  if (va.minor !== vb.minor) return va.minor - vb.minor;
  return va.patch - vb.patch;
}

/**
 * Determine required Java major version for a Minecraft version.
 *
 * Rule: Minecraft >= 1.20.5 requires Java 21, else Java 17.
 */
export function getRequiredJavaMajorForMinecraftVersion(minecraftVersion: string): 17 | 21 {
  const threshold = "1.20.5";
  return compareVersions(minecraftVersion, threshold) >= 0 ? 21 : 17;
}

/**
 * Resolve bundled Java runtime path for a specific major version.
 *
 * Packaged builds: resources/java/win32-x64/jre{major}/runtime/bin/java.exe
 * Dev builds: electron/vendor/java/win32-x64/jre{major}/runtime/bin/java.exe
 */
function resolveBundledJava(major: 17 | 21): string | null {
  if (process.platform !== "win32") {
    return null;
  }

  // Try packaged build path first
  if (process.resourcesPath) {
    const packagedPath = path.join(
      process.resourcesPath,
      "java",
      "win32-x64",
      `jre${major}`,
      "runtime",
      "bin",
      "java.exe",
    );
    if (existsSync(packagedPath)) {
      return packagedPath;
    }
  }

  // Fall back to dev build path
  const devPath = path.join(
    process.cwd(),
    "electron",
    "vendor",
    "java",
    "win32-x64",
    `jre${major}`,
    "runtime",
    "bin",
    "java.exe",
  );
  if (existsSync(devPath)) {
    return devPath;
  }

  return null;
}

/**
 * Resolve Java from MINEANVIL_JAVA_PATH environment variable (dev only).
 * Returns null if not set or invalid.
 */
async function resolveJavaFromEnv(major: 17 | 21): Promise<string | null> {
  const javaPath = process.env.MINEANVIL_JAVA_PATH;
  if (!javaPath) {
    return null;
  }

  if (!existsSync(javaPath)) {
    console.warn(`[javaSelection] MINEANVIL_JAVA_PATH points to non-existent file: ${javaPath}`);
    return null;
  }

  // Verify it's the correct major version
  try {
    const version = await getJavaVersion(javaPath);
    if (version && version.includes(`version "${major}.`)) {
      return javaPath;
    }
    console.warn(
      `[javaSelection] MINEANVIL_JAVA_PATH points to Java with wrong version (expected ${major}): ${version}`,
    );
  } catch (e) {
    console.warn(`[javaSelection] Failed to verify MINEANVIL_JAVA_PATH: ${e}`);
  }

  return null;
}

/**
 * Resolve Java from PATH (dev only, requires MINEANVIL_ALLOW_PATH_JAVA=1).
 */
async function resolveJavaFromPath(major: 17 | 21): Promise<string | null> {
  if (process.env.MINEANVIL_ALLOW_PATH_JAVA !== "1") {
    return null;
  }

  const javaExe = process.platform === "win32" ? "java.exe" : "java";
  const pathEnv = process.env.PATH ?? "";
  const parts = pathEnv.split(path.delimiter).filter(Boolean);

  for (const dir of parts) {
    const javaPath = path.join(dir, javaExe);
    if (existsSync(javaPath)) {
      try {
        const version = await getJavaVersion(javaPath);
        if (version && version.includes(`version "${major}.`)) {
          return javaPath;
        }
      } catch {
        // Ignore and continue
      }
    }
  }

  return null;
}

/**
 * Get Java version string by running `java -version`.
 */
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
      resolve(out.trim());
    });
  });
}

export interface JavaResolutionResult {
  readonly source: "bundled" | "env" | "path" | "none";
  readonly javaPath: string | null;
  readonly major: 17 | 21;
}

/**
 * Resolve Java runtime for a given Minecraft version.
 *
 * Resolution order (for the required major version):
 * 1. Bundled runtime (always preferred)
 * 2. MINEANVIL_JAVA_PATH (dev only)
 * 3. PATH (dev only, requires MINEANVIL_ALLOW_PATH_JAVA=1)
 *
 * Logs the resolution decision for diagnostics.
 */
export async function resolveJavaForMinecraftVersion(minecraftVersion: string): Promise<JavaResolutionResult> {
  const major = getRequiredJavaMajorForMinecraftVersion(minecraftVersion);

  console.log(`[javaSelection] Minecraft version: ${minecraftVersion} requires Java ${major}`);

  // 1. Try bundled runtime (always preferred)
  const bundled = resolveBundledJava(major);
  if (bundled) {
    console.log(`[javaSelection] Using bundled Java ${major}: ${bundled}`);
    return { source: "bundled", javaPath: bundled, major };
  }

  console.log(`[javaSelection] Bundled Java ${major} not found`);

  // 2. Try MINEANVIL_JAVA_PATH (dev only)
  const fromEnv = await resolveJavaFromEnv(major);
  if (fromEnv) {
    console.log(`[javaSelection] Using MINEANVIL_JAVA_PATH: ${fromEnv}`);
    return { source: "env", javaPath: fromEnv, major };
  }

  // 3. Try PATH (dev only, requires explicit opt-in)
  const fromPath = await resolveJavaFromPath(major);
  if (fromPath) {
    console.log(`[javaSelection] Using PATH Java ${major}: ${fromPath}`);
    return { source: "path", javaPath: fromPath, major };
  }

  console.error(`[javaSelection] No Java ${major} runtime found`);
  return { source: "none", javaPath: null, major };
}
