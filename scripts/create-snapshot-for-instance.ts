#!/usr/bin/env node
/**
 * Create a snapshot for an instance by running installation.
 * This script uses the existing installFromLockfile flow which automatically creates snapshots.
 *
 * Usage:
 *   node scripts/create-snapshot-for-instance.ts --instance <id>
 */

import { loadOrGenerateLockfile } from "../electron/src/main/pack/packLockfileLoader";
import { installFromLockfile } from "../electron/src/main/install/deterministicInstaller";

interface Args {
  instance?: string;
}

function parseArgs(): Args {
  const args: Args = {};
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === "--instance" && i + 1 < process.argv.length) {
      args.instance = process.argv[++i];
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
Usage: node scripts/create-snapshot-for-instance.ts [options]

Options:
  --instance <id>     Instance ID (default: "default")
  --help, -h          Show this help message

This script runs the existing installation flow which automatically creates
a snapshot after successful installation.
`);
      process.exit(0);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs();
  const instanceId = args.instance ?? "default";

  console.log("Creating snapshot for instance:", instanceId);
  console.log("This will run installation which automatically creates a snapshot...");
  console.log("");

  try {
    // Load or generate lockfile (same as main.ts does)
    const lockfileResult = await loadOrGenerateLockfile(instanceId);
    if (!lockfileResult.ok) {
      console.error(`❌ Failed to load/generate lockfile: ${lockfileResult.error}`);
      process.exit(1);
    }

    console.log(`Lockfile loaded/generated for Minecraft version: ${lockfileResult.lockfile.minecraftVersion}`);
    console.log("");

    // Run installation (this automatically creates snapshots)
    console.log("Running installation...");
    const installResult = await installFromLockfile(lockfileResult.lockfile, instanceId);

    if (installResult.ok) {
      console.log("✅ Installation completed successfully");
      console.log(`   Installed: ${installResult.result.installedCount}`);
      console.log(`   Verified: ${installResult.result.verifiedCount}`);
      console.log(`   Promoted: ${installResult.result.promotedCount}`);
      console.log("");
      console.log("✅ Snapshot should have been created automatically");
      console.log("   Check: %APPDATA%\\MineAnvil\\instances\\" + instanceId + "\\.rollback\\");
      process.exit(0);
    } else {
      console.error(`❌ Installation failed: ${installResult.error}`);
      process.exit(1);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`❌ Unexpected error: ${msg}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
