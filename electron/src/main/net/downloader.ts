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
  await fs.mkdir(path.dirname(p), { recursive: true });
}

async function statSize(p: string): Promise<number | null> {
  try {
    const st = await fs.stat(p);
    return st.size;
  } catch {
    return null;
  }
}

export async function sha1File(filePath: string): Promise<string> {
  const buf = await fs.readFile(filePath);
  return crypto.createHash("sha1").update(buf).digest("hex");
}

async function downloadOnce(url: string, destPath: string): Promise<{ bytes: number }> {
  // Prefer fetch streaming when available (per prompt), fall back to https.
  if (typeof fetch === "function") {
    await ensureParentDir(destPath);
    const res = await fetch(url, {
      headers: { "User-Agent": "MineAnvil/downloader" },
    });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

    const out = createWriteStream(destPath);
    let bytes = 0;

    // Node's fetch body is a Web ReadableStream; convert to Node stream.
    const nodeStream = Readable.fromWeb(res.body as unknown as ReadableStream);
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

        const out = createWriteStream(destPath);
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
    try {
      const { bytes } = await downloadOnce(url, destPath);
      if (isVerboseEnabled(process.env)) logger.debug("download complete", { attempt, bytes });

      if (opts.expectedSha1) {
        const actual = await sha1File(destPath);
        if (actual.toLowerCase() !== opts.expectedSha1.toLowerCase()) {
          throw new Error("SHA1 mismatch");
        }
      }

      return { downloaded: true, bytes };
    } catch (e) {
      lastErr = e;
      logger.warn("download attempt failed", { attempt });
      // best-effort cleanup partial file
      try {
        await fs.rm(destPath, { force: true });
      } catch {
        // ignore
      }
    }
  }

  throw new Error(`Download failed after ${retries} attempts: ${lastErr instanceof Error ? lastErr.message : "unknown"}`);
}


