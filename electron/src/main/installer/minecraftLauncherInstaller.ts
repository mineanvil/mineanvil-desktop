/**
 * Minecraft Launcher installer module.
 * 
 * Handles installation via:
 * - WinGet (default)
 * - Official installer download (aka.ms) - fallback
 * - Microsoft Store deep-link (tertiary fallback)
 * - Legacy MSI (advanced, manual)
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { spawn } from "node:child_process";
import { shell } from "electron";
import * as https from "node:https";
import { URL } from "node:url";
import { createWriteStream } from "node:fs";
import { isMinecraftLauncherInstalled, isWinGetAvailable } from "./minecraftLauncherDetection";

// Official Microsoft installer URL (Windows 10/11)
const OFFICIAL_INSTALLER_URL_WIN10_11 = "https://aka.ms/minecraftClientGameCoreWindows";

export type InstallProgressState = "preparing" | "downloading" | "installing" | "verifying" | "complete" | "error";

export interface InstallProgress {
  state: InstallProgressState;
  message: string;
  error?: string;
}

export type InstallProgressCallback = (progress: InstallProgress) => void;

/**
 * Install Minecraft Launcher via WinGet.
 */
export async function installViaWinGet(
  onProgress: InstallProgressCallback,
): Promise<{ ok: boolean; error?: string }> {
  onProgress({ state: "preparing", message: "Checking system requirements..." });

  const hasWinGet = await isWinGetAvailable();
  if (!hasWinGet) {
    return { ok: false, error: "WinGet is not available on this system" };
  }

  onProgress({ state: "downloading", message: "Downloading Minecraft Launcher..." });

  return new Promise((resolve) => {
    const child = spawn(
      "winget",
      [
        "install",
        "-e",
        "--id",
        "Mojang.MinecraftLauncher",
        "--accept-source-agreements",
        "--accept-package-agreements",
      ],
      {
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data: Buffer) => {
      const text = data.toString("utf8");
      stdout += text;
      // Update progress based on WinGet output
      if (text.includes("Downloading") || text.includes("downloading")) {
        onProgress({ state: "downloading", message: "Downloading Minecraft Launcher..." });
      } else if (text.includes("Installing") || text.includes("installing")) {
        onProgress({ state: "installing", message: "Installing Minecraft Launcher..." });
      }
    });

    child.stderr?.on("data", (data: Buffer) => {
      const text = data.toString("utf8");
      stderr += text;
    });

    child.on("close", async (code) => {
      if (code !== 0) {
        const errorMsg = stderr || stdout || `WinGet installation failed with code ${code}`;
        onProgress({ state: "error", message: "Installation failed", error: errorMsg });
        resolve({ ok: false, error: errorMsg });
        return;
      }

      onProgress({ state: "verifying", message: "Verifying installation..." });

      // Wait a moment for installation to complete
      await new Promise((r) => setTimeout(r, 2000));

      // Check if launcher is now installed
      const installed = await isMinecraftLauncherInstalled();
      if (installed) {
        onProgress({ state: "complete", message: "Minecraft Launcher installed successfully" });
        resolve({ ok: true });
      } else {
        const errorMsg = "Installation completed but launcher was not detected";
        onProgress({ state: "error", message: "Installation verification failed", error: errorMsg });
        resolve({ ok: false, error: errorMsg });
      }
    });

    child.on("error", (err) => {
      const errorMsg = err.message || "Failed to start WinGet installation";
      onProgress({ state: "error", message: "Installation failed", error: errorMsg });
      resolve({ ok: false, error: errorMsg });
    });
  });
}

/**
 * Open Microsoft Store to Minecraft Launcher page.
 * 
 * Product ID for Minecraft Launcher: 9NBLGGH2JHXJ
 */
export async function openMicrosoftStore(): Promise<{ ok: boolean; error?: string }> {
  try {
    // Microsoft Store deep-link for Minecraft Launcher
    const storeUrl = "ms-windows-store://pdp/?ProductId=9NBLGGH2JHXJ";
    await shell.openExternal(storeUrl);
    return { ok: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Failed to open Microsoft Store";
    return { ok: false, error: errorMsg };
  }
}

/**
 * Download official installer from aka.ms with progress reporting.
 */
export async function downloadOfficialInstaller(
  onProgress: InstallProgressCallback,
): Promise<{ ok: boolean; installerPath?: string; error?: string }> {
  onProgress({ state: "preparing", message: "Preparing to download the official installer..." });

  // Determine which installer URL to use (Windows 10/11 vs legacy)
  // For now, prefer Windows 10/11 installer
  const installerUrl = OFFICIAL_INSTALLER_URL_WIN10_11;

  // Create temp directory for download
  const tempDir = path.join(os.tmpdir(), "mineanvil-installer");
  await fs.mkdir(tempDir, { recursive: true });
  const installerPath = path.join(tempDir, "MinecraftInstaller.msix");

  onProgress({ state: "downloading", message: "Downloading the official installer..." });

  return new Promise((resolve) => {
    const u = new URL(installerUrl);
    if (u.protocol !== "https:") {
      resolve({ ok: false, error: "Only HTTPS downloads are supported" });
      return;
    }

    const req = https.get(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port ? Number(u.port) : undefined,
        path: `${u.pathname}${u.search}`,
        headers: {
          "User-Agent": "MineAnvil/installer",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status < 200 || status >= 300) {
          res.resume();
          resolve({ ok: false, error: `Download failed (HTTP ${status})` });
          return;
        }

        const out = createWriteStream(installerPath);
        let bytes = 0;
        const contentLength = res.headers["content-length"] ? parseInt(res.headers["content-length"], 10) : null;

        res.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          // Update progress periodically (every 1MB or so)
          if (bytes % 1048576 < chunk.length) {
            const progressMsg = contentLength
              ? `Downloading the official installer... (${Math.round((bytes / contentLength) * 100)}%)`
              : "Downloading the official installer...";
            onProgress({ state: "downloading", message: progressMsg });
          }
        });

        res.pipe(out);

        out.on("finish", () => {
          out.close(() => {
            onProgress({ state: "downloading", message: "Download complete" });
            resolve({ ok: true, installerPath });
          });
        });

        out.on("error", (err) => {
          res.resume();
          resolve({ ok: false, error: err.message || "Download failed" });
        });
      },
    );

    req.on("error", (err) => {
      resolve({ ok: false, error: err.message || "Download failed" });
    });
  });
}

/**
 * Install downloaded official installer.
 */
export async function installDownloadedInstaller(
  installerPath: string,
  onProgress: InstallProgressCallback,
): Promise<{ ok: boolean; error?: string }> {
  onProgress({ state: "installing", message: "Opening the installer..." });

  return new Promise((resolve) => {
    // Open the installer (MSIX files open with Windows App Installer)
    shell.openPath(installerPath).then((error) => {
      if (error) {
        const errorMsg = `Failed to open installer: ${error}`;
        onProgress({ state: "error", message: "Installation failed", error: errorMsg });
        resolve({ ok: false, error: errorMsg });
        return;
      }

      // Wait a moment for installer to start
      setTimeout(async () => {
        onProgress({ state: "verifying", message: "Checking it was installed..." });

        // Poll for installation completion
        for (let attempt = 0; attempt < 120; attempt++) {
          await new Promise((r) => setTimeout(r, 2000));
          const installed = await isMinecraftLauncherInstalled();
          if (installed) {
            // Cleanup temp file
            try {
              await fs.rm(installerPath, { force: true });
            } catch {
              // Best-effort cleanup
            }
            onProgress({ state: "complete", message: "Minecraft Launcher installed successfully" });
            resolve({ ok: true });
            return;
          }
        }

        // Timeout - but don't hard-fail, installer may still be running
        const errorMsg = "Installation is taking longer than expected. The installer may still be running.";
        onProgress({ state: "error", message: "Installation verification timeout", error: errorMsg });
        resolve({ ok: false, error: errorMsg });
      }, 3000);
    });
  });
}

/**
 * Install via official installer download (aka.ms).
 */
export async function installViaOfficialDownload(
  onProgress: InstallProgressCallback,
): Promise<{ ok: boolean; error?: string }> {
  const downloadResult = await downloadOfficialInstaller(onProgress);
  if (!downloadResult.ok || !downloadResult.installerPath) {
    return { ok: false, error: downloadResult.error };
  }

  const installResult = await installDownloadedInstaller(downloadResult.installerPath, onProgress);

  // Cleanup temp file on failure
  if (!installResult.ok) {
    try {
      await fs.rm(downloadResult.installerPath, { force: true });
    } catch {
      // Best-effort cleanup
    }
  }

  return installResult;
}

/**
 * Poll for Minecraft Launcher installation completion (Store fallback).
 * Does not hard-fail; shows "Still waiting" message after timeout.
 */
export async function pollForInstallation(
  onProgress: InstallProgressCallback,
  maxAttempts: number = 60,
  intervalMs: number = 2000,
): Promise<{ ok: boolean; error?: string; stillWaiting?: boolean }> {
  onProgress({ state: "verifying", message: "Waiting for installation to complete..." });

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const installed = await isMinecraftLauncherInstalled();
    if (installed) {
      onProgress({ state: "complete", message: "Minecraft Launcher installed successfully" });
      return { ok: true };
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  // Timeout - but don't hard-fail
  onProgress({
    state: "verifying",
    message: "Still waiting for installation to complete...",
  });
  return { ok: false, error: "Installation is taking longer than expected", stillWaiting: true };
}

/**
 * Install via local installer file (.exe or .msi).
 * 
 * NOTE: This implementation uses a file picker approach since we cannot
 * reliably confirm official installer source URLs. The parent must select
 * the installer file manually.
 */
export async function installViaLocalInstaller(
  installerPath: string,
  onProgress: InstallProgressCallback,
): Promise<{ ok: boolean; error?: string; stillWaiting?: boolean }> {
  onProgress({ state: "preparing", message: "Preparing local installer..." });

  // Verify file exists
  try {
    await fs.access(installerPath);
  } catch {
    return { ok: false, error: "Installer file not found" };
  }

  const ext = path.extname(installerPath).toLowerCase();
  const isMsi = ext === ".msi";
  const isExe = ext === ".exe";

  if (!isMsi && !isExe) {
    return { ok: false, error: "Installer must be a .exe or .msi file" };
  }

  onProgress({ state: "installing", message: "Opening the installer..." });

  return new Promise((resolve) => {
    let child;

    if (isMsi) {
      // Run MSI installer interactively (not silent - requires user interaction)
      // DO NOT add /qn or any silent flag
      child = spawn("msiexec", ["/i", installerPath], {
        stdio: ["ignore", "pipe", "pipe"],
      });
    } else {
      // Run .exe installer interactively
      // Use shell: true to open with Windows default handler
      // detached: false to keep it attached to parent
      // stdio: "ignore" to avoid blocking
      child = spawn(installerPath, [], {
        shell: true,
        detached: false,
        stdio: "ignore",
      });
    }

    let stderr = "";

    if (child.stderr) {
      child.stderr.on("data", (data: Buffer) => {
        stderr += data.toString("utf8");
      });
    }

    child.on("close", async (code) => {
      // For .exe files launched with shell: true, we may not get a reliable exit code
      // So we treat any close as "started" and rely on detection re-check
      if (isExe) {
        // For .exe, assume it started successfully and poll for installation
        onProgress({ state: "verifying", message: "Waiting for installation to complete..." });
        
        // Poll for installation completion
        for (let attempt = 0; attempt < 60; attempt++) {
          await new Promise((r) => setTimeout(r, 2000));
          const installed = await isMinecraftLauncherInstalled();
          if (installed) {
            onProgress({ state: "complete", message: "Minecraft Launcher installed successfully" });
            resolve({ ok: true });
            return;
          }
        }

        // Timeout - but don't hard-fail, installer may still be running
        onProgress({ state: "verifying", message: "Still waiting for installation to complete..." });
        resolve({ ok: false, stillWaiting: true });
        return;
      }

      // For MSI, check exit code
      if (code !== 0) {
        // Exit codes 1605 and 1602 indicate user cancellation
        if (code === 1605 || code === 1602) {
          // User cancelled - return cleanly (no error, no failure)
          console.info(`Local MSI installer cancelled by user (exit code ${code})`);
          resolve({ ok: false });
          return;
        }
        const errorMsg = stderr || `MSI installation failed with code ${code}`;
        onProgress({ state: "error", message: "Installation failed", error: errorMsg });
        resolve({ ok: false, error: errorMsg });
        return;
      }

      onProgress({ state: "verifying", message: "Verifying installation..." });

      // Wait for installation to complete
      await new Promise((r) => setTimeout(r, 3000));

      const installed = await isMinecraftLauncherInstalled();
      if (installed) {
        onProgress({ state: "complete", message: "Minecraft Launcher installed successfully" });
        resolve({ ok: true });
      } else {
        const errorMsg = "Installation completed but launcher was not detected";
        onProgress({ state: "error", message: "Installation verification failed", error: errorMsg });
        resolve({ ok: false, error: errorMsg });
      }
    });

    child.on("error", (err) => {
      const errorMsg = err.message || `Failed to start ${isMsi ? "MSI" : "EXE"} installation`;
      onProgress({ state: "error", message: "Installation failed", error: errorMsg });
      resolve({ ok: false, error: errorMsg });
    });
  });
}

/**
 * Install via MSI (last resort, requires explicit confirmation).
 * 
 * @deprecated Use installViaLocalInstaller instead, which handles both .exe and .msi
 */
export async function installViaMSI(
  msiPath: string,
  onProgress: InstallProgressCallback,
): Promise<{ ok: boolean; error?: string }> {
  return installViaLocalInstaller(msiPath, onProgress);
}

/**
 * Main installation entry point.
 * 
 * Decision tree:
 * 1. WinGet (if available)
 * 2. Official installer download (aka.ms) - if WinGet fails
 * 3. Microsoft Store (tertiary fallback) - if download fails
 * 4. MSI (advanced, manual) - if explicitly requested
 */
export async function installMinecraftLauncher(
  onProgress: InstallProgressCallback,
  options?: {
    preferStore?: boolean;
    msiPath?: string;
  },
): Promise<{ ok: boolean; error?: string; usedMethod?: "winget" | "official" | "store" | "msi"; stillWaiting?: boolean }> {
  // If local installer path is provided, use it directly (explicit parent choice - advanced/manual)
  if (options?.msiPath) {
    const result = await installViaLocalInstaller(options.msiPath, onProgress);
    return { ...result, usedMethod: "msi" };
  }

  // If Store is explicitly preferred, skip to Store
  if (options?.preferStore) {
    const storeResult = await openMicrosoftStore();
    if (!storeResult.ok) {
      return { ok: false, error: storeResult.error };
    }
    const pollResult = await pollForInstallation(onProgress);
    return { ...pollResult, usedMethod: "store" };
  }

  // Try WinGet first
  const hasWinGet = await isWinGetAvailable();
  if (hasWinGet) {
    const wingetResult = await installViaWinGet(onProgress);
    if (wingetResult.ok) {
      return { ...wingetResult, usedMethod: "winget" };
    }
    // WinGet failed, fall back to official download
  }

  // Fallback to official installer download (aka.ms)
  onProgress({ state: "preparing", message: "We couldn't use the built-in installer. Trying the official installer..." });
  const officialResult = await installViaOfficialDownload(onProgress);
  if (officialResult.ok) {
    return { ...officialResult, usedMethod: "official" };
  }

  // Tertiary fallback to Store
  onProgress({ state: "preparing", message: "Opening Microsoft Store as an alternative..." });
  const storeResult = await openMicrosoftStore();
  if (!storeResult.ok) {
    return { ok: false, error: storeResult.error };
  }

  const pollResult = await pollForInstallation(onProgress);
  return { ...pollResult, usedMethod: "store" };
}

