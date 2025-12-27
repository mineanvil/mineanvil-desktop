/**
 * Managed Java runtime provisioning (Windows x64 only, Stage 1).
 *
 * Downloads a JRE/JDK zip, verifies SHA-256, extracts under:
 *   app.getPath("userData")/runtimes/<vendor>/<version>/<platform>/
 *
 * Notes:
 * - Uses Electron main APIs (`app`) and Windows PowerShell `Expand-Archive` for zip extraction.
 * - No external dependencies.
 *
 * SECURITY:
 * - Never log secrets (none expected here).
 * - Do not log token-like strings; log filenames/status codes only.
 */

import { app } from "electron";
import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import * as https from "node:https";
import * as path from "node:path";
import { spawn } from "node:child_process";
import { URL } from "node:url";
import type { RuntimeDescriptor } from "../../core/types";
import { createLogger, isVerboseEnabled, type LogEntry, type Logger } from "../../shared/logging";

export interface RuntimeManifest {
  readonly vendor: string;
  readonly version: string;
  readonly platform: "win-x64";
  readonly downloadUrl: string;
  readonly sha256: string; // hex
  readonly archiveType: "zip";
  /**
   * Relative path (from extracted root) to java executable.
   * Example: "bin/java.exe" or "jdk-21.0.5+11-jre/bin/java.exe"
   */
  readonly javaRelativePath: string;
}

// Placeholder values permitted (per prompt). Structure must be correct.
export const DEFAULT_RUNTIME_MANIFEST: RuntimeManifest = {
  vendor: "temurin",
  version: "21",
  platform: "win-x64",
  downloadUrl: "https://example.invalid/temurin-21-win-x64.zip",
  sha256: "0000000000000000000000000000000000000000000000000000000000000000",
  archiveType: "zip",
  javaRelativePath: "bin/java.exe",
};

function createConsoleSink(): (entry: LogEntry) => void {
  return (entry) => {
    const line = JSON.stringify(entry);
    if (entry.level === "error") console.error(line);
    else if (entry.level === "warn") console.warn(line);
    else if (entry.level === "info") console.info(line);
    else console.debug(line);
  };
}

function getLogger(): Logger {
  return createLogger({
    area: "runtime.managed",
    sink: createConsoleSink(),
    verbose: isVerboseEnabled(process.env),
  });
}

function runtimeInstallDir(manifest: RuntimeManifest): string {
  return path.join(
    app.getPath("userData"),
    "runtimes",
    manifest.vendor,
    manifest.version,
    manifest.platform,
  );
}

function runtimeJavaPath(manifest: RuntimeManifest): string {
  return path.join(runtimeInstallDir(manifest), manifest.javaRelativePath);
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(p: string): Promise<void> {
  await fs.mkdir(p, { recursive: true });
}

async function downloadWithSha256(params: {
  url: string;
  destFile: string;
  logger: Logger;
  maxRedirects?: number;
}): Promise<{ sha256Hex: string }> {
  const maxRedirects = params.maxRedirects ?? 5;

  const visit = async (url: string, redirectsLeft: number): Promise<{ sha256Hex: string }> => {
    const u = new URL(url);
    if (u.protocol !== "https:") throw new Error("Only https downloads are supported");

    return await new Promise((resolve, reject) => {
      const req = https.get(
        {
          protocol: u.protocol,
          hostname: u.hostname,
          port: u.port ? Number(u.port) : undefined,
          path: `${u.pathname}${u.search}`,
          headers: {
            // Avoid leaking secrets (none expected); keep it minimal.
            "User-Agent": "MineAnvil/managed-runtime",
          },
        },
        (res) => {
          const status = res.statusCode ?? 0;

          // Handle redirects
          if (
            (status === 301 || status === 302 || status === 307 || status === 308) &&
            typeof res.headers.location === "string"
          ) {
            if (redirectsLeft <= 0) {
              reject(new Error("Too many redirects while downloading runtime"));
              return;
            }
            const nextUrl = new URL(res.headers.location, u).toString();
            params.logger.info("runtime download redirect", { status });
            res.resume();
            void visit(nextUrl, redirectsLeft - 1).then(resolve, reject);
            return;
          }

          if (status < 200 || status >= 300) {
            params.logger.warn("runtime download failed", { status });
            res.resume();
            reject(new Error(`Download failed (HTTP ${status})`));
            return;
          }

          const hash = crypto.createHash("sha256");
          const out = createWriteStream(params.destFile);

          res.on("data", (chunk: Buffer) => hash.update(chunk));
          res.pipe(out);

          out.on("finish", () => {
            out.close(() => {
              resolve({ sha256Hex: hash.digest("hex") });
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
  };

  return await visit(params.url, maxRedirects);
}

async function extractZipWindows(params: { zipFile: string; destDir: string; logger: Logger }): Promise<void> {
  if (process.platform !== "win32") {
    throw new Error("Managed runtime extraction is only supported on Windows");
  }

  // Use PowerShell Expand-Archive (built-in on modern Windows).
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
        if (isVerboseEnabled(process.env) && out) params.logger.debug("zip extract output", { out: out.slice(0, 400) });
        resolve();
      } else {
        params.logger.warn("zip extract failed", { code });
        reject(new Error(`Expand-Archive failed (exit ${code ?? -1})`));
      }
    });
  });
}

/**
 * Ensure the managed runtime described by `manifest` is installed and usable.
 *
 * Windows x64 only for now.
 */
export async function ensureManagedRuntime(manifest: RuntimeManifest): Promise<RuntimeDescriptor> {
  const logger = getLogger();

  if (manifest.platform !== "win-x64") {
    throw new Error(`Unsupported platform manifest: ${manifest.platform}`);
  }

  const installDir = runtimeInstallDir(manifest);
  const javaPath = runtimeJavaPath(manifest);

  if (await fileExists(javaPath)) {
    return { kind: "managed", javaPath };
  }

  if (process.platform !== "win32") {
    throw new Error("Managed runtime install is only supported on Windows runner");
  }

  await ensureDir(installDir);

  const downloadsDir = path.join(app.getPath("userData"), "downloads");
  await ensureDir(downloadsDir);

  const archiveFile = path.join(downloadsDir, `runtime-${manifest.vendor}-${manifest.version}-${manifest.platform}.zip`);

  logger.info("downloading managed runtime archive", {
    vendor: manifest.vendor,
    version: manifest.version,
    platform: manifest.platform,
    filename: path.basename(archiveFile),
  });

  const { sha256Hex } = await downloadWithSha256({
    url: manifest.downloadUrl,
    destFile: archiveFile,
    logger,
  });

  if (sha256Hex.toLowerCase() !== manifest.sha256.toLowerCase()) {
    logger.warn("runtime checksum mismatch", { ok: false });
    throw new Error("Managed runtime checksum mismatch");
  }

  logger.info("runtime checksum ok", { ok: true });

  // Clean install dir before extracting (best-effort).
  try {
    await fs.rm(installDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
  await ensureDir(installDir);

  await extractZipWindows({ zipFile: archiveFile, destDir: installDir, logger });

  if (!(await fileExists(javaPath))) {
    logger.warn("managed runtime installed but java not found", { ok: false });
    throw new Error("Managed runtime install incomplete: java executable not found");
  }

  logger.info("managed runtime installed", { ok: true });
  return { kind: "managed", javaPath };
}

export async function getManagedRuntimeStatus(
  manifest: RuntimeManifest,
): Promise<{ installed: boolean; runtime?: RuntimeDescriptor }> {
  const javaPath = runtimeJavaPath(manifest);
  if (await fileExists(javaPath)) {
    return { installed: true, runtime: { kind: "managed", javaPath } };
  }
  return { installed: false };
}



