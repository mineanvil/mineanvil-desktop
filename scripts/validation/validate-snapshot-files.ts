#!/usr/bin/env node
/**
 * Validate that snapshot directory contains all artifact files listed in snapshot manifest.
 *
 * Usage:
 *   node scripts/validation/validate-snapshot-files.ts --instance <id> --snapshot <snapshotId> [--verbose] [--limit <N>]
 *
 * Exit codes:
 * - 0: All checked artifacts exist
 * - 1: One or more artifacts are missing
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

interface Args {
  instance?: string;
  snapshot?: string;
  verbose?: boolean;
  limit?: number;
}

function parseArgs(): Args {
  const args: Args = {};
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === "--instance" && i + 1 < process.argv.length) {
      args.instance = process.argv[++i];
    } else if (arg === "--snapshot" && i + 1 < process.argv.length) {
      args.snapshot = process.argv[++i];
    } else if (arg === "--verbose" || arg === "-v") {
      args.verbose = true;
    } else if (arg === "--limit" && i + 1 < process.argv.length) {
      args.limit = parseInt(process.argv[++i], 10);
    } else if (arg === "--help" || arg === "-h") {
      console.error("Usage: node scripts/validation/validate-snapshot-files.ts --instance <id> --snapshot <snapshotId> [--verbose] [--limit <N>]");
      console.error("");
      console.error("Validates that snapshot directory contains all artifact files listed in manifest.");
      console.error("Exit code 0 if all checked artifacts exist, 1 if any are missing.");
      process.exit(1);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs();
  const instanceId = args.instance ?? "default";
  const snapshotId = args.snapshot;
  const verbose = args.verbose ?? false;
  const limit = args.limit;

  if (!snapshotId) {
    console.error("ERROR: --snapshot <snapshotId> is required");
    process.exit(1);
  }

  // Resolve paths
  const appData = process.env.APPDATA || (process.platform === "win32" ? "" : "");
  if (!appData) {
    console.error("ERROR: APPDATA environment variable not set");
    process.exit(1);
  }

  const rollbackDir = path.join(appData, "MineAnvil", "instances", instanceId, ".rollback");
  const snapshotDir = path.join(rollbackDir, snapshotId);
  const manifestPath = path.join(snapshotDir, "snapshot.v1.json");

  try {
    // Check if snapshot directory exists
    await fs.access(snapshotDir);

    // Read manifest
    const manifestContent = await fs.readFile(manifestPath, { encoding: "utf8" });
    const manifest = JSON.parse(manifestContent) as any;

    if (!manifest.artifacts || !Array.isArray(manifest.artifacts)) {
      console.error(`ERROR: Snapshot manifest has no artifacts array`);
      process.exit(1);
    }

    const artifacts = manifest.artifacts as Array<{
      logicalName: string;
      relativePath: string;
      checksum: { algo: string; value: string };
      size: number;
    }>;

    const artifactsToCheck = limit ? artifacts.slice(0, limit) : artifacts;
    const missingArtifacts: string[] = [];

    if (verbose) {
      console.log(`Checking ${artifactsToCheck.length} of ${artifacts.length} artifacts...`);
    }

    for (const artifact of artifactsToCheck) {
      // V1 snapshots store artifacts under files\ subdirectory
      // relativePath in manifest is relative to files\ root
      const artifactPath = path.join(snapshotDir, "files", artifact.relativePath);
      try {
        await fs.access(artifactPath);
        
        // Verify checksum if possible
        if (artifact.checksum && (artifact.checksum.algo === "sha1" || artifact.checksum.algo === "sha256")) {
          // For now, just check existence. Full checksum verification could be added later.
          if (verbose) {
            console.log(`✓ ${artifact.logicalName} (${artifact.checksum.algo}: ${artifact.checksum.value.substring(0, 8)}...)`);
          }
        } else {
          if (verbose) {
            console.log(`✓ ${artifact.logicalName}`);
          }
        }
      } catch {
        missingArtifacts.push(artifact.logicalName);
        if (verbose) {
          console.error(`✗ ${artifact.logicalName} (missing: files/${artifact.relativePath})`);
        }
      }
    }

    if (missingArtifacts.length > 0) {
      console.error(`ERROR: ${missingArtifacts.length} artifact(s) missing:`);
      const displayList = missingArtifacts.slice(0, 20);
      for (const name of displayList) {
        console.error(`  - ${name}`);
      }
      if (missingArtifacts.length > 20) {
        console.error(`  ... and ${missingArtifacts.length - 20} more`);
      }
      process.exit(1);
    }

    if (verbose) {
      console.log(`✓ All ${artifactsToCheck.length} checked artifacts exist`);
    }
    process.exit(0);
  } catch (e: any) {
    if (e.code === "ENOENT") {
      if (e.path === snapshotDir || e.path === manifestPath) {
        console.error(`ERROR: Snapshot not found: ${snapshotId}`);
        console.error(`  Path: ${e.path}`);
      } else {
        console.error(`ERROR: File not found: ${e.path}`);
      }
      process.exit(1);
    }
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`ERROR: Failed to validate snapshot: ${msg}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Unexpected error:", e);
  process.exit(1);
});

