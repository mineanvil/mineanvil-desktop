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
import { IPC_CHANNELS, type MineAnvilApi, type MinecraftLauncherInstallProgress } from "../shared/ipc-types";

const api: MineAnvilApi = {
  ping: async () => ipcRenderer.invoke(IPC_CHANNELS.ping),
  appendRendererLog: async (entry) => ipcRenderer.invoke(IPC_CHANNELS.appendRendererLog, entry),
  authGetStatus: async () => ipcRenderer.invoke(IPC_CHANNELS.authGetStatus),
  authSignIn: async () => ipcRenderer.invoke(IPC_CHANNELS.authSignIn),
  authSignOut: async () => ipcRenderer.invoke(IPC_CHANNELS.authSignOut),
  getLaunchPlan: async () => ipcRenderer.invoke(IPC_CHANNELS.getLaunchPlan),
  ensureRuntime: async () => ipcRenderer.invoke(IPC_CHANNELS.ensureRuntime),
  getRuntimeStatus: async () => ipcRenderer.invoke(IPC_CHANNELS.getRuntimeStatus),
  installVanilla: async (version: string) => ipcRenderer.invoke(IPC_CHANNELS.installVanilla, version),
  getLaunchCommand: async (version: string) => ipcRenderer.invoke(IPC_CHANNELS.getLaunchCommand, version),
  launchVanilla: async (version: string) => ipcRenderer.invoke(IPC_CHANNELS.launchVanilla, version),
  closeWindow: async () => ipcRenderer.invoke(IPC_CHANNELS.closeWindow),
  checkMinecraftLauncher: async () => ipcRenderer.invoke(IPC_CHANNELS.checkMinecraftLauncher),
  installMinecraftLauncher: async (options?: { preferStore?: boolean; msiPath?: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.installMinecraftLauncher, options),
  cancelMinecraftLauncherInstall: async () => ipcRenderer.invoke(IPC_CHANNELS.cancelMinecraftLauncherInstall),
  pickLocalInstaller: async () => ipcRenderer.invoke(IPC_CHANNELS.pickLocalInstaller),
};

contextBridge.exposeInMainWorld("mineanvil", api);

// Expose progress event listener helper
contextBridge.exposeInMainWorld("mineanvilInstallProgress", {
  onProgress: (callback: (progress: MinecraftLauncherInstallProgress) => void) => {
    ipcRenderer.on("mineanvil:installProgress", (_event, progress: MinecraftLauncherInstallProgress) => {
      callback(progress);
    });
  },
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners("mineanvil:installProgress");
  },
});


