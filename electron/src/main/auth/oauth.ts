/**
 * Microsoft OAuth sign-in using:
 * - system browser (Electron shell.openExternal)
 * - loopback redirect on 127.0.0.1 with random free port
 * - PKCE (S256)
 *
 * Windows-only behavior begins here:
 * - This file imports `electron` and must only execute in Electron main.
 *
 * SECURITY NOTES:
 * - Do NOT log tokens. Only log token presence and expiry.
 * - Do NOT store tokens on disk yet.
 */

import { shell } from "electron";
import * as crypto from "node:crypto";
import * as http from "node:http";
import * as https from "node:https";
import { URL } from "node:url";
import { isVerboseEnabled, type Logger, createLogger, type LogEntry } from "../../shared/logging";
import { saveTokens, type StoredTokens } from "./tokenStore";
import { getMsClientId } from "../config";
import { REDIRECT_URI, waitForOAuthCallback } from "./loopback";

export interface AuthResult {
  readonly token_type: string;
  readonly expires_in: number;
  readonly access_token: string;
  readonly refresh_token?: string;
  readonly scope?: string;
  readonly accountHint?: string;
  readonly displayName?: string;
}

const OAUTH = {
  // Consumer tenant (placeholder; adjust later if needed)
  authorizeEndpoint: "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize",
  tokenEndpoint: "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",

  // Placeholder scopes for later Minecraft Java ownership work.
  scopes: ["openid", "profile", "offline_access"],
} as const;

function createConsoleSink(): (entry: LogEntry) => void {
  return (entry) => {
    // Keep output structured (JSON lines) without leaking secrets.
    const line = JSON.stringify(entry);
    if (entry.level === "error") console.error(line);
    else if (entry.level === "warn") console.warn(line);
    else if (entry.level === "info") console.info(line);
    else console.debug(line);
  };
}

function getLogger(): Logger {
  const verbose = isVerboseEnabled(process.env);
  return createLogger({ area: "auth.oauth", sink: createConsoleSink(), verbose });
}

function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export function generatePkceVerifier(): string {
  // RFC 7636: code_verifier length 43-128; use 32 bytes -> 43 chars in base64url.
  return base64UrlEncode(crypto.randomBytes(32));
}

export function generateState(): string {
  return base64UrlEncode(crypto.randomBytes(16));
}

export function generatePkceChallengeS256(verifier: string): string {
  const hash = crypto.createHash("sha256").update(verifier).digest();
  return base64UrlEncode(hash);
}

function formUrlEncode(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

async function postForm(url: string, params: Record<string, string>): Promise<unknown> {
  const body = formUrlEncode(params);
  const u = new URL(url);

  return await new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port ? Number(u.port) : undefined,
        path: `${u.pathname}${u.search}`,
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(Buffer.from(c)));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let json: unknown = undefined;
          try {
            json = JSON.parse(text) as unknown;
          } catch {
            json = undefined;
          }

          const ok = (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300;
          if (!ok) {
            const rec = (json ?? {}) as Record<string, unknown>;
            const err = typeof rec.error === "string" ? rec.error : "token_request_failed";
            const desc =
              typeof rec.error_description === "string"
                ? rec.error_description.slice(0, 200)
                : `HTTP ${res.statusCode ?? 0}`;
            reject(new Error(`${err}: ${desc}`));
            return;
          }

          resolve(json ?? {});
        });
      },
    );

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

/**
 * Refresh Microsoft access token using a refresh token.
 *
 * SECURITY:
 * - Never log tokens.
 */
export async function refreshMicrosoftAccessToken(params: {
  refreshToken: string;
}): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}> {
  const logger = getLogger();

  logger.info("refreshing microsoft access token", { hasRefreshToken: Boolean(params.refreshToken) });

  const tokenJson = (await postForm(OAUTH.tokenEndpoint, {
    client_id: getMsClientId(),
    grant_type: "refresh_token",
    refresh_token: params.refreshToken,
    scope: OAUTH.scopes.join(" "),
  })) as Record<string, unknown>;

  const access_token = typeof tokenJson.access_token === "string" ? tokenJson.access_token : "";
  const refresh_token = typeof tokenJson.refresh_token === "string" ? tokenJson.refresh_token : undefined;
  const expires_in = typeof tokenJson.expires_in === "number" ? tokenJson.expires_in : Number(tokenJson.expires_in);
  const token_type = typeof tokenJson.token_type === "string" ? tokenJson.token_type : "";
  const scope = typeof tokenJson.scope === "string" ? tokenJson.scope : undefined;

  if (!access_token || !token_type || !Number.isFinite(expires_in)) {
    logger.warn("refresh token response missing required fields", {
      hasAccessToken: Boolean(access_token),
      hasTokenType: Boolean(token_type),
      hasExpiresIn: Number.isFinite(expires_in),
    });
    throw new Error("Invalid refresh token response");
  }

  logger.info("microsoft token refresh success", {
    hasAccessToken: true,
    hasRefreshToken: Boolean(refresh_token),
    expiresIn: expires_in,
  });

  return { access_token, refresh_token, expires_in, token_type, scope };
}

/**
 * Start Microsoft sign-in flow.
 *
 * Returns an AuthResult containing tokens (DO NOT persist yet; DO NOT log tokens).
 */
export async function startMicrosoftSignIn(): Promise<AuthResult> {
  const logger = getLogger();
  const msClientId = getMsClientId();

  const verifier = generatePkceVerifier();
  const challenge = generatePkceChallengeS256(verifier);
  const state = generateState();
  // Start loopback listener FIRST. If it fails (EADDRINUSE), we do not open the browser.
  const callbackPromise = waitForOAuthCallback(state);

  try {
    const authorizeUrl = new URL(OAUTH.authorizeEndpoint);
    authorizeUrl.searchParams.set("client_id", msClientId);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authorizeUrl.searchParams.set("response_mode", "query");
    authorizeUrl.searchParams.set("scope", OAUTH.scopes.join(" "));
    authorizeUrl.searchParams.set("state", state);
    authorizeUrl.searchParams.set("code_challenge", challenge);
    authorizeUrl.searchParams.set("code_challenge_method", "S256");

    logger.info("opening system browser for oauth", { hasClientId: true, scopes: OAUTH.scopes });

    try {
      await shell.openExternal(authorizeUrl.toString());
    } catch (e) {
      logger.warn("shell.openExternal failed", { error: e instanceof Error ? e.message : String(e) });
      throw new Error("Failed to open system browser for sign-in");
    }

    const cb = await callbackPromise;

    logger.info("exchanging auth code for tokens", { hasCode: true });
    const tokenJson = (await postForm(OAUTH.tokenEndpoint, {
      client_id: msClientId,
      grant_type: "authorization_code",
      code: cb.code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
      scope: OAUTH.scopes.join(" "),
    })) as Record<string, unknown>;

    const access_token = typeof tokenJson.access_token === "string" ? tokenJson.access_token : "";
    const refresh_token = typeof tokenJson.refresh_token === "string" ? tokenJson.refresh_token : undefined;
    const expires_in = typeof tokenJson.expires_in === "number" ? tokenJson.expires_in : Number(tokenJson.expires_in);
    const token_type = typeof tokenJson.token_type === "string" ? tokenJson.token_type : "";
    const scope = typeof tokenJson.scope === "string" ? tokenJson.scope : undefined;

    if (!access_token || !token_type || !Number.isFinite(expires_in)) {
      logger.warn("token response missing required fields", {
        hasAccessToken: Boolean(access_token),
        hasTokenType: Boolean(token_type),
        hasExpiresIn: Number.isFinite(expires_in),
      });
      throw new Error("Invalid token response");
    }

    const obtainedAt = Date.now();
    const expiresAt = obtainedAt + expires_in * 1000 - 30_000; // 30s safety margin

    logger.info("oauth token exchange success", {
      hasAccessToken: true,
      hasRefreshToken: Boolean(refresh_token),
      expiresIn: expires_in,
      tokenType: token_type,
    });

    const stored: StoredTokens = {
      access_token,
      refresh_token: refresh_token ?? "",
      token_type,
      scope,
      obtained_at: obtainedAt,
      expires_at: expiresAt,
    };

    await saveTokens(stored);
    logger.info("tokens saved", { expires_at: expiresAt });
    if (isVerboseEnabled(process.env)) {
      logger.debug("token metadata", {
        hasAccessToken: true,
        hasRefreshToken: Boolean(refresh_token),
        expiresAt,
      });
    }

    return {
      token_type,
      expires_in,
      access_token,
      refresh_token,
      scope,
    };
  } finally {
    // loopback server closes itself after first callback
  }
}


