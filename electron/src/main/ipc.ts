/**
 * IPC registration for the Electron main process.
 *
 * Windows-only behavior begins here:
 * - This file imports `electron` and must only be executed in Electron main.
 */

import { dialog, ipcMain } from "electron";
import { createWriteStream, type WriteStream } from "node:fs";
import * as path from "node:path";
import {
  IPC_CHANNELS,
  type AuthStatus,
  type FailureCategory,
  type FailureInfo,
  type FailureKind,
  type OwnershipState,
} from "../shared/ipc-types";
import { refreshMicrosoftAccessToken, startMicrosoftSignIn } from "./auth/oauth";
import { clearTokens, loadTokens, saveTokens } from "./auth/tokenStore";
import { getMinecraftAccessToken } from "./minecraft/minecraftAuth";
import { checkJavaOwnership, getEntitlements, getProfile } from "./minecraft/minecraftServices";
import { buildLaunchPlan } from "./launch/dryrun";
import { resolveJavaRuntimePreferManaged } from "./runtime/runtime";
import { DEFAULT_RUNTIME_MANIFEST, getManagedRuntimeStatus } from "./runtime/managedRuntime";
import { ensureDefaultInstance } from "./instances/instances";
import { ensureVanillaInstalled } from "./minecraft/install";
import { buildVanillaLaunchCommand, launchVanilla } from "./minecraft/launch";
import { formatJsonLine, isVerboseEnabled, redactSecrets, type LogEntry } from "../shared/logging";
import { getMsClientId } from "./config";
import { logsDir as getLogsDir } from "./paths";

let rendererLogStream: WriteStream | null = null;

function ensureRendererLogStream(): WriteStream | null {
  if (rendererLogStream) return rendererLogStream;
  try {
    const logPath = path.join(getLogsDir(), "mineanvil-renderer.log");
    rendererLogStream = createWriteStream(logPath, { flags: "a" });
    process.on("exit", () => {
      try {
        rendererLogStream?.end();
      } catch {
        // ignore
      }
    });
    return rendererLogStream;
  } catch {
    return null;
  }
}

function appendRendererLogEntry(entry: LogEntry): void {
  const stream = ensureRendererLogStream();
  if (!stream) return;

  try {
    const safeEntry: LogEntry = {
      ...entry,
      meta: entry.meta ? (redactSecrets(entry.meta) as Record<string, unknown>) : undefined,
    };
    const line = formatJsonLine(safeEntry);
    stream.write(line.endsWith("\n") ? line : `${line}\n`);
  } catch {
    // Best-effort; never crash or block due to logging.
  }
}

function safeErrorString(err: unknown): { message: string; debug: Record<string, unknown> } {
  const verbose = isVerboseEnabled(process.env);

  const rec = err instanceof Error ? err : new Error(String(err));
  const anyErr = err as { code?: unknown; status?: unknown; stack?: unknown };

  const code = typeof anyErr?.code === "string" || typeof anyErr?.code === "number" ? anyErr.code : undefined;
  const status = typeof anyErr?.status === "number" ? anyErr.status : undefined;

  const msgParts = [`${rec.name}: ${rec.message}`];
  if (typeof status === "number") msgParts.push(`status=${status}`);
  if (code !== undefined) msgParts.push(`code=${String(code)}`);

  const debug: Record<string, unknown> = {
    name: rec.name,
    message: rec.message,
    ...(status !== undefined ? { status } : null),
    ...(code !== undefined ? { code } : null),
  };
  if (verbose && typeof anyErr?.stack === "string") debug.stack = anyErr.stack;

  return { message: msgParts.join(" "), debug };
}

function makeFailure(params: {
  category: FailureCategory;
  kind: FailureKind;
  userMessage: string;
  canRetry: boolean;
  debug?: Record<string, unknown>;
}): FailureInfo {
  return {
    category: params.category,
    kind: params.kind,
    userMessage: params.userMessage,
    canRetry: params.canRetry,
    ...(params.debug ? { debug: params.debug } : null),
  };
}

function looksLikeRuntimeFailure(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("managed runtime") ||
    m.includes("runtime") ||
    m.includes("java was not found") ||
    m.includes("path java failed") ||
    m.includes("java -version") ||
    m.includes("java executable") ||
    m.includes("checksum mismatch") ||
    m.includes("expand-archive") ||
    m.includes("java")
  );
}

function platformNotSupportedFailure(params: { area: FailureCategory; actionLabel: string }): FailureInfo {
  return makeFailure({
    category: params.area,
    kind: "PERMANENT",
    canRetry: false,
    userMessage: `${params.actionLabel} is only supported on Windows right now.`,
  });
}

function runtimeUserMessage(err: unknown): string {
  const safe = safeErrorString(err);
  const m = safe.message.toLowerCase();

  // Configuration issues: permanent, no retry
  if (m.includes("not configured") || m.includes("placeholder")) {
    return [
      "Java runtime is not configured yet. This is a MineAnvil setup issue.",
      "",
      "Next steps:",
      "- Contact support or check MineAnvil documentation",
    ].join("\n");
  }

  // Platform not supported: permanent, no retry
  if (m.includes("only supported on windows") || m.includes("windows runner")) {
    return [
      "Java runtime installation is only supported on Windows.",
      "",
      "Next steps:",
      "- Use MineAnvil on a Windows computer",
    ].join("\n");
  }

  // Checksum mismatch: temporary, retryable
  if (m.includes("checksum mismatch")) {
    return [
      "Downloaded Java runtime file is corrupted.",
      "",
      "Next steps:",
      "- Try again to download a fresh copy",
    ].join("\n");
  }

  // Download failures: temporary, retryable
  if (m.includes("download failed") || m.includes("http")) {
    return [
      "Could not download Java runtime. This may be a network issue.",
      "",
      "Next steps:",
      "- Check your internet connection",
      "- Try again",
    ].join("\n");
  }

  // Extraction failures: temporary, retryable
  if (m.includes("expand-archive") || m.includes("extract")) {
    return [
      "Could not extract Java runtime files.",
      "",
      "Next steps:",
      "- Try again",
      "- Check available disk space",
    ].join("\n");
  }

  // Installation incomplete: temporary, retryable
  if (m.includes("java executable not found") || m.includes("install incomplete")) {
    return [
      "Java runtime installation is incomplete.",
      "",
      "Next steps:",
      "- Try again to complete the installation",
    ].join("\n");
  }

  // Too many redirects: temporary, retryable
  if (m.includes("too many redirects")) {
    return [
      "Could not download Java runtime due to a network issue.",
      "",
      "Next steps:",
      "- Try again",
    ].join("\n");
  }

  // Generic runtime failure: temporary, retryable
  return [
    "Java runtime installation failed.",
    "",
    "Next steps:",
    "- Check your internet connection",
    "- Try again",
  ].join("\n");
}

function launchUserMessage(err: unknown): string {
  const safe = safeErrorString(err);
  const m = safe.message.toLowerCase();

  // Platform not supported: permanent, no retry
  if (m.includes("only supported on windows") || m.includes("windows runner")) {
    return [
      "Minecraft launching is only supported on Windows.",
      "",
      "Next steps:",
      "- Use MineAnvil on a Windows computer",
    ].join("\n");
  }

  // Version not found: permanent, no retry
  if (m.includes("version not found")) {
    return [
      "Minecraft version not found.",
      "",
      "Next steps:",
      "- Check the version name and try again",
      "- Use 'latest' to install the latest version",
    ].join("\n");
  }

  // Process start failure: temporary, retryable
  if (m.includes("failed to start java process") || m.includes("failed to start")) {
    return [
      "Could not start Minecraft.",
      "",
      "Next steps:",
      "- Try again",
      "- Check that Java runtime is installed",
    ].join("\n");
  }

  // Early exit: temporary, retryable
  if (m.includes("java exited early") || m.includes("exited early")) {
    return [
      "Minecraft stopped unexpectedly.",
      "",
      "Next steps:",
      "- Try again",
      "- Check the game logs for more details",
    ].join("\n");
  }

  // Generic launch failure: temporary, retryable
  return [
    "Minecraft launch failed.",
    "",
    "Next steps:",
    "- Try again",
    "- Check your internet connection if downloading",
  ].join("\n");
}

function isMinecraftHttpError(err: unknown): err is { endpointName: string; status: number } {
  if (!err || typeof err !== "object") return false;
  const rec = err as Record<string, unknown>;
  return typeof rec.endpointName === "string" && typeof rec.status === "number";
}

class OwnershipGateError extends Error {
  public readonly ownershipState?: OwnershipState;
  public readonly signedIn: boolean;

  public constructor(params: { signedIn: boolean; ownershipState?: OwnershipState; message: string }) {
    super(params.message);
    this.name = "OwnershipGateError";
    this.signedIn = params.signedIn;
    this.ownershipState = params.ownershipState;
  }
}

function classifyOwnershipStateFromError(err: unknown): OwnershipState {
  if (isMinecraftHttpError(err)) {
    // Mojang allow-list behavior: new third-party apps commonly get 403 on Minecraft services.
    if (err.status === 403 && err.endpointName.startsWith("mc.")) return "UNVERIFIED_APP_NOT_APPROVED";
    if (err.status === 429) return "UNVERIFIED_TEMPORARY";
    if (err.status === 401) return "UNVERIFIED_TEMPORARY";
    if (err.status >= 500) return "UNVERIFIED_TEMPORARY";
  }

  return "UNVERIFIED_TEMPORARY";
}

function ownershipBlockedUserMessage(params: { signedIn: boolean; ownershipState?: OwnershipState }): string {
  if (!params.signedIn) {
    return [
      "You are signed out.",
      "",
      "MineAnvil blocks launching unless you are signed in and ownership can be verified.",
      "",
      "Next steps:",
      "- Click Sign in",
      "- After signing in, retry the action",
    ].join("\n");
  }

  if (params.ownershipState === "NOT_OWNED") {
    return [
      "This Microsoft account does not appear to own Minecraft: Java Edition.",
      "",
      "MineAnvil blocks launching unless the signed-in account owns Minecraft: Java Edition.",
      "",
      "Next steps:",
      "- Sign in with the Microsoft account that owns Minecraft: Java Edition",
      "- If you don't own it yet, purchase Minecraft: Java Edition and try again",
    ].join("\n");
  }

  if (params.ownershipState === "UNVERIFIED_APP_NOT_APPROVED") {
    return [
      "MineAnvil could not verify Minecraft ownership because this app is not approved/allow-listed for Minecraft services yet.",
      "",
      "MineAnvil blocks launching unless ownership can be verified.",
      "",
      "Next steps:",
      "- Use the official Minecraft Launcher for now",
      "- Retrying in MineAnvil will not help until the app is allow-listed",
    ].join("\n");
  }

  // UNVERIFIED_TEMPORARY (or unknown): keep user messaging conservative.
  return [
    "Minecraft ownership could not be verified for this signed-in account.",
    "",
    "This may be a temporary network/service issue, or a sign-in session problem.",
    "",
    "Next steps:",
    "- Retry after a moment",
    "- Check internet connectivity",
    "- If it keeps failing, sign out and sign back in",
  ].join("\n");
}

function ownershipGateMessageFromError(err: unknown): string {
  if (err instanceof OwnershipGateError) {
    return ownershipBlockedUserMessage({ signedIn: err.signedIn, ownershipState: err.ownershipState });
  }
  return ownershipBlockedUserMessage({ signedIn: true, ownershipState: classifyOwnershipStateFromError(err) });
}

function isMinecraftAuthChainFailure(err: unknown): boolean {
  if (isMinecraftHttpError(err)) {
    return (
      err.endpointName.startsWith("xbl.") ||
      err.endpointName.startsWith("xsts.") ||
      err.endpointName === "mc.login_with_xbox"
    );
  }
  if (err instanceof Error) {
    const m = err.message.toLowerCase();
    return m.includes("xbl auth failed") || m.includes("xsts auth failed") || m.includes("minecraft login failed");
  }
  return false;
}

function minecraftAuthFailureFromError(err: unknown): FailureInfo {
  const safe = safeErrorString(err);
  return makeFailure({
    category: "AUTHENTICATION",
    kind: "TEMPORARY",
    canRetry: true,
    userMessage: [
      "Minecraft authentication failed while verifying ownership.",
      "",
      "Next steps:",
      "- Sign out and sign back in",
      "- Check internet connectivity",
      "- Retry the action",
    ].join("\n"),
    debug: safe.debug,
  });
}

function ownershipFailureFromError(err: unknown): FailureInfo {
  if (isMinecraftAuthChainFailure(err)) return minecraftAuthFailureFromError(err);
  const msg = ownershipGateMessageFromError(err);
  const state: OwnershipState | undefined =
    err instanceof OwnershipGateError ? err.ownershipState : classifyOwnershipStateFromError(err);
  const kind: FailureKind = state === "NOT_OWNED" || state === "UNVERIFIED_APP_NOT_APPROVED" ? "PERMANENT" : "TEMPORARY";
  return makeFailure({
    category: "OWNERSHIP",
    kind,
    canRetry: kind === "TEMPORARY",
    userMessage: msg,
  });
}

function authFailureFromError(err: unknown): FailureInfo {
  const safe = safeErrorString(err);
  const m = safe.message.toLowerCase();

  if (m.includes("safestorage") && m.includes("encryption is not available")) {
    return makeFailure({
      category: "AUTHENTICATION",
      kind: "PERMANENT",
      canRetry: false,
      userMessage: [
        "MineAnvil cannot save sign-in tokens because secure storage is not available on this system.",
        "",
        "This is required for sign-in. Please check your OS security/keychain settings and try again.",
      ].join("\n"),
      debug: safe.debug,
    });
  }

  // Local loopback / environment issues are usually actionable + retryable.
  if (m.includes("port 53682 is already in use")) {
    return makeFailure({
      category: "AUTHENTICATION",
      kind: "TEMPORARY",
      canRetry: true,
      userMessage: [
        "Sign-in could not start because the local callback port is already in use.",
        "",
        "Next steps:",
        "- Close any other MineAnvil instances or other apps using port 53682",
        "- Retry sign-in",
      ].join("\n"),
      debug: safe.debug,
    });
  }

  if (m.includes("access_denied")) {
    return makeFailure({
      category: "AUTHENTICATION",
      kind: "TEMPORARY",
      canRetry: true,
      userMessage: "Sign-in was cancelled.",
      debug: safe.debug,
    });
  }

  if (m.includes("failed to open system browser")) {
    return makeFailure({
      category: "AUTHENTICATION",
      kind: "TEMPORARY",
      canRetry: true,
      userMessage: [
        "MineAnvil could not open your system browser to complete sign-in.",
        "",
        "Next steps:",
        "- Check that a default browser is configured",
        "- Retry sign-in",
      ].join("\n"),
      debug: safe.debug,
    });
  }

  return makeFailure({
    category: "AUTHENTICATION",
    kind: "TEMPORARY",
    canRetry: true,
    userMessage: "Sign-in failed. Please retry.",
    debug: safe.debug,
  });
}

function runtimeFailureFromError(err: unknown): FailureInfo {
  const safe = safeErrorString(err);
  const m = safe.message.toLowerCase();

  // Very likely config / placeholder manifests: retry won't help.
  if (m.includes("not configured") || m.includes("placeholder")) {
    return makeFailure({
      category: "RUNTIME",
      kind: "PERMANENT",
      canRetry: false,
      userMessage: runtimeUserMessage(err),
      debug: safe.debug,
    });
  }

  // Unsupported platform or missing prerequisites: typically permanent for this machine.
  if (m.includes("only supported on windows") || m.includes("windows runner")) {
    return makeFailure({
      category: "RUNTIME",
      kind: "PERMANENT",
      canRetry: false,
      userMessage: runtimeUserMessage(err),
      debug: safe.debug,
    });
  }

  // Everything else: treat as temporary (download/network/filesystem may recover).
  return makeFailure({
    category: "RUNTIME",
    kind: "TEMPORARY",
    canRetry: true,
    userMessage: runtimeUserMessage(err),
    debug: safe.debug,
  });
}

function launchFailureFromError(err: unknown): FailureInfo {
  const safe = safeErrorString(err);
  const m = safe.message.toLowerCase();

  if (m.includes("only supported on windows") || m.includes("windows runner")) {
    return makeFailure({
      category: "LAUNCH",
      kind: "PERMANENT",
      canRetry: false,
      userMessage: launchUserMessage(err),
      debug: safe.debug,
    });
  }

  if (m.includes("version not found")) {
    return makeFailure({
      category: "LAUNCH",
      kind: "PERMANENT",
      canRetry: false,
      userMessage: launchUserMessage(err),
      debug: safe.debug,
    });
  }

  // Most launch failures are transient (download hiccups, extraction, java spawn); allow retry.
  return makeFailure({
    category: "LAUNCH",
    kind: "TEMPORARY",
    canRetry: true,
    userMessage: launchUserMessage(err),
    debug: safe.debug,
  });
}

async function loadValidMicrosoftTokens(): Promise<Awaited<ReturnType<typeof loadTokens>> | null> {
  let tokens = await loadTokens();
  if (!tokens) return null;

  const now = Date.now();
  if (tokens.expires_at <= now) {
    try {
      const refreshed = await refreshMicrosoftAccessToken({ refreshToken: tokens.refresh_token });
      const obtainedAt = Date.now();
      const expiresAt = obtainedAt + refreshed.expires_in * 1000 - 30_000;

      await saveTokens({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token ?? tokens.refresh_token,
        token_type: refreshed.token_type,
        scope: refreshed.scope,
        obtained_at: obtainedAt,
        expires_at: expiresAt,
      });

      tokens = await loadTokens();
      if (!tokens) return null;
    } catch {
      // Conservative: treat as signed out if refresh fails.
      return null;
    }
  }

  return tokens;
}

async function requireOwnedMinecraftJava(): Promise<{
  mcAccessToken: string;
  profile: { id: string; name: string };
}> {
  const tokens = await loadValidMicrosoftTokens();
  if (!tokens) {
    throw new OwnershipGateError({ signedIn: false, message: "Signed out" });
  }

  try {
    const { mcAccessToken } = await getMinecraftAccessToken(tokens.access_token);
    const entitlements = await getEntitlements(mcAccessToken);
    const owned = checkJavaOwnership(entitlements);

    if (!owned.owned) {
      const state: OwnershipState = owned.reason ? "UNVERIFIED_TEMPORARY" : "NOT_OWNED";
      throw new OwnershipGateError({
        signedIn: true,
        ownershipState: state,
        message: owned.reason ? `Ownership could not be verified: ${owned.reason}` : "Minecraft not owned",
      });
    }

    const profile = await getProfile(mcAccessToken);
    return { mcAccessToken, profile };
  } catch (e) {
    if (e instanceof OwnershipGateError) throw e;
    const state = classifyOwnershipStateFromError(e);
    throw new OwnershipGateError({ signedIn: true, ownershipState: state, message: "Ownership check failed" });
  }
}

function redactLaunchArgs(args: string[]): string[] {
  const out = [...args];
  for (let i = 0; i < out.length; i++) {
    if (out[i] === "--accessToken" && typeof out[i + 1] === "string") {
      out[i + 1] = "[REDACTED]";
      i++;
    }
  }
  return out;
}

let lastOwnershipCheckWarn: { key: string; ts: number } | null = null;

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.ping, async () => ({ ok: true, ts: Date.now() }));
  ipcMain.handle(IPC_CHANNELS.appendRendererLog, async (_evt, entry: LogEntry) => {
    appendRendererLogEntry(entry);
    return { ok: true } as const;
  });
  ipcMain.handle(IPC_CHANNELS.authGetStatus, async () => {
    const verbose = isVerboseEnabled(process.env);
    let tokens = await loadTokens();
    if (!tokens) return { signedIn: false } as const;

    const now = Date.now();
    if (tokens.expires_at <= now) {
      // Attempt refresh if possible.
      if (!tokens.refresh_token) {
        return { signedIn: false, expiresAt: tokens.expires_at } as const;
      }

      const prevExpiresAt = tokens.expires_at;

      try {
        const refreshed = await refreshMicrosoftAccessToken({ refreshToken: tokens.refresh_token });
        const obtainedAt = Date.now();
        const expiresAt = obtainedAt + refreshed.expires_in * 1000 - 30_000;

        await saveTokens({
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token ?? tokens.refresh_token,
          token_type: refreshed.token_type,
          scope: refreshed.scope,
          obtained_at: obtainedAt,
          expires_at: expiresAt,
        });

        tokens = await loadTokens();
        if (!tokens) return { signedIn: false } as const;
      } catch {
        // Conservative: treat as signed out if refresh fails.
        return { signedIn: false, expiresAt: prevExpiresAt } as const;
      }
    }

    try {
      const base: AuthStatus = {
        signedIn: true,
        expiresAt: tokens.expires_at,
        ownershipState: "UNVERIFIED_TEMPORARY",
        minecraftOwned: false,
      };

      const { mcAccessToken } = await getMinecraftAccessToken(tokens.access_token);
      const entitlements = await getEntitlements(mcAccessToken);
      const owned = checkJavaOwnership(entitlements);

      if (!owned.owned) {
        return {
          ...base,
          ownershipState: owned.reason ? "UNVERIFIED_TEMPORARY" : "NOT_OWNED",
          minecraftOwned: false,
        };
      }

      const profile = await getProfile(mcAccessToken);
      return {
        ...base,
        ownershipState: "OWNED",
        minecraftOwned: true,
        displayName: profile.name,
        uuid: profile.id,
      };
    } catch (e) {
      const ownershipState = classifyOwnershipStateFromError(e);

      // Never include tokens or raw HTTP responses. Dedupe to avoid log spam on frequent UI refresh.
      const safe = safeErrorString(e);
      const key = `${ownershipState}:${safe.message}`;
      const now = Date.now();
      if (!lastOwnershipCheckWarn || lastOwnershipCheckWarn.key !== key || now - lastOwnershipCheckWarn.ts > 15_000) {
        lastOwnershipCheckWarn = { key, ts: now };
        console.warn(
          JSON.stringify({
            ts: new Date().toISOString(),
            level: "warn",
            area: "ipc",
            message: "minecraft ownership/profile check failed",
            meta: verbose ? safe.debug : { ...safe.debug, stack: undefined },
          }),
        );
      }

      const status: AuthStatus = {
        signedIn: true,
        expiresAt: tokens.expires_at,
        ownershipState,
        minecraftOwned: false,
      };
      return status;
    }
  });
  ipcMain.handle(IPC_CHANNELS.authSignIn, async () => {
    const verbose = isVerboseEnabled(process.env);
    console.info(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "info",
        area: "ipc",
        message: "starting microsoft sign-in",
      }),
    );
    try {
      // Fail-fast for missing configuration. Do not open browser.
      try {
        void getMsClientId();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const failure = makeFailure({
          category: "AUTHENTICATION",
          kind: "PERMANENT",
          canRetry: false,
          userMessage: msg,
        });
        dialog.showErrorBox("MineAnvil Sign-in", msg);
        console.error(
          JSON.stringify({
            ts: new Date().toISOString(),
            level: "error",
            area: "ipc",
            message: msg,
          }),
        );
        return { ok: false, error: msg, failure } as const;
      }

      await startMicrosoftSignIn();
      return { ok: true } as const;
    } catch (e) {
      const failure = authFailureFromError(e);
      dialog.showErrorBox("MineAnvil Sign-in", failure.userMessage);
      console.warn(
        JSON.stringify({
          ts: new Date().toISOString(),
          level: "warn",
          area: "ipc",
          message: "microsoft sign-in failed",
          meta: verbose ? failure.debug : { ...(failure.debug ?? {}), stack: undefined },
        }),
      );
      return { ok: false, error: failure.userMessage, failure } as const;
    }
  });
  ipcMain.handle(IPC_CHANNELS.authSignOut, async () => {
    try {
      await clearTokens();
      return { ok: true } as const;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const failure = makeFailure({
        category: "AUTHENTICATION",
        kind: "TEMPORARY",
        canRetry: true,
        userMessage: msg,
        debug: safeErrorString(e).debug,
      });
      return { ok: false, error: msg, failure } as const;
    }
  });

  ipcMain.handle(IPC_CHANNELS.getLaunchPlan, async () => {
    try {
      const plan = await buildLaunchPlan();
      return { ok: true, plan } as const;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const failure = looksLikeRuntimeFailure(msg) ? runtimeFailureFromError(e) : launchFailureFromError(e);
      return { ok: false, error: msg, failure } as const;
    }
  });

  ipcMain.handle(IPC_CHANNELS.ensureRuntime, async () => {
    try {
      const runtime = await resolveJavaRuntimePreferManaged();
      return { ok: true, runtime } as const;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const failure =
        typeof msg === "string" && msg.toLowerCase().includes("only supported on windows")
          ? platformNotSupportedFailure({ area: "RUNTIME", actionLabel: "Runtime install" })
          : runtimeFailureFromError(e);
      return { ok: false, error: msg, failure } as const;
    }
  });

  ipcMain.handle(IPC_CHANNELS.getRuntimeStatus, async () => {
    try {
      const status = await getManagedRuntimeStatus(DEFAULT_RUNTIME_MANIFEST);
      return { ok: true, installed: status.installed, runtime: status.runtime } as const;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const failure = runtimeFailureFromError(e);
      return { ok: false, installed: false, error: msg, failure } as const;
    }
  });

  ipcMain.handle(IPC_CHANNELS.installVanilla, async (_evt, version: string) => {
    try {
      // Hard gate: must own Minecraft: Java Edition.
      try {
        await requireOwnedMinecraftJava();
      } catch (e) {
        const failure = ownershipFailureFromError(e);
        dialog.showErrorBox("MineAnvil — Launch blocked", failure.userMessage);
        return { ok: false, error: failure.userMessage, failure } as const;
      }

      const instance = await ensureDefaultInstance();
      const res = await ensureVanillaInstalled(instance.path, version);
      return { ok: true, versionId: res.versionId, notes: res.notes } as const;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const failure = looksLikeRuntimeFailure(msg) ? runtimeFailureFromError(e) : launchFailureFromError(e);
      return { ok: false, error: msg, failure } as const;
    }
  });

  ipcMain.handle(IPC_CHANNELS.getLaunchCommand, async (_evt, version: string) => {
    try {
      let auth:
        | { playerName: string; uuid: string; mcAccessToken: string }
        | undefined = undefined;

      // Best-effort: try to provide a "real" launch command without exposing secrets.
      // If ownership cannot be verified, block (hard gate) rather than returning a stub that could be mistaken as real.
      try {
        const owned = await requireOwnedMinecraftJava();
        auth = {
          playerName: owned.profile.name,
          uuid: owned.profile.id,
          mcAccessToken: owned.mcAccessToken,
        };
      } catch (e) {
        const failure = ownershipFailureFromError(e);
        dialog.showErrorBox("MineAnvil — Launch blocked", failure.userMessage);
        return { ok: false, error: failure.userMessage, failure } as const;
      }

      const cmd = await buildVanillaLaunchCommand({ versionIdOrLatest: version, auth });
      const safeArgs = redactLaunchArgs(cmd.args);
      return { ok: true, command: { javaPath: cmd.javaPath, args: safeArgs, cwd: cmd.cwd } } as const;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const failure = looksLikeRuntimeFailure(msg) ? runtimeFailureFromError(e) : launchFailureFromError(e);
      return { ok: false, error: msg, failure } as const;
    }
  });

  ipcMain.handle(IPC_CHANNELS.launchVanilla, async (_evt, version: string) => {
    try {
      let auth:
        | { playerName: string; uuid: string; mcAccessToken: string }
        | undefined = undefined;

      try {
        const owned = await requireOwnedMinecraftJava();
        auth = {
          playerName: owned.profile.name,
          uuid: owned.profile.id,
          mcAccessToken: owned.mcAccessToken,
        };
      } catch (e) {
        const failure = ownershipFailureFromError(e);
        dialog.showErrorBox("MineAnvil — Launch blocked", failure.userMessage);
        return { ok: false, error: failure.userMessage, failure } as const;
      }

      const res = await launchVanilla({ versionIdOrLatest: version, auth });
      if (res.ok) return res;

      const msg = res.error ?? "Launch failed";
      const failure = looksLikeRuntimeFailure(msg) ? runtimeFailureFromError(new Error(msg)) : launchFailureFromError(new Error(msg));
      return { ...res, failure } as const;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const failure = looksLikeRuntimeFailure(msg) ? runtimeFailureFromError(e) : launchFailureFromError(e);
      return { ok: false, error: msg, failure } as const;
    }
  });
}


