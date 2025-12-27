/**
 * IPC registration for the Electron main process.
 *
 * Windows-only behavior begins here:
 * - This file imports `electron` and must only be executed in Electron main.
 */

import { ipcMain } from "electron";
import { IPC_CHANNELS } from "../shared/ipc-types";
import { refreshMicrosoftAccessToken, startMicrosoftSignIn } from "./auth/oauth";
import { clearTokens, loadTokens, saveTokens } from "./auth/tokenStore";
import { getMinecraftAccessToken } from "./minecraft/minecraftAuth";
import { checkJavaOwnership, getEntitlements, getProfile } from "./minecraft/minecraftServices";
import { buildLaunchPlan } from "./launch/dryrun";

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
      } catch {
        // Conservative: treat as signed out if refresh fails.
        return { signedIn: false, expiresAt: tokens.expires_at } as const;
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
    try {
      await startMicrosoftSignIn();
      return { ok: true } as const;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg } as const;
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
}


