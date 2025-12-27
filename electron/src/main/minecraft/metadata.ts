/**
 * Mojang/Piston metadata fetchers for vanilla Minecraft.
 *
 * Windows runner (Electron main) usage, but safe to import on other platforms.
 * No auth required.
 */

import * as https from "node:https";
import { URL } from "node:url";
import { createLogger, isVerboseEnabled, type LogEntry, type Logger } from "../../shared/logging";

export interface VersionManifest {
  latest: { release: string; snapshot: string };
  versions: Array<{ id: string; type: string; url: string; time: string; releaseTime: string }>;
}

// This is a large schema; we model only what we need.
export interface VersionJson {
  id: string;
  mainClass: string;
  assetIndex: { id: string; url: string; sha1?: string; size?: number };
  downloads: {
    client: { url: string; sha1?: string; size?: number };
  };
  libraries: Array<{
    name: string;
    rules?: Array<{ action: "allow" | "disallow"; os?: { name?: string } }>;
    downloads?: {
      artifact?: { path: string; url: string; sha1?: string; size?: number };
      classifiers?: Record<string, { path: string; url: string; sha1?: string; size?: number }>;
    };
    natives?: Record<string, string>;
    extract?: { exclude?: string[] };
  }>;
  arguments?: {
    game?: Array<string | { rules?: unknown; value: string | string[] }>;
    jvm?: Array<string | { rules?: unknown; value: string | string[] }>;
  };
  minecraftArguments?: string;
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
  return createLogger({
    area: "minecraft.metadata",
    sink: createConsoleSink(),
    verbose: isVerboseEnabled(process.env),
  });
}

async function getJson<T>(url: string): Promise<T> {
  const u = new URL(url);
  if (u.protocol !== "https:") throw new Error("Only https is supported");

  return await new Promise<T>((resolve, reject) => {
    const req = https.get(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port ? Number(u.port) : undefined,
        path: `${u.pathname}${u.search}`,
        headers: { Accept: "application/json" },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(Buffer.from(c)));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          if (status < 200 || status >= 300) {
            reject(new Error(`HTTP ${status} from ${u.hostname}`));
            return;
          }
          try {
            resolve(JSON.parse(text) as T);
          } catch (e) {
            reject(e);
          }
        });
      },
    );
    req.on("error", reject);
  });
}

export async function fetchVersionManifest(): Promise<VersionManifest> {
  const logger = getLogger();
  const url = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
  if (isVerboseEnabled(process.env)) logger.debug("fetching version manifest", { url });
  return await getJson<VersionManifest>(url);
}

export async function resolveVersion(
  versionIdOrLatest: string,
): Promise<{ versionId: string; versionJsonUrl: string }> {
  const manifest = await fetchVersionManifest();
  const wanted = versionIdOrLatest === "latest" ? manifest.latest.release : versionIdOrLatest;

  const found = manifest.versions.find((v) => v.id === wanted);
  if (!found) throw new Error(`Version not found: ${wanted}`);
  return { versionId: found.id, versionJsonUrl: found.url };
}

export async function fetchVersionJson(url: string): Promise<VersionJson> {
  const logger = getLogger();
  if (isVerboseEnabled(process.env)) logger.debug("fetching version json", { urlHost: new URL(url).hostname });
  return await getJson<VersionJson>(url);
}



