#!/usr/bin/env node
/**
 * Generate Pack Lockfile helper script.
 *
 * Stop Point 2.2 — Deterministic Install (Hardening).
 *
 * This script uses the same underlying code paths as the app (no duplication).
 * It loads the manifest, optionally updates it with a version, and generates the lockfile.
 *
 * Usage:
 *   node scripts/generate-pack-lockfile.ts [--instance <id>] [--version <versionId>] [--verbose]
 *
 * Options:
 *   --instance <id>     Instance ID (default: "default")
 *   --version <id>      Optional: Minecraft version ID to pin in manifest (must be concrete, not "latest")
 *   --verbose, -vvv     Enable verbose output
 *
 * Supports verbose output for debugging.
 * Assumes Docker-based dev environment for tooling.
 */

// Set up environment for paths resolution (mimics Electron app.getPath("userData"))
import * as os from "node:os";
import * as path from "node:path";

// Calculate userData path (same as Electron would on Windows)
const userDataPath = process.env.APPDATA 
  ? path.join(process.env.APPDATA, "MineAnvil")
  : path.join(os.homedir(), "AppData", "Roaming", "MineAnvil");

// Mock Electron app for paths module
(global as any).__ELECTRON_APP_MOCK__ = {
  getPath: (name: string) => {
    if (name === "userData") return userDataPath;
    throw new Error(`Unknown path: ${name}`);
  }
};

import { loadOrCreatePackManifest, updateManifestWithMinecraftVersion } from "../electron/src/main/pack/packManifestLoader";
import { loadOrGenerateLockfile } from "../electron/src/main/pack/packLockfileLoader";

interface Args {
  instance?: string;
  version?: string;
  verbose?: boolean;
}

function parseArgs(): Args {
  const args: Args = {};
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === "--instance" && i + 1 < process.argv.length) {
      args.instance = process.argv[++i];
    } else if (arg === "--version" && i + 1 < process.argv.length) {
      args.version = process.argv[++i];
    } else if (arg === "--verbose" || arg === "-vvv") {
      args.verbose = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
Usage: node scripts/generate-pack-lockfile.ts [options]

Options:
  --instance <id>     Instance ID (default: "default")
  --version <id>     Optional: Minecraft version ID to pin in manifest (must be concrete, not "latest")
  --verbose, -vvv     Enable verbose output
  --help, -h          Show this help message

This script:
  - Loads or creates the pack manifest
  - Optionally updates manifest with a pinned version (if --version provided)
  - Generates lockfile deterministically from manifest
  - Uses the same code paths as the app (no duplication)

Prerequisites:
  - Electron code must be compiled: npm run build:electron
  - Or use tsx/ts-node to run TypeScript directly
`);
      process.exit(0);
    }
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs();
  const instanceId = args.instance ?? "default";
  const versionId = args.version;
  const verbose = args.verbose ?? false;

  if (verbose) {
    console.error(`[verbose] Instance ID: ${instanceId}`);
    if (versionId) {
      console.error(`[verbose] Version to pin: ${versionId}`);
    }
  }

  try {
    // Load or create manifest
    if (verbose) {
      console.error("[verbose] Loading or creating pack manifest...");
    }
    const manifestResult = await loadOrCreatePackManifest(instanceId);
    if (!manifestResult.ok) {
      console.error(`Error: Failed to load/create manifest: ${manifestResult.error}`);
      process.exit(1);
    }

    let manifest = manifestResult.manifest;

    // If version is provided, update manifest
    if (versionId) {
      if (versionId === "latest") {
        console.error("Error: Cannot use 'latest' - must provide a concrete version ID (e.g., '1.21.11')");
        process.exit(1);
      }

      if (verbose) {
        console.error(`[verbose] Updating manifest with version: ${versionId}`);
      }

      const updateResult = await updateManifestWithMinecraftVersion(versionId, instanceId);
      if (!updateResult.ok) {
        console.error(`Error: Failed to update manifest: ${updateResult.error}`);
        process.exit(1);
      }
      manifest = updateResult.manifest;
    }

    // Check if manifest has minecraftVersion
    if (!manifest.minecraftVersion) {
      console.error("Error: Manifest does not have minecraftVersion set.");
      console.error("Provide --version <versionId> to pin a version, or update the manifest manually.");
      process.exit(1);
    }

    if (verbose) {
      console.error(`[verbose] Manifest minecraftVersion: ${manifest.minecraftVersion}`);
      console.error("[verbose] Generating lockfile...");
    }

    // Generate lockfile
    const lockfileResult = await loadOrGenerateLockfile(manifest, instanceId);
    if (!lockfileResult.ok) {
      console.error(`Error: Failed to generate lockfile: ${lockfileResult.error}`);
      process.exit(1);
    }

    const lockfile = lockfileResult.lockfile;

    if (verbose) {
      console.error(`[verbose] Lockfile generated successfully`);
      console.error(`[verbose] Minecraft version: ${lockfile.minecraftVersion}`);
      console.error(`[verbose] Artifact count: ${lockfile.artifacts.length}`);
      console.error(`[verbose] Lockfile path: %APPDATA%\\MineAnvil\\instances\\${instanceId}\\pack\\lock.json`);
    }

    console.log(`✅ Lockfile generated successfully`);
    console.log(`   Minecraft version: ${lockfile.minecraftVersion}`);
    console.log(`   Artifacts: ${lockfile.artifacts.length}`);
    console.log(`   Location: %APPDATA%\\MineAnvil\\instances\\${instanceId}\\pack\\lock.json`);
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

