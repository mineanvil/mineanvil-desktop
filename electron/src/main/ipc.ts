/**
 * IPC registration for the Electron main process.
 *
 * Windows-only behavior begins here:
 * - This file imports `electron` and must only be executed in Electron main.
 */

import { dialog, ipcMain } from "electron";
import { IPC_CHANNELS, type AuthStatus, type OwnershipState } from "../shared/ipc-types";
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
import { isVerboseEnabled } from "../shared/logging";
import { getMsClientId } from "./config";

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
      "- Retry later once MineAnvil is allow-listed",
    ].join("\n");
  }

  // UNVERIFIED_TEMPORARY (or unknown): keep user messaging conservative.
  return [
    "Minecraft ownership could not be verified for this signed-in account.",
    "",
    "MineAnvil blocks launching unless the account owns Minecraft: Java Edition.",
    "",
    "Next steps:",
    "- Sign in with the Microsoft account that owns Minecraft: Java Edition",
    "- If you don't own it yet, purchase Minecraft: Java Edition and try again",
    "- Retry after a moment (this may be a transient network/service issue)",
    "- Check internet connectivity",
  ].join("\n");
}

function ownershipGateMessageFromError(err: unknown): string {
  if (err instanceof OwnershipGateError) {
    return ownershipBlockedUserMessage({ signedIn: err.signedIn, ownershipState: err.ownershipState });
  }
  return ownershipBlockedUserMessage({ signedIn: true, ownershipState: classifyOwnershipStateFromError(err) });
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
        dialog.showErrorBox("MineAnvil Sign-in", msg);
        console.error(
          JSON.stringify({
            ts: new Date().toISOString(),
            level: "error",
            area: "ipc",
            message: msg,
          }),
        );
        return { ok: false, error: msg } as const;
      }

      await startMicrosoftSignIn();
      return { ok: true } as const;
    } catch (e) {
      const safe = safeErrorString(e);
      dialog.showErrorBox("MineAnvil Sign-in", safe.message);
      console.warn(
        JSON.stringify({
          ts: new Date().toISOString(),
          level: "warn",
          area: "ipc",
          message: "microsoft sign-in failed",
          meta: verbose ? safe.debug : { ...safe.debug, stack: undefined },
        }),
      );
      return { ok: false, error: safe.message } as const;
    }
  });
  ipcMain.handle(IPC_CHANNELS.authSignOut, async () => {
    try {
      await clearTokens();
      return { ok: true } as const;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg } as const;
    }
  });

  ipcMain.handle(IPC_CHANNELS.getLaunchPlan, async () => {
    try {
      const plan = await buildLaunchPlan();
      return { ok: true, plan } as const;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg } as const;
    }
  });

  ipcMain.handle(IPC_CHANNELS.ensureRuntime, async () => {
    try {
      const runtime = await resolveJavaRuntimePreferManaged();
      return { ok: true, runtime } as const;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg } as const;
    }
  });

  ipcMain.handle(IPC_CHANNELS.getRuntimeStatus, async () => {
    try {
      const status = await getManagedRuntimeStatus(DEFAULT_RUNTIME_MANIFEST);
      return { ok: true, installed: status.installed, runtime: status.runtime } as const;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, installed: false, error: msg } as const;
    }
  });

  ipcMain.handle(IPC_CHANNELS.installVanilla, async (_evt, version: string) => {
    try {
      // Hard gate: must own Minecraft: Java Edition.
      try {
        await requireOwnedMinecraftJava();
      } catch (e) {
        const msg = ownershipGateMessageFromError(e);
        dialog.showErrorBox("MineAnvil — Launch blocked", msg);
        return { ok: false, error: msg } as const;
      }

      const instance = await ensureDefaultInstance();
      const res = await ensureVanillaInstalled(instance.path, version);
      return { ok: true, versionId: res.versionId, notes: res.notes } as const;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg } as const;
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
        const msg = ownershipGateMessageFromError(e);
        dialog.showErrorBox("MineAnvil — Launch blocked", msg);
        return { ok: false, error: msg } as const;
      }

      const cmd = await buildVanillaLaunchCommand({ versionIdOrLatest: version, auth });
      const safeArgs = redactLaunchArgs(cmd.args);
      return { ok: true, command: { javaPath: cmd.javaPath, args: safeArgs, cwd: cmd.cwd } } as const;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg } as const;
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
        const msg = ownershipGateMessageFromError(e);
        dialog.showErrorBox("MineAnvil — Launch blocked", msg);
        return { ok: false, error: msg } as const;
      }

      const res = await launchVanilla({ versionIdOrLatest: version, auth });
      return res;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg } as const;
    }
  });
}


