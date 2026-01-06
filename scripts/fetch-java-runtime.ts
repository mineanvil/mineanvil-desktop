#!/usr/bin/env node
/**
 * Fetch Java 17 JRE for bundling with portable builds.
 *
 * Stop Point 1.6 — Bundled Java Runtime (Portable Builds)
 *
 * Requirements:
 * - Download Eclipse Temurin 17 JRE (Windows x64, pinned version)
 * - Verify SHA256 checksum (fail fast on mismatch)
 * - Extract to normalized vendor directory: electron/vendor/java/win32-x64/runtime/
 * - Skip download if runtime already exists
 * - Windows-only (guard against non-Windows platforms)
 *
 * Usage:
 *   npm run fetch:java-runtime
 */

import * as fs from "node:fs";
import * as https from "node:https";
import * as crypto from "node:crypto";
import * as path from "node:path";
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";

// ============================================================================
// PINNED RUNTIME CONFIGURATION
// ============================================================================

const RUNTIME_CONFIG = {
  vendor: "Eclipse Temurin",
  version: "17.0.13+11",
  platform: "win32-x64",
  downloadUrl:
    "https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.13%2B11/OpenJDK17U-jre_x64_windows_hotspot_17.0.13_11.zip",
  // SHA256 checksum for OpenJDK17U-jre_x64_windows_hotspot_17.0.13_11.zip
  // Verified by download: 2026-01-06
  sha256: "11a61a94d383e755b08b4e5890a13d148bc9f95b7149cbbeec62efb8c75a4a67",
} as const;

// ============================================================================
// PATHS
// ============================================================================

const PROJECT_ROOT = path.resolve(process.cwd());
const VENDOR_DIR = path.join(PROJECT_ROOT, "electron", "vendor", "java", RUNTIME_CONFIG.platform);
const RUNTIME_DIR = path.join(VENDOR_DIR, "runtime");
const DOWNLOADS_DIR = path.join(PROJECT_ROOT, ".downloads");
const ZIP_FILE = path.join(DOWNLOADS_DIR, `temurin-17-jre-${RUNTIME_CONFIG.platform}.zip`);

// ============================================================================
// UTILITIES
// ============================================================================

function log(message: string, ...args: unknown[]): void {
  console.log(`[fetch-java-runtime] ${message}`, ...args);
}

function error(message: string, ...args: unknown[]): void {
  console.error(`[fetch-java-runtime] ERROR: ${message}`, ...args);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(dir: string): Promise<void> {
  await fs.promises.mkdir(dir, { recursive: true });
}

// ============================================================================
// DOWNLOAD WITH SHA256 VERIFICATION
// ============================================================================

async function downloadFile(params: {
  url: string;
  destFile: string;
  expectedSha256: string;
}): Promise<void> {
  log(`Downloading: ${params.url}`);
  log(`Destination: ${params.destFile}`);

  await ensureDir(path.dirname(params.destFile));

  return await new Promise((resolve, reject) => {
    const req = https.get(
      params.url,
      {
        headers: {
          "User-Agent": "MineAnvil/fetch-java-runtime",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;

        // Handle redirects
        if (status === 301 || status === 302 || status === 307 || status === 308) {
          const location = res.headers.location;
          if (location) {
            log(`Redirect to: ${location}`);
            res.resume();
            void downloadFile({ ...params, url: location }).then(resolve, reject);
            return;
          }
        }

        if (status < 200 || status >= 300) {
          res.resume();
          reject(new Error(`Download failed (HTTP ${status})`));
          return;
        }

        const hash = crypto.createHash("sha256");
        const out = createWriteStream(params.destFile);

        let downloadedBytes = 0;
        const totalBytes = Number.parseInt(res.headers["content-length"] ?? "0", 10);

        res.on("data", (chunk: Buffer) => {
          hash.update(chunk);
          downloadedBytes += chunk.length;
          if (totalBytes > 0) {
            const percent = ((downloadedBytes / totalBytes) * 100).toFixed(1);
            process.stdout.write(`\r  Downloaded: ${percent}%`);
          }
        });

        res.pipe(out);

        out.on("finish", () => {
          process.stdout.write("\n");
          out.close(() => {
            const actualSha256 = hash.digest("hex");
            log(`Computed SHA256: ${actualSha256}`);
            log(`Expected SHA256: ${params.expectedSha256}`);

            if (actualSha256.toLowerCase() !== params.expectedSha256.toLowerCase()) {
              error("SHA256 checksum mismatch!");
              error("This indicates the downloaded file is corrupted or tampered with.");
              reject(new Error("SHA256 checksum mismatch"));
            } else {
              log("✅ Checksum verified");
              resolve();
            }
          });
        });

        out.on("error", (e) => {
          res.resume();
          reject(e);
        });
      },
    );

    req.on("error", reject);
  });
}

// ============================================================================
// EXTRACT ZIP (Windows PowerShell)
// ============================================================================

async function extractZip(params: { zipFile: string; destDir: string }): Promise<void> {
  if (process.platform !== "win32") {
    throw new Error("Extraction is only supported on Windows (uses PowerShell Expand-Archive)");
  }

  log(`Extracting: ${params.zipFile}`);
  log(`Destination: ${params.destDir}`);

  await ensureDir(params.destDir);

  const ps = "powershell.exe";
  const cmd = [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    `Expand-Archive -Path "${params.zipFile.replaceAll('"', '""')}" -DestinationPath "${params.destDir.replaceAll('"', '""')}" -Force`,
  ];

  await new Promise<void>((resolve, reject) => {
    const child = spawn(ps, cmd, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });

    const chunks: Buffer[] = [];
    child.stdout.on("data", (d) => chunks.push(Buffer.from(d)));
    child.stderr.on("data", (d) => chunks.push(Buffer.from(d)));

    child.on("error", reject);
    child.on("close", (code) => {
      const out = Buffer.concat(chunks).toString("utf8").trim();
      if (code === 0) {
        log("✅ Extraction complete");
        if (out) log(`  Output: ${out.slice(0, 400)}`);
        resolve();
      } else {
        error(`Expand-Archive failed (exit ${code ?? -1})`);
        if (out) error(`  Output: ${out}`);
        reject(new Error(`Expand-Archive failed (exit ${code ?? -1})`));
      }
    });
  });
}

// ============================================================================
// NORMALIZE DIRECTORY STRUCTURE
// ============================================================================

/**
 * Temurin extracts to a nested directory like:
 *   jdk-17.0.13+11-jre/bin/java.exe
 *
 * We need to normalize this to:
 *   runtime/bin/java.exe
 *
 * This ensures deterministic resolution (no globbing at runtime).
 */
async function normalizeExtractedRuntime(extractDir: string): Promise<void> {
  log("Normalizing directory structure...");

  // Find the extracted nested directory (e.g., jdk-17.0.13+11-jre)
  const entries = await fs.promises.readdir(extractDir, { withFileTypes: true });
  const nestedDir = entries.find((entry) => entry.isDirectory());

  if (!nestedDir) {
    throw new Error("No nested directory found after extraction");
  }

  const nestedPath = path.join(extractDir, nestedDir.name);
  const runtimePath = path.join(extractDir, "runtime");

  log(`Found nested directory: ${nestedDir.name}`);
  log(`Renaming to: runtime/`);

  // Rename nested directory to "runtime"
  await fs.promises.rename(nestedPath, runtimePath);

  // Verify java.exe exists
  const javaExe = path.join(runtimePath, "bin", "java.exe");
  if (!(await fileExists(javaExe))) {
    throw new Error(`java.exe not found at expected path: ${javaExe}`);
  }

  log(`✅ Normalized to: ${runtimePath}`);
  log(`✅ Verified: ${javaExe}`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  log("Starting Java runtime fetch...");
  log(`Vendor: ${RUNTIME_CONFIG.vendor}`);
  log(`Version: ${RUNTIME_CONFIG.version}`);
  log(`Platform: ${RUNTIME_CONFIG.platform}`);

  // Guard: Windows only
  if (process.platform !== "win32") {
    log("⏭️  Skipping: Not running on Windows (bundled runtime is Windows-only)");
    process.exit(0);
  }

  // Check if runtime already exists
  const javaExe = path.join(RUNTIME_DIR, "bin", "java.exe");
  if (await fileExists(javaExe)) {
    log("⏭️  Runtime already exists, skipping download");
    log(`  Path: ${javaExe}`);
    process.exit(0);
  }

  // Download
  await downloadFile({
    url: RUNTIME_CONFIG.downloadUrl,
    destFile: ZIP_FILE,
    expectedSha256: RUNTIME_CONFIG.sha256,
  });

  // Extract to temporary directory
  const tempExtractDir = path.join(VENDOR_DIR, "temp-extract");
  await fs.promises.rm(tempExtractDir, { recursive: true, force: true });
  await extractZip({ zipFile: ZIP_FILE, destDir: tempExtractDir });

  // Normalize directory structure
  await normalizeExtractedRuntime(tempExtractDir);

  // Move to final location
  await fs.promises.rm(RUNTIME_DIR, { recursive: true, force: true });
  await fs.promises.rename(path.join(tempExtractDir, "runtime"), RUNTIME_DIR);
  await fs.promises.rm(tempExtractDir, { recursive: true, force: true });

  // Verify final structure
  if (!(await fileExists(javaExe))) {
    throw new Error(`Final verification failed: ${javaExe} not found`);
  }

  log("✅ Java runtime successfully fetched and installed");
  log(`  Path: ${RUNTIME_DIR}`);
  log(`  Executable: ${javaExe}`);

  // Clean up download
  try {
    await fs.promises.unlink(ZIP_FILE);
    log("  Cleaned up ZIP file");
  } catch {
    // Ignore cleanup errors
  }
}

// Run
main().catch((err) => {
  error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
