/**
 * Electron main process entrypoint.
 *
 * Windows-only behavior begins here:
 * - This file imports `electron` and must only run inside Electron on Windows.
 *
 * Renderer compatibility:
 * - The renderer remains a normal Vite web app; no renderer code changes here.
 */

import { app, BrowserWindow, dialog } from "electron";
import * as path from "node:path";
import { createWriteStream } from "node:fs";
import * as fs from "node:fs/promises";
import { ensureDefaultInstanceDirs, logsDir as getLogsDir } from "./paths";
import { registerIpcHandlers } from "./ipc";
import { validateRequiredConfig } from "./config";
import { resolveAndValidateJavaAtStartup } from "./java";
import { loadOrCreatePackManifest } from "./pack/packManifestLoader";
import { loadOrGenerateLockfile } from "./pack/packLockfileLoader";
import { installFromLockfile } from "./install/deterministicInstaller";

// Ensure Electron uses a stable app name so `app.getPath("userData")` resolves to
// a predictable folder on Windows (e.g. %APPDATA%\MineAnvil).
// Must be set before any `app.getPath(...)` calls.
app.setName("MineAnvil");

function installConsoleFileTee(params: { logFilePath: string }): void {
  const stream = createWriteStream(params.logFilePath, { flags: "a" });

  const safeToText = (v: unknown): string => {
    if (typeof v === "string") return v;
    if (v instanceof Error) return `${v.name}: ${v.message}`;
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  };

  const writeLine = (args: unknown[]) => {
    try {
      const text = args.map(safeToText).join(" ");
      stream.write(text.endsWith("\n") ? text : `${text}\n`);
    } catch {
      // Best-effort; never crash the app due to logging.
    }
  };

  const orig = {
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug.bind(console),
    log: console.log.bind(console),
  };

  console.info = (...args: unknown[]) => {
    writeLine(args);
    orig.info(...args);
  };
  console.warn = (...args: unknown[]) => {
    writeLine(args);
    orig.warn(...args);
  };
  console.error = (...args: unknown[]) => {
    writeLine(args);
    orig.error(...args);
  };
  console.debug = (...args: unknown[]) => {
    writeLine(args);
    orig.debug(...args);
  };
  console.log = (...args: unknown[]) => {
    writeLine(args);
    orig.log(...args);
  };

  // Best-effort flush on exit.
  process.on("exit", () => {
    try {
      stream.end();
    } catch {
      // ignore
    }
  });
}

async function rotateLogIfTooLarge(params: {
  filePath: string;
  maxBytes: number;
  keep?: number;
}): Promise<void> {
  const keep = params.keep ?? 3;
  if (keep < 1) return;

  let size = 0;
  try {
    const st = await fs.stat(params.filePath);
    size = st.size;
  } catch {
    return;
  }
  if (size < params.maxBytes) return;

  // Shift: .(keep-1) -> .keep, then base -> .1
  try {
    await fs.rm(`${params.filePath}.${keep}`, { force: true });
  } catch {
    // ignore
  }
  for (let i = keep - 1; i >= 1; i--) {
    try {
      await fs.rename(`${params.filePath}.${i}`, `${params.filePath}.${i + 1}`);
    } catch {
      // ignore
    }
  }
  try {
    await fs.rename(params.filePath, `${params.filePath}.1`);
  } catch {
    // ignore
  }
}

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      // Required by prompt:
      contextIsolation: true,
      nodeIntegration: false,
      // NOTE: sandbox disabled so preload bridge (`window.mineanvil`) is visible in renderer.
      // We may re-enable sandbox later after hardening and verifying the bridge works reliably.
      sandbox: false,

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

  // Dev: default to local Vite port unless overridden.
  if (!app.isPackaged) {
    await win.loadURL(devServerUrl ?? "http://localhost:5173");
    return;
  }

  // Production build: load the Vite bundle from `dist/`.
  await win.loadFile(path.join(app.getAppPath(), "dist", "index.html"));
}

app.whenReady().then(async () => {
  // Instance Isolation: ensure controlled directories exist before anything else.
  try {
    await ensureDefaultInstanceDirs();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    dialog.showErrorBox(
      "MineAnvil — Instance Storage Error",
      `MineAnvil could not create its instance directories.\n\n${msg}`,
    );
    app.exit(1);
    return;
  }

  // Ensure main-process log output is persisted under instance logs directory.
  // NOTE: Do not log absolute paths.
  try {
    const logsRoot = getLogsDir();
    const logPath = path.join(logsRoot, "mineanvil-main.log");
    const rendererLogPath = path.join(logsRoot, "mineanvil-renderer.log");

    // Keep logs bounded across long-running usage while still persisting across runs.
    // Best-effort; never fail startup on rotation issues.
    await rotateLogIfTooLarge({ filePath: logPath, maxBytes: 5 * 1024 * 1024, keep: 3 });
    await rotateLogIfTooLarge({ filePath: rendererLogPath, maxBytes: 5 * 1024 * 1024, keep: 3 });
    installConsoleFileTee({ logFilePath: logPath });
  } catch {
    // Best-effort; do not fail startup if log file can't be opened.
  }

  const cfg = validateRequiredConfig();
  if (!cfg.ok) {
    const msg = cfg.message;
    dialog.showErrorBox("MineAnvil — Configuration Error", msg);
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "error",
        area: "startup",
        message: `startup aborted: ${msg}`,
      }),
    );
    app.exit(1);
    return;
  }

  const java = await resolveAndValidateJavaAtStartup(process.env);
  if (!java.ok) {
    const msg = java.message;
    dialog.showErrorBox("MineAnvil — Java Runtime Error", msg);
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "error",
        area: "startup",
        message: `startup aborted: ${msg}`,
      }),
    );
    app.exit(1);
    return;
  }

  // Log Java version only (never paths).
  console.info(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: "info",
      area: "startup",
      message: "java runtime validated",
      meta: {
        source: java.source,
        javaVersionMajor: java.javaVersionMajor,
        javaVersion: java.javaVersionRaw,
      },
    }),
  );

  // Pack Manifest: load or create the manifest as the authoritative source of truth.
  const manifest = await loadOrCreatePackManifest();
  if (!manifest.ok) {
    const msg = manifest.error;
    dialog.showErrorBox("MineAnvil — Pack Manifest Error", msg);
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "error",
        area: "startup",
        message: `startup aborted: ${msg}`,
      }),
    );
    app.exit(1);
    return;
  }

  // Log manifest loaded (without sensitive details).
  console.info(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: "info",
      area: "startup",
      message: "pack manifest loaded",
      meta: {
        manifestVersion: manifest.manifest.manifestVersion,
        instanceId: manifest.manifest.instanceId,
        createdAt: manifest.manifest.createdAt,
      },
    }),
  );

  // Deterministic Installation: load or generate lockfile, then install from it.
  // This is idempotent - re-running with the same lockfile produces no changes.
  if (manifest.manifest.minecraftVersion) {
    // Load or generate lockfile
    const lockfileResult = await loadOrGenerateLockfile(manifest.manifest);
    if (!lockfileResult.ok) {
      const msg = lockfileResult.error;
      dialog.showErrorBox("MineAnvil — Lockfile Error", msg);
      console.error(
        JSON.stringify({
          ts: new Date().toISOString(),
          level: "error",
          area: "startup",
          message: `lockfile operation failed: ${msg}`,
        }),
      );
      app.exit(1);
      return;
    }

    console.info(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "info",
        area: "startup",
        message: "pack lockfile loaded",
        meta: {
          minecraftVersion: lockfileResult.lockfile.minecraftVersion,
          artifactCount: lockfileResult.lockfile.artifacts.length,
          generatedAt: lockfileResult.lockfile.generatedAt,
        },
      }),
    );

    // Install from lockfile
    const installResult = await installFromLockfile(lockfileResult.lockfile);
    if (!installResult.ok) {
      const msg = installResult.error;
      dialog.showErrorBox("MineAnvil — Installation Error", msg);
      console.error(
        JSON.stringify({
          ts: new Date().toISOString(),
          level: "error",
          area: "startup",
          message: `deterministic installation failed: ${msg}`,
        }),
      );
      app.exit(1);
      return;
    }

    console.info(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "info",
        area: "startup",
        message: "deterministic installation completed",
        meta: {
          minecraftVersion: installResult.result.lockfile.minecraftVersion,
          installedCount: installResult.result.installedCount,
          verifiedCount: installResult.result.verifiedCount,
          skippedCount: installResult.result.skippedCount,
        },
      }),
    );
  } else {
    console.info(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "info",
        area: "startup",
        message: "pack manifest has no installation requirements, skipping deterministic install",
      }),
    );
  }

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


