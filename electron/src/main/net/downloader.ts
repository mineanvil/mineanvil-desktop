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

type DownloadResult = {
  downloaded: boolean;
  bytes: number;
};

/**
 * In-flight de-dupe to prevent parallel callers (e.g. multiple IPC invocations)
 * from downloading the same file into the same temp path, which causes EPERM/ENOENT races.
 */
const inFlight = new Map<string, Promise<DownloadResult>>();

function getDownloadTempDir(): { tmpDir: string; source: "env" | "localappdata" | "os.tmpdir" } {
  // Explicit override (useful for debugging / enterprise environments)
  const override = process.env.MINEANVIL_DL_DIR;
  if (typeof override === "string" && override.trim().length > 0) {
    return { tmpDir: override.trim(), source: "env" };
  }

  // Windows: prefer LocalAppData (less likely to be blocked by AV / Controlled Folder Access than Roaming)
  if (process.platform === "win32") {
    const la = process.env.LOCALAPPDATA;
    if (typeof la === "string" && la.trim().length > 0) {
      return { tmpDir: path.join(la.trim(), "MineAnvil", "dl"), source: "localappdata" };
    }
  }

  // Fallback everywhere: OS temp dir
  return { tmpDir: path.join(os.tmpdir(), "MineAnvil", "dl"), source: "os.tmpdir" };
}

function isTraceEnabled(env?: Record<string, string | undefined>): boolean {
  return env?.MINEANVIL_DOWNLOAD_TRACE === "1";
}

function errorMeta(e: unknown): Record<string, unknown> {
  if (e instanceof Error) {
    const anyErr = e as any;
    return {
      name: e.name,
      message: e.message,
      stack: e.stack,
      code: typeof anyErr?.code === "string" ? anyErr.code : undefined,
      errno: typeof anyErr?.errno === "number" ? anyErr.errno : undefined,
      syscall: typeof anyErr?.syscall === "string" ? anyErr.syscall : undefined,
      path: typeof anyErr?.path === "string" ? anyErr.path : undefined,
    };
  }
  return { error: String(e) };
}

function headersToObject(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of headers.entries()) out[k] = v;
  return out;
}

function isEnoentOpenForPath(e: unknown, p: string): boolean {
  if (!(e instanceof Error)) return false;
  const msg = e.message ?? "";
  // Windows and *nix variants
  if (!msg.includes("ENOENT")) return false;
  if (!msg.includes("open")) return false;
  // Best-effort: avoid retrying unrelated ENOENTs (e.g. stat, rename)
  return msg.includes(p) || msg.includes(path.basename(p));
}

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
  const trace = isTraceEnabled(process.env);
  return createLogger({
    area: "net.downloader",
    sink: createConsoleSink(),
    verbose: isVerboseEnabled(process.env) || trace,
  });
}

function trace(logger: Logger, enabled: boolean, message: string, meta?: Record<string, unknown>): void {
  if (!enabled) return;
  // Use info (not debug) so it shows even without MINEANVIL_DEBUG=1.
  logger.info(`[trace] ${message}`, meta);
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
  const traceEnabled = isTraceEnabled(process.env);
  const logger = getLogger();

  // Prefer fetch streaming when available (per prompt), fall back to https.
  if (typeof fetch === "function") {
    trace(logger, traceEnabled, "downloadOnce: using fetch()", {
      url,
      destPath,
      destPathLp: lp(destPath),
      node: process.version,
      pid: process.pid,
      platform: process.platform,
    });
    await ensureParentDir(destPath);
    trace(logger, traceEnabled, "downloadOnce: ensured parent dir", { destPath, parent: path.dirname(destPath) });

    const res = await fetch(url, {
      headers: {
        "User-Agent": "MineAnvil/downloader",
      },
    });
    trace(logger, traceEnabled, "downloadOnce: response", {
      url,
      status: res.status,
      ok: res.ok,
      redirected: res.redirected,
      finalUrl: res.url,
      headers: headersToObject(res.headers),
    });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

    const out = createWriteStream(lp(destPath));
    let bytes = 0;
    let lastProgressAt = Date.now();
    let lastProgressBytes = 0;
    out.on("open", (fd) => trace(logger, traceEnabled, "downloadOnce: write stream open", { destPath, fd }));
    out.on("close", () => trace(logger, traceEnabled, "downloadOnce: write stream close", { destPath, bytes }));
    out.on("error", (e) => trace(logger, traceEnabled, "downloadOnce: write stream error", { destPath, ...errorMeta(e) }));

    // Node's fetch body is a Web ReadableStream; convert to Node stream.
    // Type cast is intentionally broad to avoid lib.dom vs stream/web typing mismatches across TS/Node versions.
    const nodeStream = Readable.fromWeb(res.body as any);
    nodeStream.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (traceEnabled) {
        const now = Date.now();
        const delta = bytes - lastProgressBytes;
        // Log progress at most once per second or every ~5MiB.
        if (now - lastProgressAt >= 1000 || delta >= 5 * 1024 * 1024) {
          lastProgressAt = now;
          lastProgressBytes = bytes;
          trace(logger, traceEnabled, "downloadOnce: progress", {
            destPath,
            bytes,
            chunk: chunk.length,
          });
        }
      }
    });
    await new Promise<void>((resolve, reject) => {
      nodeStream.pipe(out);
      out.on("finish", () => out.close(() => resolve()));
      out.on("error", reject);
      nodeStream.on("error", reject);
    });
    trace(logger, traceEnabled, "downloadOnce: complete", { destPath, bytes });
    return { bytes };
  }

  const u = new URL(url);
  if (u.protocol !== "https:") throw new Error("Only https downloads are supported");

  trace(logger, traceEnabled, "downloadOnce: using https.get()", {
    url,
    destPath,
    hostname: u.hostname,
    path: `${u.pathname}${u.search}`,
  });
  await ensureParentDir(destPath);
  trace(logger, traceEnabled, "downloadOnce: ensured parent dir", { destPath, parent: path.dirname(destPath) });

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
        trace(logger, traceEnabled, "downloadOnce: response", {
          url,
          status,
          headers: res.headers,
        });
        if (status < 200 || status >= 300) {
          res.resume();
          reject(new Error(`HTTP ${status}`));
          return;
        }

        const out = createWriteStream(lp(destPath));
        let bytes = 0;
        let lastProgressAt = Date.now();
        let lastProgressBytes = 0;
        out.on("open", (fd) => trace(logger, traceEnabled, "downloadOnce: write stream open", { destPath, fd }));
        out.on("close", () => trace(logger, traceEnabled, "downloadOnce: write stream close", { destPath, bytes }));
        out.on("error", (e) => trace(logger, traceEnabled, "downloadOnce: write stream error", { destPath, ...errorMeta(e) }));

        res.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (traceEnabled) {
            const now = Date.now();
            const delta = bytes - lastProgressBytes;
            if (now - lastProgressAt >= 1000 || delta >= 5 * 1024 * 1024) {
              lastProgressAt = now;
              lastProgressBytes = bytes;
              trace(logger, traceEnabled, "downloadOnce: progress", {
                destPath,
                bytes,
                chunk: chunk.length,
              });
            }
          }
        });
        res.on("error", (e) => trace(logger, traceEnabled, "downloadOnce: response stream error", { url, ...errorMeta(e) }));
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
  const traceEnabled = isTraceEnabled(process.env);

  // Requirement: ensure destination directory exists before any move/copy.
  trace(logger, traceEnabled, "moveIntoPlace: start", {
    tmpPath,
    destPath,
    tmpPathLp: lp(tmpPath),
    destPathLp: lp(destPath),
  });
  await fs.mkdir(path.dirname(destPath), { recursive: true });
  await ensureParentDir(destPath);
  trace(logger, traceEnabled, "moveIntoPlace: ensured dest parent dir", { destPath, parent: path.dirname(destPath) });

  // Prefer atomic rename; fall back to copy+unlink on common Windows failures.
  try {
    await rmBestEffort(destPath);
    trace(logger, traceEnabled, "moveIntoPlace: rmBestEffort(destPath) done", { destPath });
    await fs.rename(lp(tmpPath), lp(destPath));
    trace(logger, traceEnabled, "moveIntoPlace: rename success", { tmpPath, destPath });
    return;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    trace(logger, traceEnabled, "moveIntoPlace: rename failed", { tmpPath, destPath, ...errorMeta(e) });
    const isPerm = msg.includes("EPERM") || msg.includes("operation not permitted");
    const isExdev = msg.includes("EXDEV");

    if (isPerm || isExdev) {
      // copyFile overwrites by default; then unlink temp.
      await fs.copyFile(lp(tmpPath), lp(destPath));
      trace(logger, traceEnabled, "moveIntoPlace: copyFile fallback success", { tmpPath, destPath });
      await rmBestEffort(tmpPath);
      trace(logger, traceEnabled, "moveIntoPlace: rmBestEffort(tmpPath) done", { tmpPath });
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
  const inflightKey = `${url}::${destPath}`;
  const existing = inFlight.get(inflightKey);
  if (existing) {
    // Note: avoid getLogger() here to keep log ordering stable (logger uses env to decide verbosity).
    const logger = getLogger();
    const traceEnabled = isTraceEnabled(process.env);
    trace(logger, traceEnabled, "downloadToFile: deduped (awaiting in-flight)", { url, destPath });
    return await existing;
  }

  const p = (async (): Promise<DownloadResult> => {
  const logger = getLogger();
  const traceEnabled = isTraceEnabled(process.env);
  const retries = opts.retries ?? 3;

  const tmpResolvedAtStart = getDownloadTempDir();
  trace(logger, traceEnabled, "downloadToFile: start", {
    url,
    destPath,
    destPathLp: lp(destPath),
    tmpDirSource: tmpResolvedAtStart.source,
    tmpDir: tmpResolvedAtStart.tmpDir,
    tmpDirLp: lp(tmpResolvedAtStart.tmpDir),
    expectedSize: opts.expectedSize,
    expectedSha1: opts.expectedSha1 ? `${opts.expectedSha1.slice(0, 8)}…` : undefined,
    retries,
    cwd: process.cwd(),
    pid: process.pid,
    node: process.version,
    platform: process.platform,
    appdata: process.env.APPDATA,
    localappdata: process.env.LOCALAPPDATA,
    tmpdir: os.tmpdir(),
  });

  const existingSize = await statSize(destPath);
  trace(logger, traceEnabled, "downloadToFile: existing dest stat", { destPath, existingSize });
  if (existingSize !== null && typeof opts.expectedSize === "number" && existingSize === opts.expectedSize) {
    if (opts.expectedSha1) {
      const actual = await sha1File(destPath);
      trace(logger, traceEnabled, "downloadToFile: existing dest sha1", {
        destPath,
        actual: `${actual.slice(0, 8)}…`,
        expected: `${opts.expectedSha1.slice(0, 8)}…`,
        match: actual.toLowerCase() === opts.expectedSha1.toLowerCase(),
      });
      if (actual.toLowerCase() === opts.expectedSha1.toLowerCase()) return { downloaded: false, bytes: 0 };
      // fall through to re-download
    } else {
      return { downloaded: false, bytes: 0 };
    }
  }

  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const attemptStarted = Date.now();
    trace(logger, traceEnabled, "downloadToFile: attempt start", { attempt, retries, url, destPath });
    // Requirement 1: Always ensure destination directory exists BEFORE any write.
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    trace(logger, traceEnabled, "downloadToFile: ensured dest dir", { destDir: path.dirname(destPath) });

    // Requirement 2: Do NOT create temp files inside the destination directory.
    // Use a dedicated MineAnvil dl folder under %LOCALAPPDATA% (Windows) or os.tmpdir().
    // Note: %APPDATA% is Roaming and is more likely to be protected by enterprise policies/AV.
    const tmpResolved = getDownloadTempDir();
    const tmpDir = tmpResolved.tmpDir;
    trace(logger, traceEnabled, "downloadToFile: tmp dir resolved", {
      tmpDirSource: tmpResolved.source,
      tmpDir,
      tmpDirLp: lp(tmpDir),
      localappdata: process.env.LOCALAPPDATA,
      appdata: process.env.APPDATA,
      tmpdir: os.tmpdir(),
    });
    await ensureDir(tmpDir);
    trace(logger, traceEnabled, "downloadToFile: ensured tmp dir", { tmpDir });

    const key = crypto.createHash("sha1").update(destPath).digest("hex").slice(0, 16);
    const tmpPath = path.join(tmpDir, `${key}-${process.pid}-${attempt}.part`);
    try {
      // Always download to a temp file to avoid leaving locked/corrupted partial files at destPath.
      // Be extra defensive: ensure tmp parent exists right before opening the stream.
      await ensureParentDir(tmpPath);
      trace(logger, traceEnabled, "downloadToFile: ensured tmp parent", { tmpPath, parent: path.dirname(tmpPath) });
      await rmBestEffort(tmpPath);
      trace(logger, traceEnabled, "downloadToFile: rmBestEffort(tmpPath) done", { tmpPath });
      let bytes: number;
      try {
        ({ bytes } = await downloadOnce(url, tmpPath));
      } catch (e) {
        // Some Windows setups (AV/indexers, or transient profile issues) can race temp dir creation.
        // If we fail to open the `.part` file with ENOENT, re-create the dir and retry once.
        if (isEnoentOpenForPath(e, tmpPath)) {
          logger.warn("temp open ENOENT; re-creating tmp dir and retrying once", { tmpDir, tmpPath });
          trace(logger, traceEnabled, "downloadToFile: temp open ENOENT caught", {
            attempt,
            tmpDir,
            tmpPath,
            ...errorMeta(e),
          });
          await ensureDir(tmpDir);
          trace(logger, traceEnabled, "downloadToFile: ensured tmp dir (retry)", { tmpDir });
          await ensureParentDir(tmpPath);
          trace(logger, traceEnabled, "downloadToFile: ensured tmp parent (retry)", { tmpPath });
          ({ bytes } = await downloadOnce(url, tmpPath));
        } else {
          trace(logger, traceEnabled, "downloadToFile: downloadOnce failed (non-ENOENT-open)", {
            attempt,
            url,
            tmpPath,
            ...errorMeta(e),
          });
          throw e;
        }
      }
      if (isVerboseEnabled(process.env)) logger.debug("download complete", { attempt, bytes });

      // Requirement 3: Verify SHA1 against expected before moving into place.
      if (opts.expectedSha1) {
        const shaStarted = Date.now();
        const actual = await sha1File(tmpPath);
        trace(logger, traceEnabled, "downloadToFile: tmp sha1 computed", {
          tmpPath,
          actual: `${actual.slice(0, 8)}…`,
          expected: `${opts.expectedSha1.slice(0, 8)}…`,
          ms: Date.now() - shaStarted,
        });
        if (actual.toLowerCase() !== opts.expectedSha1.toLowerCase()) {
          throw new Error("SHA1 mismatch");
        }
      }

      // Requirement 4: Windows-safe move into place (rename, fallback to copy+unlink).
      await moveIntoPlace(tmpPath, destPath, logger);
      trace(logger, traceEnabled, "downloadToFile: success", {
        attempt,
        url,
        destPath,
        bytes,
        ms: Date.now() - attemptStarted,
      });
      return { downloaded: true, bytes };
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      logger.warn("download attempt failed", { attempt, url, destPath, error: msg });
      trace(logger, traceEnabled, "downloadToFile: attempt failed", {
        attempt,
        url,
        destPath,
        tmpPath,
        ms: Date.now() - attemptStarted,
        ...errorMeta(e),
      });
      // best-effort cleanup temp + destination (destination could be left from older runs)
      await rmBestEffort(tmpPath);
      await rmBestEffort(destPath);
    }
  }

  throw new Error(`Download failed after ${retries} attempts: ${lastErr instanceof Error ? lastErr.message : "unknown"}`);
  })()
    .finally(() => {
      inFlight.delete(inflightKey);
    });

  inFlight.set(inflightKey, p);
  return await p;
}


