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
import { IPC_CHANNELS, type RendererApi } from "../shared/ipc-types";

const api: RendererApi = {
  ping: async () => ipcRenderer.invoke(IPC_CHANNELS.ping),
};

contextBridge.exposeInMainWorld("mineanvil", api);


