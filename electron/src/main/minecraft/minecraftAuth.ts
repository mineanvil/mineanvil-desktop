/**
 * Minecraft authentication chain (Xbox Live -> XSTS -> Minecraft Services).
 *
 * Windows-only behavior begins here:
 * - This module is intended for Electron main on Windows runner.
 *
 * SECURITY:
 * - Never log tokens or Authorization headers.
 * - Verbose logging gated by MINEANVIL_DEBUG=1.
 */

import * as https from "node:https";
import { URL } from "node:url";
import { createLogger, isVerboseEnabled, type LogEntry, type Logger } from "../../shared/logging";

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
    area: "minecraft.auth",
    sink: createConsoleSink(),
    verbose: isVerboseEnabled(process.env),
  });
}

async function postJson<T>(params: {
  url: string;
  body: unknown;
  headers?: Record<string, string>;
  logger: Logger;
  endpointName: string;
}): Promise<T> {
  const u = new URL(params.url);
  const bodyText = JSON.stringify(params.body);

  return await new Promise<T>((resolve, reject) => {
    const req = https.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port ? Number(u.port) : undefined,
        path: `${u.pathname}${u.search}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(bodyText),
          ...(params.headers ?? {}),
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
            reject(new Error(`${params.endpointName} failed (HTTP ${status})`));
            return;
          }
          resolve(json as T);
        });
      },
    );
    req.on("error", reject);
    req.write(bodyText);
    req.end();
  });
}

export async function getMinecraftAccessToken(
  msAccessToken: string,
): Promise<{ mcAccessToken: string }> {
  const logger = getLogger();

  // A) XBL Authenticate
  const xbl = await postJson<{
    Token: string;
    DisplayClaims?: { xui?: Array<{ uhs?: string }> };
  }>({
    url: "https://user.auth.xboxlive.com/user/authenticate",
    endpointName: "xbl.authenticate",
    logger,
    headers: {
      Accept: "application/json",
      // Do NOT log this token.
    },
    body: {
      Properties: {
        AuthMethod: "RPS",
        SiteName: "user.auth.xboxlive.com",
        RpsTicket: `d=${msAccessToken}`,
      },
      RelyingParty: "http://auth.xboxlive.com",
      TokenType: "JWT",
    },
  });

  const xblToken = xbl.Token;
  const userHash = xbl.DisplayClaims?.xui?.[0]?.uhs;
  if (!xblToken || !userHash) {
    logger.warn("xbl response missing required fields", {
      hasXblToken: Boolean(xblToken),
      hasUserHash: Boolean(userHash),
    });
    throw new Error("XBL auth failed: missing token/userhash");
  }

  // B) XSTS Authorize
  const xsts = await postJson<{
    Token: string;
    DisplayClaims?: { xui?: Array<{ uhs?: string }> };
  }>({
    url: "https://xsts.auth.xboxlive.com/xsts/authorize",
    endpointName: "xsts.authorize",
    logger,
    headers: {
      Accept: "application/json",
    },
    body: {
      Properties: {
        SandboxId: "RETAIL",
        UserTokens: [xblToken],
      },
      RelyingParty: "rp://api.minecraftservices.com/",
      TokenType: "JWT",
    },
  });

  const xstsToken = xsts.Token;
  const xstsUserHash = xsts.DisplayClaims?.xui?.[0]?.uhs ?? userHash;
  if (!xstsToken || !xstsUserHash) {
    logger.warn("xsts response missing required fields", {
      hasXstsToken: Boolean(xstsToken),
      hasUserHash: Boolean(xstsUserHash),
    });
    throw new Error("XSTS auth failed: missing token/userhash");
  }

  // C) Minecraft Services login with xbox
  const mc = await postJson<{ access_token: string }>({
    url: "https://api.minecraftservices.com/authentication/login_with_xbox",
    endpointName: "mc.login_with_xbox",
    logger,
    headers: {
      Accept: "application/json",
    },
    body: {
      identityToken: `XBL3.0 x=${xstsUserHash};${xstsToken}`,
    },
  });

  if (!mc.access_token) {
    logger.warn("minecraft login response missing access_token", { ok: false });
    throw new Error("Minecraft login failed: missing access token");
  }

  logger.info("minecraft access token acquired", { ok: true });
  return { mcAccessToken: mc.access_token };
}



