/**
 * Electron preload script.
 *
 * Windows-only behavior begins here:
 * - This file imports `electron` and executes in the preload context.
 *
 * Security requirements (per prompt):
 * - contextIsolation is enabled in BrowserWindow
 * - nodeIntegration is disabled
 * - sandbox is enabled
 *
 * Renderer compatibility:
 * - The renderer never imports from `electron`; it calls `window.mineanvil`.
 */

import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS, type MineAnvilApi } from "../shared/ipc-types";

const api: MineAnvilApi = {
  ping: async () => ipcRenderer.invoke(IPC_CHANNELS.ping),
  authGetStatus: async () => ipcRenderer.invoke(IPC_CHANNELS.authGetStatus),
  authSignIn: async () => ipcRenderer.invoke(IPC_CHANNELS.authSignIn),
  authSignOut: async () => ipcRenderer.invoke(IPC_CHANNELS.authSignOut),
  getLaunchPlan: async () => ipcRenderer.invoke(IPC_CHANNELS.getLaunchPlan),
  ensureRuntime: async () => ipcRenderer.invoke(IPC_CHANNELS.ensureRuntime),
  getRuntimeStatus: async () => ipcRenderer.invoke(IPC_CHANNELS.getRuntimeStatus),
};

contextBridge.exposeInMainWorld("mineanvil", api);


