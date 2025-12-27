/**
 * Electron main process entrypoint.
 *
 * Windows-only behavior begins here:
 * - This file imports `electron` and must only run inside Electron on Windows.
 *
 * Renderer compatibility:
 * - The renderer remains a normal Vite web app; no renderer code changes here.
 */

import { app, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerIpcHandlers } from "./ipc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      // Required by prompt:
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,

      /**
       * IMPORTANT:
       * - This path must point to the *compiled* preload file at runtime.
       * - We keep it relative so there are no hard-coded machine paths.
       */
      preload: path.join(__dirname, "../preload/preload.js"),
    },
  });

  return win;
}

async function loadRenderer(win: BrowserWindow): Promise<void> {
  /**
   * When developing on Windows with Vite, you can set this env var to point
   * Electron at the dev server. We do not assume Electron runs on macOS.
   */
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;

  if (devServerUrl) {
    await win.loadURL(devServerUrl);
    return;
  }

  // Production build: load the Vite bundle from `dist/`.
  await win.loadFile(path.join(app.getAppPath(), "dist", "index.html"));
}

app.whenReady().then(async () => {
  registerIpcHandlers();

  const win = createMainWindow();
  await loadRenderer(win);

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const next = createMainWindow();
      await loadRenderer(next);
    }
  });
});

app.on("window-all-closed", () => {
  // Typical behavior: quit on close except on macOS.
  // This app is Windows-only for Electron, but we keep the convention.
  if (process.platform !== "darwin") app.quit();
});


