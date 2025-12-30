/**
 * Minecraft Services calls:
 * - Entitlements
 * - Profile
 *
 * SECURITY:
 * - Never log tokens or Authorization headers.
 * - Verbose logging gated by MINEANVIL_DEBUG=1.
 */

import * as https from "node:https";
import { URL } from "node:url";
import { createLogger, isVerboseEnabled, type LogEntry, type Logger } from "../../shared/logging";

class MinecraftHttpError extends Error {
  public readonly endpointName: string;
  public readonly status: number;

  public constructor(params: { endpointName: string; status: number }) {
    super(`${params.endpointName} failed (HTTP ${params.status})`);
    this.name = "MinecraftHttpError";
    this.endpointName = params.endpointName;
    this.status = params.status;
  }
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
    area: "minecraft.services",
    sink: createConsoleSink(),
    verbose: isVerboseEnabled(process.env),
  });
}

async function getJson<T>(params: {
  url: string;
  mcAccessToken: string;
  logger: Logger;
  endpointName: string;
}): Promise<T> {
  const u = new URL(params.url);

  return await new Promise<T>((resolve, reject) => {
    const req = https.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port ? Number(u.port) : undefined,
        path: `${u.pathname}${u.search}`,
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${params.mcAccessToken}`,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(Buffer.from(c)));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          const status = res.statusCode ?? 0;

          let json: unknown = undefined;
          try {
            json = JSON.parse(text) as unknown;
          } catch {
            json = undefined;
          }

          if (status === 401 || status === 403 || status === 429) {
            params.logger.warn("http request failed", { endpoint: params.endpointName, status });
          } else if (status < 200 || status >= 300) {
            params.logger.warn("http request failed", { endpoint: params.endpointName, status });
          } else if (isVerboseEnabled(process.env)) {
            params.logger.debug("http request ok", { endpoint: params.endpointName, status });
          }

          if (status < 200 || status >= 300) {
            reject(new MinecraftHttpError({ endpointName: params.endpointName, status }));
            return;
          }
          resolve(json as T);
        });
      },
    );

    req.on("error", reject);
    req.end();
  });
}

export async function getEntitlements(mcAccessToken: string): Promise<{ items: any[] }> {
  const logger = getLogger();
  return await getJson<{ items: any[] }>({
    url: "https://api.minecraftservices.com/entitlements/mcstore",
    mcAccessToken,
    logger,
    endpointName: "mc.entitlements",
  });
}

export async function getProfile(mcAccessToken: string): Promise<{ id: string; name: string }> {
  const logger = getLogger();
  return await getJson<{ id: string; name: string }>({
    url: "https://api.minecraftservices.com/minecraft/profile",
    mcAccessToken,
    logger,
    endpointName: "mc.profile",
  });
}

export function checkJavaOwnership(entitlements: unknown): { owned: boolean; reason?: string } {
  const logger = getLogger();

  const items = (entitlements as { items?: unknown }).items;
  if (!Array.isArray(items)) {
    if (isVerboseEnabled(process.env)) {
      logger.debug("unrecognized entitlements structure", { hasItemsArray: false });
    }
    return { owned: false, reason: "unrecognized entitlements structure" };
  }

  // Conservative heuristics: common item names for Java ownership in mcstore entitlements.
  const owned = items.some((it) => {
    if (!it || typeof it !== "object") return false;
    const rec = it as Record<string, unknown>;
    const name = typeof rec.name === "string" ? rec.name : "";
    const product = typeof rec.productName === "string" ? rec.productName : "";
    const signature = typeof rec.signature === "string" ? rec.signature : "";
    const combined = `${name} ${product} ${signature}`.toLowerCase();

    // Known identifiers in many launchers / responses.
    return combined.includes("game_minecraft") || combined.includes("product_minecraft");
  });

  return { owned };
}



