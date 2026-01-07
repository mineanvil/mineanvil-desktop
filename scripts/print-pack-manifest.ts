#!/usr/bin/env node
/**
 * Print Pack Manifest helper script.
 *
 * Stop Point 2.1 — Pack Manifest.
 *
 * Usage:
 *   node scripts/print-pack-manifest.js [--verbose|-vvv] [--instance-id <id>]
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

// Resolve manifest path
// In Docker/dev environment, we need to resolve the Windows path structure
// For Windows: %APPDATA%\MineAnvil\instances\<instanceId>\pack\manifest.json
// For Docker: we'll use an environment variable or assume a mounted volume
function getManifestPath(): string {
  // Check for explicit path via environment variable (Docker-friendly)
  const explicitPath = process.env.MINEANVIL_MANIFEST_PATH;
  if (explicitPath) {
    return explicitPath;
  }

  // On Windows, use APPDATA
  if (process.platform === "win32") {
    const appData = process.env.APPDATA;
    if (!appData) {
      throw new Error("APPDATA environment variable not set");
    }
    return path.join(appData, "MineAnvil", "instances", instanceId, "pack", "manifest.json");
  }

  // For Docker/Unix, try common locations or use a mounted volume assumption
  // Default to a relative path that might be mounted
  const dockerPath = path.join("/work", "instances", instanceId, "pack", "manifest.json");
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
      "manifest.json",
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
    const manifestPath = getManifestPath();

    if (verbose) {
      console.error(`[verbose] Instance ID: ${instanceId}`);
      console.error(`[verbose] Manifest path: ${manifestPath}`);
    }

    // Read and parse manifest
    let raw: string;
    try {
      raw = await fs.readFile(manifestPath, { encoding: "utf8" });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") {
        console.error(`Error: Pack manifest not found at: ${manifestPath}`);
        console.error("Ensure MineAnvil has been run at least once to create the manifest.");
        process.exit(1);
      }
      throw e;
    }

    if (verbose) {
      console.error(`[verbose] Manifest file size: ${raw.length} bytes`);
    }

    const manifest = JSON.parse(raw);

    // Validate basic structure
    if (!manifest || typeof manifest !== "object") {
      console.error("Error: Manifest is not a valid JSON object");
      process.exit(1);
    }

    if (verbose) {
      console.error(`[verbose] Manifest keys: ${Object.keys(manifest).join(", ")}`);
    }

    // Print manifest (pretty-printed)
    console.log(JSON.stringify(manifest, null, 2));
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




