/**
 * IPC registration for the Electron main process.
 *
 * Windows-only behavior begins here:
 * - This file imports `electron` and must only be executed in Electron main.
 */

import { ipcMain } from "electron";
import { IPC_CHANNELS } from "../shared/ipc-types";
import { startMicrosoftSignIn } from "./auth/oauth";

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.ping, async () => ({ ok: true, ts: Date.now() }));
  ipcMain.handle(IPC_CHANNELS.authGetStatus, async () => ({
    signedIn: false,
  }));
  ipcMain.handle(IPC_CHANNELS.authSignIn, async () => {
    try {
      await startMicrosoftSignIn();
      return { ok: true } as const;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg } as const;
    }
  });
}


