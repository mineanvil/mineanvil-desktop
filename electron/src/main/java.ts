/**
 * Java runtime resolution + validation (Electron main).
 *
 * Stop Point 1.1 — Clean Machine Launch (Java Runtime).
 *
 * Requirements:
 * - Resolve Java explicitly at startup
 * - Detect and log Java version (version only; NEVER log paths)
 * - Fail fast with a clear error dialog if Java is missing/incompatible
 * - No reliance on PATH alone (PATH allowed only as a debug escape hatch)
 * - No Java downloading in this ticket
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import * as path from "node:path";

export type JavaResolutionSource = "bundled" | "env" | "path";

export type JavaStartupValidation =
  | {
      ok: true;
      source: JavaResolutionSource;
      javaVersionMajor: number;
      /** Truncated `java -version` output (safe to log). */
      javaVersionRaw?: string;
    }
  | {
      ok: false;
      message: string;
    };

function truncate(s: string, max = 800): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…(truncated)`;
}

function findOnPath(exeName: string, env: NodeJS.ProcessEnv): string | null {
  const pathEnv = env.PATH ?? "";
  const parts = pathEnv.split(path.delimiter).filter(Boolean);

  const candidates =
    process.platform === "win32" && !exeName.toLowerCase().endsWith(".exe")
      ? [`${exeName}.exe`, exeName]
      : [exeName];

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

async function runJavaVersion(javaPath: string): Promise<string> {
  return await new Promise((resolve, reject) => {
    const child = spawn(javaPath, ["-version"], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    const chunks: Buffer[] = [];
    child.stdout.on("data", (d) => chunks.push(Buffer.from(d)));
    child.stderr.on("data", (d) => chunks.push(Buffer.from(d)));

    const timeout = setTimeout(() => {
      try {
        child.kill();
      } catch {
        // ignore
      }
      reject(new Error("Timed out while running java -version"));
    }, 5_000);

    child.on("error", (e) => {
      clearTimeout(timeout);
      reject(e);
    });
    child.on("close", () => {
      clearTimeout(timeout);
      resolve(Buffer.concat(chunks).toString("utf8").trim());
    });
  });
}

function parseJavaMajor(versionOutput: string): number | null {
  // Common formats:
  // - java version "17.0.10" 2024-01-16 LTS
  // - openjdk version "21.0.5" 2024-10-15
  // - openjdk version "21-ea" 2024-...
  // - java version "1.8.0_402"
  const m = versionOutput.match(/version\s+"([^"]+)"/i);
  const v = (m?.[1] ?? "").trim();

  const fallback = versionOutput.match(/\b(\d+)(?:\.(\d+))?\b/);
  const candidate = v || (fallback ? fallback[0] : "");
  if (!candidate) return null;

  // Handle legacy "1.x" version strings.
  if (candidate.startsWith("1.")) {
    const parts = candidate.split(".");
    const major = Number.parseInt(parts[1] ?? "", 10);
    return Number.isFinite(major) ? major : null;
  }

  // Handle "21-ea" or "21.0.1"
  const majorStr = candidate.split(/[^0-9]/)[0] ?? "";
  const major = Number.parseInt(majorStr, 10);
  return Number.isFinite(major) ? major : null;
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
 * Resolve and validate Java at startup.
 *
 * Resolution order (Stop Point 1.6):
 * 1) Bundled runtime (if packaged)
 * 2) Explicit `MINEANVIL_JAVA_PATH`
 * 3) PATH lookup only if `MINEANVIL_ALLOW_PATH_JAVA=1`
 */
export async function resolveAndValidateJavaAtStartup(
  env: NodeJS.ProcessEnv = process.env,
): Promise<JavaStartupValidation> {
  // 1) Try bundled runtime first (SP1.6 - Portable Builds)
  const bundled = resolveBundledJava();
  if (bundled) {
    try {
      const out = await runJavaVersion(bundled);
      const major = parseJavaMajor(out);
      if (major === null) {
        return {
          ok: false,
          message: "MineAnvil is missing a required component (Java). Please reinstall MineAnvil.",
        };
      }
      if (major < 17) {
        return {
          ok: false,
          message: `MineAnvil's Java runtime is outdated (Java ${major}). Please reinstall MineAnvil.`,
        };
      }
      return { ok: true, source: "bundled", javaVersionMajor: major, javaVersionRaw: truncate(out) };
    } catch (e) {
      return {
        ok: false,
        message: "MineAnvil is missing a required component (Java). Please reinstall MineAnvil.",
      };
    }
  }

  // 2) Try explicit MINEANVIL_JAVA_PATH (developer/advanced use)
  const explicit = (env.MINEANVIL_JAVA_PATH ?? "").trim();
  if (explicit) {
    if (!existsSync(explicit)) {
      return {
        ok: false,
        message:
          "MineAnvil requires Java 17 or newer. Please install Java from java.com or reinstall MineAnvil.",
      };
    }

    try {
      const out = await runJavaVersion(explicit);
      const major = parseJavaMajor(out);
      if (major === null) {
        return {
          ok: false,
          message:
            "MineAnvil requires Java 17 or newer. Please install Java from java.com or reinstall MineAnvil.",
        };
      }
      if (major < 17) {
        return {
          ok: false,
          message: `Java ${major} is installed, but MineAnvil requires Java 17 or newer. Please update Java from java.com.`,
        };
      }
      return { ok: true, source: "env", javaVersionMajor: major, javaVersionRaw: truncate(out) };
    } catch (e) {
      return {
        ok: false,
        message: "MineAnvil requires Java 17 or newer. Please install Java from java.com or reinstall MineAnvil.",
      };
    }
  }

  // 3) Try PATH (only if MINEANVIL_ALLOW_PATH_JAVA=1, for development)
  if (env.MINEANVIL_ALLOW_PATH_JAVA !== "1") {
    return {
      ok: false,
      message:
        "MineAnvil requires Java 17 or newer. Please install Java from java.com or reinstall MineAnvil.",
    };
  }

  const exe = process.platform === "win32" ? "java.exe" : "java";
  const found = findOnPath(exe, env);
  if (!found) {
    return {
      ok: false,
      message:
        "MineAnvil requires Java 17 or newer. Please install Java from java.com or reinstall MineAnvil.",
    };
  }

  try {
    const out = await runJavaVersion(found);
    const major = parseJavaMajor(out);
    if (major === null) {
      return {
        ok: false,
        message:
          "MineAnvil requires Java 17 or newer. Please install Java from java.com or reinstall MineAnvil.",
      };
    }
    if (major < 17) {
      return {
        ok: false,
        message: `Java ${major} is installed, but MineAnvil requires Java 17 or newer. Please update Java from java.com.`,
      };
    }
    return { ok: true, source: "path", javaVersionMajor: major, javaVersionRaw: truncate(out) };
  } catch (e) {
    return {
      ok: false,
      message: "MineAnvil requires Java 17 or newer. Please install Java from java.com or reinstall MineAnvil.",
    };
  }
}


