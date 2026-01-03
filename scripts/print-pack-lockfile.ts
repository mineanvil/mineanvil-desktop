#!/usr/bin/env node
/**
 * Print Pack Lockfile helper script.
 *
 * Stop Point 2.2 — Deterministic Install (Hardening).
 *
 * Usage:
 *   node scripts/print-pack-lockfile.js [--verbose|-vvv] [--instance-id <id>]
 *
 * Supports verbose output for debugging.
 * Assumes Docker-based dev environment for tooling.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const verbose = args.includes("--verbose") || args.includes("-vvv");
const instanceIdIndex = args.indexOf("--instance-id");
const instanceId =
  instanceIdIndex >= 0 && args[instanceIdIndex + 1]
    ? args[instanceIdIndex + 1]
    : "default";

// Resolve lockfile path
// In Docker/dev environment, we need to resolve the Windows path structure
// For Windows: %APPDATA%\MineAnvil\instances\<instanceId>\pack\lock.json
// For Docker: we'll use an environment variable or assume a mounted volume
function getLockfilePath(): string {
  // Check for explicit path via environment variable (Docker-friendly)
  const explicitPath = process.env.MINEANVIL_LOCKFILE_PATH;
  if (explicitPath) {
    return explicitPath;
  }

  // On Windows, use APPDATA
  if (process.platform === "win32") {
    const appData = process.env.APPDATA;
    if (!appData) {
      throw new Error("APPDATA environment variable not set");
    }
    return path.join(appData, "MineAnvil", "instances", instanceId, "pack", "lock.json");
  }

  // For Docker/Unix, try common locations or use a mounted volume assumption
  // Default to a relative path that might be mounted
  const dockerPath = path.join("/work", "instances", instanceId, "pack", "lock.json");
  if (verbose) {
    console.error(`[verbose] Platform: ${process.platform}`);
    console.error(`[verbose] Trying Docker path: ${dockerPath}`);
  }

  // Fallback: try user home (if mounted)
  const homePath = process.env.HOME || process.env.USERPROFILE;
  if (homePath) {
    const fallbackPath = path.join(
      homePath,
      ".mineanvil",
      "instances",
      instanceId,
      "pack",
      "lock.json",
    );
    if (verbose) {
      console.error(`[verbose] Fallback path: ${fallbackPath}`);
    }
    return fallbackPath;
  }

  return dockerPath;
}

async function main(): Promise<void> {
  try {
    const lockfilePath = getLockfilePath();

    if (verbose) {
      console.error(`[verbose] Instance ID: ${instanceId}`);
      console.error(`[verbose] Lockfile path: ${lockfilePath}`);
    }

    // Read and parse lockfile
    let raw: string;
    try {
      raw = await fs.readFile(lockfilePath, { encoding: "utf8" });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") {
        console.error(`Error: Pack lockfile not found at: ${lockfilePath}`);
        console.error("Ensure MineAnvil has been run at least once to create the lockfile.");
        process.exit(1);
      }
      throw e;
    }

    if (verbose) {
      console.error(`[verbose] Lockfile file size: ${raw.length} bytes`);
    }

    const lockfile = JSON.parse(raw);

    // Validate basic structure
    if (!lockfile || typeof lockfile !== "object") {
      console.error("Error: Lockfile is not a valid JSON object");
      process.exit(1);
    }

    if (verbose) {
      console.error(`[verbose] Lockfile keys: ${Object.keys(lockfile).join(", ")}`);
      if (lockfile.artifacts && Array.isArray(lockfile.artifacts)) {
        console.error(`[verbose] Artifact count: ${lockfile.artifacts.length}`);
        const kinds = lockfile.artifacts.reduce((acc: Record<string, number>, art: { kind?: string }) => {
          const kind = art.kind ?? "unknown";
          acc[kind] = (acc[kind] ?? 0) + 1;
          return acc;
        }, {});
        console.error(`[verbose] Artifact kinds: ${JSON.stringify(kinds)}`);
      }
    }

    // Print lockfile (pretty-printed)
    console.log(JSON.stringify(lockfile, null, 2));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`Error: ${msg}`);
    if (verbose && e instanceof Error && e.stack) {
      console.error(`[verbose] Stack trace:\n${e.stack}`);
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(`Fatal error: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});



