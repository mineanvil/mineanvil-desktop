/**
 * IPC registration for the Electron main process.
 *
 * Windows-only behavior begins here:
 * - This file imports `electron` and must only be executed in Electron main.
 */

import { dialog, ipcMain } from "electron";
import { IPC_CHANNELS } from "../shared/ipc-types";
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

function ownershipBlockedUserMessage(): string {
  return [
    "Minecraft ownership could not be verified for this signed-in account.",
    "",
    "MineAnvil blocks launching unless the account owns Minecraft: Java Edition.",
    "",
    "Next steps:",
    "- Sign in with the Microsoft account that owns Minecraft: Java Edition",
    "- If you don't own it yet, purchase Minecraft: Java Edition and try again",
    "- Retry after a moment if this is a transient network issue",
  ].join("\n");
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
  if (!tokens) throw new Error("Signed out");

  const { mcAccessToken } = await getMinecraftAccessToken(tokens.access_token);
  const entitlements = await getEntitlements(mcAccessToken);
  const owned = checkJavaOwnership(entitlements);

  if (!owned.owned) {
    throw new Error(owned.reason ? `Ownership not verified: ${owned.reason}` : "Ownership not verified");
  }

  const profile = await getProfile(mcAccessToken);
  return { mcAccessToken, profile };
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

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.ping, async () => ({ ok: true, ts: Date.now() }));
  ipcMain.handle(IPC_CHANNELS.authGetStatus, async () => {
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

    // Microsoft tokens present and (now) valid.
    const status: {
      signedIn: true;
      expiresAt?: number;
      minecraftOwned?: boolean;
      displayName?: string;
      uuid?: string;
    } = {
      signedIn: true,
      expiresAt: tokens.expires_at,
    };

    try {
      const { mcAccessToken } = await getMinecraftAccessToken(tokens.access_token);
      const entitlements = await getEntitlements(mcAccessToken);
      const owned = checkJavaOwnership(entitlements);
      status.minecraftOwned = owned.owned;

      if (owned.owned) {
        const profile = await getProfile(mcAccessToken);
        status.displayName = profile.name;
        status.uuid = profile.id;
      }
    } catch {
      // Best-effort: keep signedIn true, but omit minecraft status if calls fail.
    }

    return status;
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
      } catch {
        const msg = ownershipBlockedUserMessage();
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
      } catch {
        const msg = ownershipBlockedUserMessage();
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
      } catch {
        const msg = ownershipBlockedUserMessage();
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


