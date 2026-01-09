/**
 * Robust downloader utilities (Electron main).
 *
 * - Downloads to disk with retries
 * - Skips when size matches (if expected)
 * - Optional SHA1 verification
 *
 * No auth headers used; never log tokens.
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import * as https from "node:https";
import * as os from "node:os";
import * as path from "node:path";
import { Readable } from "node:stream";
import { URL } from "node:url";
import { createLogger, isVerboseEnabled, type LogEntry, type Logger } from "../../shared/logging";

export type DownloadOpts = {
  expectedSize?: number;
  expectedSha1?: string;
  retries?: number;
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
    area: "net.downloader",
    sink: createConsoleSink(),
    verbose: isVerboseEnabled(process.env),
  });
}

async function ensureParentDir(p: string): Promise<void> {
  await fs.mkdir(lp(path.dirname(p)), { recursive: true });
}

async function statSize(p: string): Promise<number | null> {
  try {
    const st = await fs.stat(lp(p));
    return st.size;
  } catch {
    return null;
  }
}

async function rmBestEffort(p: string): Promise<void> {
  try {
    await fs.rm(lp(p), { force: true });
  } catch {
    // ignore
  }
}

async function ensureDir(p: string): Promise<void> {
  await fs.mkdir(lp(p), { recursive: true });
}

export async function sha1File(filePath: string): Promise<string> {
  const buf = await fs.readFile(lp(filePath));
  return crypto.createHash("sha1").update(buf).digest("hex");
}

/**
 * Windows long-path helper.
 * Some deeply nested Minecraft library paths can exceed legacy MAX_PATH and surface as ENOENT.
 */
function lp(p: string): string {
  if (process.platform !== "win32") return p;
  // Already long-path prefixed or UNC.
  if (p.startsWith("\\\\?\\")) return p;
  if (p.startsWith("\\\\")) return p;
  // Only apply when path is long enough to be risky.
  if (p.length < 240) return p;
  // Normalize to absolute path before prefixing.
  const abs = path.resolve(p);
  return `\\\\?\\${abs}`;
}

async function downloadOnce(url: string, destPath: string): Promise<{ bytes: number }> {
  // Prefer fetch streaming when available (per prompt), fall back to https.
  if (typeof fetch === "function") {
    await ensureParentDir(destPath);
    const res = await fetch(url, {
      headers: {
        "User-Agent": "MineAnvil/downloader",
      },
    });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

    const out = createWriteStream(lp(destPath));
    let bytes = 0;

    // Node's fetch body is a Web ReadableStream; convert to Node stream.
    // Type cast is intentionally broad to avoid lib.dom vs stream/web typing mismatches across TS/Node versions.
    const nodeStream = Readable.fromWeb(res.body as any);
    nodeStream.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
    });
    await new Promise<void>((resolve, reject) => {
      nodeStream.pipe(out);
      out.on("finish", () => out.close(() => resolve()));
      out.on("error", reject);
      nodeStream.on("error", reject);
    });
    return { bytes };
  }

  const u = new URL(url);
  if (u.protocol !== "https:") throw new Error("Only https downloads are supported");

  await ensureParentDir(destPath);

  return await new Promise((resolve, reject) => {
    const req = https.get(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port ? Number(u.port) : undefined,
        path: `${u.pathname}${u.search}`,
        headers: {
          "User-Agent": "MineAnvil/downloader",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status < 200 || status >= 300) {
          res.resume();
          reject(new Error(`HTTP ${status}`));
          return;
        }

        const out = createWriteStream(lp(destPath));
        let bytes = 0;
        res.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
        });
        res.pipe(out);

        out.on("finish", () => {
          out.close(() => resolve({ bytes }));
        });
        out.on("error", reject);
      },
    );
    req.on("error", reject);
  });
}

async function moveIntoPlace(tmpPath: string, destPath: string, logger: Logger): Promise<void> {
  // Requirement: ensure destination directory exists before any move/copy.
  await fs.mkdir(path.dirname(destPath), { recursive: true });
  await ensureParentDir(destPath);

  // Prefer atomic rename; fall back to copy+unlink on common Windows failures.
  try {
    await rmBestEffort(destPath);
    await fs.rename(lp(tmpPath), lp(destPath));
    return;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isPerm = msg.includes("EPERM") || msg.includes("operation not permitted");
    const isExdev = msg.includes("EXDEV");

    if (isPerm || isExdev) {
      // copyFile overwrites by default; then unlink temp.
      await fs.copyFile(lp(tmpPath), lp(destPath));
      await rmBestEffort(tmpPath);
      return;
    }

    // Helpful diagnostics for quarantined temp files.
    if (msg.includes("ENOENT") || msg.includes("no such file or directory")) {
      try {
        await fs.access(lp(tmpPath));
        logger.warn("move ENOENT but temp exists (likely dest path issue)", { tmpPath, destPath });
      } catch {
        logger.warn("move ENOENT and temp missing (possible AV/quarantine)", { tmpPath, destPath });
      }
    }

    throw e;
  }
}

export async function downloadToFile(url: string, destPath: string, opts: DownloadOpts = {}): Promise<{
  downloaded: boolean;
  bytes: number;
}> {
  const logger = getLogger();
  const retries = opts.retries ?? 3;

  const existingSize = await statSize(destPath);
  if (existingSize !== null && typeof opts.expectedSize === "number" && existingSize === opts.expectedSize) {
    if (opts.expectedSha1) {
      const actual = await sha1File(destPath);
      if (actual.toLowerCase() === opts.expectedSha1.toLowerCase()) return { downloaded: false, bytes: 0 };
      // fall through to re-download
    } else {
      return { downloaded: false, bytes: 0 };
    }
  }

  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    // Requirement 1: Always ensure destination directory exists BEFORE any write.
    await fs.mkdir(path.dirname(destPath), { recursive: true });

    // Requirement 2: Do NOT create temp files inside the destination directory.
    // Use a dedicated MineAnvil dl/tmp folder under %APPDATA% when available.
    const base =
      process.platform === "win32" && typeof process.env.APPDATA === "string" && process.env.APPDATA.length > 0
        ? process.env.APPDATA
        : os.tmpdir();
    const tmpDir = path.join(base, "MineAnvil", "dl");
    await ensureDir(tmpDir);

    const key = crypto.createHash("sha1").update(destPath).digest("hex").slice(0, 16);
    const tmpPath = path.join(tmpDir, `${key}-${process.pid}-${attempt}.part`);
    try {
      // Always download to a temp file to avoid leaving locked/corrupted partial files at destPath.
      await rmBestEffort(tmpPath);
      const { bytes } = await downloadOnce(url, tmpPath);
      if (isVerboseEnabled(process.env)) logger.debug("download complete", { attempt, bytes });

      // Requirement 3: Verify SHA1 against expected before moving into place.
      if (opts.expectedSha1) {
        const actual = await sha1File(tmpPath);
        if (actual.toLowerCase() !== opts.expectedSha1.toLowerCase()) {
          throw new Error("SHA1 mismatch");
        }
      }

      // Requirement 4: Windows-safe move into place (rename, fallback to copy+unlink).
      await moveIntoPlace(tmpPath, destPath, logger);
      return { downloaded: true, bytes };
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      logger.warn("download attempt failed", { attempt, url, destPath, error: msg });
      // best-effort cleanup temp + destination (destination could be left from older runs)
      await rmBestEffort(tmpPath);
      await rmBestEffort(destPath);
    }
  }

  throw new Error(`Download failed after ${retries} attempts: ${lastErr instanceof Error ? lastErr.message : "unknown"}`);
}


