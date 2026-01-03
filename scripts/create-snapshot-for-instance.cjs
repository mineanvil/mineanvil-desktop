#!/usr/bin/env node
/**
 * Create a snapshot for an instance by reading lockfile and materializing artifacts.
 * 
 * This script:
 * - Reads lock.json directly from disk (lockfile is authoritative)
 * - Verifies all artifacts exist and have correct checksums
 * - Creates a materialized snapshot with all artifact files
 *
 * Usage:
 *   node scripts/create-snapshot-for-instance.cjs --instance <id>
 *
 * Prerequisites:
 *   - Electron code must be compiled: npm run build:electron
 *   - Lockfile must exist (run MineAnvil install first)
 */

const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

// Set up Node-safe path resolution before importing Electron modules
// This mocks Electron's app.getPath so compiled code works in Node.js
const { createElectronAppMock, getInstanceRoot, getPackRoot } = require("./lib/nodePaths.cjs");
global.__ELECTRON_APP_MOCK__ = createElectronAppMock();

// Import from compiled CommonJS modules (these will use the mock)
const { rollbackDir } = require("../electron/dist/main/paths.js");

function parseArgs() {
  const args = {};
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === "--instance" && i + 1 < process.argv.length) {
      args.instance = process.argv[++i];
    } else if (arg === "--verbose" || arg === "-v") {
      args.verbose = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
Usage: node scripts/create-snapshot-for-instance.cjs [options]

Options:
  --instance <id>     Instance ID (default: "default")
  --verbose, -v       Enable verbose output
  --help, -h          Show this help message

Prerequisites:
  - Electron code must be compiled: npm run build:electron
  - Lockfile must exist: Run MineAnvil once to install the pack, then rerun this script.

This script reads the lockfile and creates a materialized snapshot with all artifact files.
`);
      process.exit(0);
    }
  }
  return args;
}

/**
 * Read and parse lockfile from disk.
 */
async function loadLockfile(instanceId) {
  const instanceRoot = getInstanceRoot(instanceId);
  const lockfilePath = path.join(instanceRoot, "pack", "lock.json");
  
  try {
    await fs.access(lockfilePath);
  } catch {
    return {
      ok: false,
      error: `No lockfile found at ${lockfilePath}. Run MineAnvil once to install the pack, then rerun this script.`,
    };
  }
  
  try {
    const content = await fs.readFile(lockfilePath, { encoding: "utf8" });
    const lockfile = JSON.parse(content);
    
    // Basic validation
    if (!lockfile.schemaVersion || lockfile.schemaVersion !== "1") {
      return {
        ok: false,
        error: `Invalid lockfile schema version: ${lockfile.schemaVersion}. Expected "1".`,
      };
    }
    
    if (!lockfile.minecraftVersion || typeof lockfile.minecraftVersion !== "string") {
      return {
        ok: false,
        error: `Invalid lockfile: minecraftVersion is missing or not a string.`,
      };
    }
    
    if (!Array.isArray(lockfile.artifacts)) {
      return {
        ok: false,
        error: `Invalid lockfile: artifacts is missing or not an array.`,
      };
    }
    
    return { ok: true, lockfile };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: `Failed to read/parse lockfile: ${msg}`,
    };
  }
}

/**
 * Resolve final path for an artifact.
 */
function resolveFinalPath(artifact, instanceId) {
  const instanceRoot = getInstanceRoot(instanceId);
  if (artifact.path.startsWith(".minecraft/")) {
    const mcDir = path.join(instanceRoot, ".minecraft");
    return path.join(mcDir, artifact.path.slice(".minecraft/".length));
  } else {
    // All non-runtime artifacts should be under instance root
    return path.join(instanceRoot, artifact.path);
  }
}

/**
 * Verify artifact checksum.
 */
async function verifyChecksum(filePath, artifact) {
  try {
    let actual;
    if (artifact.checksum.algo === "sha1") {
      // Use sha1File if available, otherwise compute manually
      const { sha1File } = require("../electron/dist/main/net/downloader.js");
      actual = await sha1File(filePath);
    } else if (artifact.checksum.algo === "sha256") {
      const buf = await fs.readFile(filePath);
      actual = crypto.createHash("sha256").update(buf).digest("hex");
    } else {
      return { ok: false, error: `Unsupported checksum algorithm: ${artifact.checksum.algo}` };
    }
    
    if (actual.toLowerCase() !== artifact.checksum.value.toLowerCase()) {
      return {
        ok: false,
        error: `Checksum mismatch. Expected ${artifact.checksum.value.toLowerCase()}, got ${actual.toLowerCase()}.`,
      };
    }
    
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Failed to verify checksum: ${msg}` };
  }
}

/**
 * Create materialized snapshot from lockfile.
 * Copies ALL artifacts (except runtime) from lockfile to snapshot.
 * Fails if any artifact is missing or has incorrect checksum/size.
 */
async function createSnapshot(lockfile, instanceId, verbose) {
  const rollback = rollbackDir(instanceId);
  const snapshotId = `${Date.now()}-${lockfile.minecraftVersion}`;
  const finalSnapshotDir = path.join(rollback, snapshotId);
  const stagingSnapshotDir = path.join(rollback, ".staging", snapshotId);
  
  // Filter out runtime artifacts (not supported for snapshots)
  const allArtifacts = lockfile.artifacts.filter((a) => a.kind !== "runtime");
  
  console.log(`Creating snapshot: ${snapshotId}`);
  console.log(`Minecraft version: ${lockfile.minecraftVersion}`);
  console.log(`Artifacts in lockfile: ${lockfile.artifacts.length}`);
  console.log(`Artifacts to snapshot: ${allArtifacts.length} (excluding ${lockfile.artifacts.length - allArtifacts.length} runtime)`);
  console.log("");
  
  try {
    // Create staging directory
    await fs.mkdir(stagingSnapshotDir, { recursive: true });
    const filesDir = path.join(stagingSnapshotDir, "files");
    await fs.mkdir(filesDir, { recursive: true });
    
    const artifacts = [];
    let copiedCount = 0;
    const missingArtifacts = [];
    
    for (const artifact of allArtifacts) {
      const finalPath = resolveFinalPath(artifact, instanceId);
      if (!finalPath) {
        missingArtifacts.push({
          logicalName: artifact.name,
          relativePath: artifact.path,
        });
        continue;
      }
      
      // Check if file exists
      try {
        await fs.access(finalPath);
      } catch {
        missingArtifacts.push({
          logicalName: artifact.name,
          relativePath: artifact.path,
        });
        console.error(`❌ Source file missing: ${artifact.name} at ${artifact.path}`);
        continue; // Collect all missing before failing
      }
      
      // Get file size before copy
      const stats = await fs.stat(finalPath);
      const expectedSize = artifact.size;
      const actualSize = stats.size;
      
      // Verify size matches expected (when provided)
      if (expectedSize !== undefined && actualSize !== expectedSize) {
        console.error(`❌ Size mismatch: ${artifact.name} - expected ${expectedSize}, got ${actualSize}`);
        // Cleanup and fail
        await fs.rm(path.dirname(stagingSnapshotDir), { recursive: true, force: true });
        return {
          ok: false,
          error: `Snapshot creation failed: size mismatch for artifact ${artifact.name} at ${artifact.path}. Expected ${expectedSize}, got ${actualSize}.`,
        };
      }
      
      // Copy artifact to staging snapshot directory
      const snapshotArtifactPath = path.join(filesDir, artifact.path);
      await fs.mkdir(path.dirname(snapshotArtifactPath), { recursive: true });
      await fs.copyFile(finalPath, snapshotArtifactPath);
      
      // Verify checksum of copied file
      const verifyResult = await verifyChecksum(snapshotArtifactPath, artifact);
      if (!verifyResult.ok) {
        console.error(`❌ Checksum mismatch after copy: ${artifact.name} - ${verifyResult.error}`);
        // Cleanup and fail
        await fs.rm(path.dirname(stagingSnapshotDir), { recursive: true, force: true });
        return {
          ok: false,
          error: `Snapshot creation failed: checksum mismatch after copying artifact ${artifact.name}: ${verifyResult.error}`,
        };
      }
      
      copiedCount++;
      if (verbose) {
        console.log(`  ✓ ${artifact.name}`);
      }
      
      artifacts.push({
        logicalName: artifact.name,
        relativePath: artifact.path,
        checksum: {
          algo: artifact.checksum.algo,
          value: artifact.checksum.value,
        },
        size: actualSize,
      });
    }
    
    // Completeness check: all artifacts must be copied
    if (missingArtifacts.length > 0) {
      const firstN = missingArtifacts.slice(0, 10);
      const missingList = firstN.map((a) => `${a.logicalName} (${a.relativePath})`).join(", ");
      const moreText = missingArtifacts.length > 10 ? ` and ${missingArtifacts.length - 10} more` : "";
      // Cleanup and fail
      await fs.rm(path.dirname(stagingSnapshotDir), { recursive: true, force: true });
      return {
        ok: false,
        error: `Snapshot creation failed: ${missingArtifacts.length} artifact(s) missing. First missing: ${missingList}${moreText}. All artifacts must exist for snapshot creation.`,
      };
    }
    
    if (copiedCount !== allArtifacts.length) {
      // Cleanup and fail
      await fs.rm(path.dirname(stagingSnapshotDir), { recursive: true, force: true });
      return {
        ok: false,
        error: `Snapshot creation failed: copied ${copiedCount} artifacts but expected ${allArtifacts.length}.`,
      };
    }
    
    // Write manifest (v1 format)
    const snapshotManifest = {
      version: 1,
      snapshotId,
      createdAt: new Date().toISOString(),
      minecraftVersion: lockfile.minecraftVersion,
      authority: "lockfile",
      artifactCount: artifacts.length,
      artifacts,
    };
    
    const manifestPath = path.join(stagingSnapshotDir, "snapshot.v1.json");
    const manifestContent = JSON.stringify(snapshotManifest, null, 2);
    // Atomic write
    const tempManifestPath = `${manifestPath}.tmp`;
    await fs.writeFile(tempManifestPath, manifestContent, { encoding: "utf8" });
    await fs.rename(tempManifestPath, manifestPath);
    
    // Atomically rename staging directory to final snapshot directory
    await fs.rename(stagingSnapshotDir, finalSnapshotDir);
    
    console.log("");
    console.log(`✅ Snapshot created successfully: ${snapshotId}`);
    console.log(`   Artifacts copied: ${copiedCount}`);
    console.log(`   Artifacts in manifest: ${artifacts.length}`);
    console.log(`   Snapshot location: ${finalSnapshotDir}`);
    
    return { ok: true, snapshotId };
  } catch (e) {
    // Cleanup staging directory on any error
    await fs.rm(path.dirname(stagingSnapshotDir), { recursive: true, force: true }).catch(() => {
      // Ignore cleanup errors
    });
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Failed to create snapshot: ${msg}` };
  }
}

async function main() {
  const args = parseArgs();
  const instanceId = args.instance ?? "default";
  
  console.log("Creating snapshot for instance:", instanceId);
  console.log("");
  
  try {
    // Load lockfile directly from disk
    const lockfileResult = await loadLockfile(instanceId);
    if (!lockfileResult.ok) {
      console.error(`❌ ${lockfileResult.error}`);
      process.exit(1);
    }
    
    const lockfile = lockfileResult.lockfile;
    console.log(`✓ Lockfile loaded`);
    console.log(`  Minecraft version: ${lockfile.minecraftVersion}`);
    console.log(`  Artifacts: ${lockfile.artifacts.length}`);
    console.log("");
    
    // Create snapshot
    const snapshotResult = await createSnapshot(lockfile, instanceId, args.verbose);
    
    if (!snapshotResult.ok) {
      console.error(`❌ ${snapshotResult.error}`);
      process.exit(1);
    }
    
    console.log("");
    console.log("✅ Snapshot creation completed successfully");
    process.exit(0);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`❌ Unexpected error: ${msg}`);
    if (args.verbose) {
      console.error(e);
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
