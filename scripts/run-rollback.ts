#!/usr/bin/env node
/**
 * Rollback execution script.
 *
 * Usage:
 *   node scripts/run-rollback.ts --instance <id> [--snapshot <snapshotId>] [--verbose]
 *
 * This script executes rollback from a snapshot, restoring artifacts to their
 * last-known-good state.
 *
 * Note: This script requires Electron's app module to be available. For standalone
 * execution, we set up the environment to work with the existing rollback executor.
 */

// Set up environment for paths resolution (mimics Electron app.getPath("userData"))
import * as fs from "node:fs";
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

import { executeRollback } from "../electron/dist/main/install/rollbackExecutor.js";

interface Args {
  instance?: string;
  snapshot?: string;
  verbose?: boolean;
  logPath?: string;
}

function parseArgs(): Args {
  const args: Args = {};
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === "--instance" && i + 1 < process.argv.length) {
      args.instance = process.argv[++i];
    } else if (arg === "--snapshot" && i + 1 < process.argv.length) {
      args.snapshot = process.argv[++i];
    } else if (arg === "--logPath" && i + 1 < process.argv.length) {
      args.logPath = process.argv[++i];
    } else if (arg === "--verbose" || arg === "-v") {
      args.verbose = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
Usage: node scripts/run-rollback.ts [options]

Options:
  --instance <id>     Instance ID (default: "default")
  --snapshot <id>     Snapshot ID to restore (default: latest)
  --logPath <path>    Optional: Write logs to this file (NDJSON format)
  --verbose, -v       Enable verbose logging
  --help, -h          Show this help message

Examples:
  node scripts/run-rollback.ts
  node scripts/run-rollback.ts --instance default --snapshot 1234567890-1.21.4
  node scripts/run-rollback.ts --verbose
  node scripts/run-rollback.ts --logPath rollback.ndjson
`);
      process.exit(0);
    }
  }
  return args;
}

/**
 * Tee console output to a file (similar to installConsoleFileTee in main.ts).
 * Only JSON lines (structured logs) are written to the file.
 */
function installLogFileTee(logFilePath: string): void {
  const stream = fs.createWriteStream(logFilePath, { flags: "a" });

  const safeToText = (v: unknown): string => {
    if (typeof v === "string") return v;
    if (v instanceof Error) return `${v.name}: ${v.message}`;
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  };

  const writeLine = (args: unknown[]) => {
    try {
      const text = args.map(safeToText).join(" ").trim();
      // Only write JSON lines (structured logs) to the file
      // Skip non-JSON lines (like "Starting rollback execution...")
      if (text.startsWith("{") && text.endsWith("}")) {
        // Verify it's valid JSON by parsing it
        try {
          JSON.parse(text);
          stream.write(`${text}\n`);
        } catch {
          // Not valid JSON, skip it
        }
      }
    } catch {
      // Best-effort; never crash due to logging.
    }
  };

  const orig = {
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug.bind(console),
  };

  console.info = (...args: unknown[]) => {
    orig.info(...args);
    writeLine(args);
  };
  console.warn = (...args: unknown[]) => {
    orig.warn(...args);
    writeLine(args);
  };
  console.error = (...args: unknown[]) => {
    orig.error(...args);
    writeLine(args);
  };
  console.debug = (...args: unknown[]) => {
    orig.debug(...args);
    writeLine(args);
  };

  // Ensure stream is closed on exit
  process.on("exit", () => {
    try {
      stream.end();
    } catch {
      // Ignore
    }
  });
}

async function main() {
  const args = parseArgs();

  if (args.verbose) {
    process.env.MINEANVIL_VERBOSE = "1";
  }

  // Install file tee if logPath is provided
  if (args.logPath) {
    try {
      // Ensure directory exists
      const logDir = path.dirname(args.logPath);
      if (logDir && logDir !== ".") {
        fs.mkdirSync(logDir, { recursive: true });
      }
      installLogFileTee(args.logPath);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`Warning: Failed to set up log file at ${args.logPath}: ${msg}`);
      // Continue without file logging
    }
  }

  const instanceId = args.instance ?? "default";
  const snapshotId = args.snapshot;

  console.log("Starting rollback execution...");
  console.log(`Instance: ${instanceId}`);
  if (snapshotId) {
    console.log(`Snapshot: ${snapshotId}`);
  } else {
    console.log("Snapshot: latest (will be selected automatically)");
  }
  console.log("");

  try {
    const result = await executeRollback(instanceId, snapshotId);

    if (result.ok) {
      console.log(`✅ Rollback completed successfully`);
      console.log(`   Snapshot: ${result.snapshotId}`);
      console.log(`   Restored artifacts: ${result.restoredCount}`);
      process.exit(0);
    } else {
      console.error(`❌ Rollback failed: ${result.error}`);
      console.error("");
      console.error("Next steps:");
      console.error("  • Check that snapshots exist: node scripts/validation/list-snapshots.ts");
      console.error("  • Verify snapshot manifest is valid");
      console.error("  • Check logs for detailed error information");
      console.error("  • Try selecting a specific snapshot with --snapshot <id>");
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

