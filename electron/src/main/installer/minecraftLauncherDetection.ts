/**
 * Minecraft Launcher detection for Windows.
 * 
 * Checks for Minecraft Launcher presence using multiple methods:
 * - WinGet package list
 * - Standard executable locations
 * - Registry/appx package detection (if available)
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

// Note: Standard locations are checked dynamically in checkStandardLocations()

/**
 * Check if WinGet is available on the system.
 */
export async function isWinGetAvailable(): Promise<boolean> {
  try {
    await execAsync("winget --version");
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if Minecraft Launcher is installed via WinGet.
 */
export async function checkWinGetInstallation(): Promise<boolean> {
  try {
    const { stdout } = await execAsync('winget list --id Mojang.MinecraftLauncher --accept-source-agreements');
    return stdout.includes("Mojang.MinecraftLauncher");
  } catch {
    return false;
  }
}

/**
 * Check for Minecraft Launcher executable in standard locations.
 */
export async function checkStandardLocations(): Promise<boolean> {
  // Check WindowsApps (Microsoft Store)
  try {
    const windowsAppsPath = path.join(process.env.LOCALAPPDATA || "", "Microsoft", "WindowsApps");
    const entries = await fs.readdir(windowsAppsPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith("Microsoft.MinecraftUWP_")) {
        const launcherPath = path.join(windowsAppsPath, entry.name, "Minecraft.exe");
        try {
          await fs.access(launcherPath);
          return true;
        } catch {
          // Continue checking
        }
      }
    }
  } catch {
    // Continue to other checks
  }

  // Check Program Files locations
  const programFilesPaths = [
    path.join(process.env.PROGRAMFILES || "", "Minecraft Launcher", "MinecraftLauncher.exe"),
    path.join(process.env["PROGRAMFILES(X86)"] || "", "Minecraft Launcher", "MinecraftLauncher.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Programs", "Minecraft Launcher", "MinecraftLauncher.exe"),
  ];

  for (const launcherPath of programFilesPaths) {
    try {
      await fs.access(launcherPath);
      return true;
    } catch {
      // Continue checking
    }
  }

  return false;
}

/**
 * Detect if Minecraft Launcher is installed.
 * 
 * Uses multiple detection methods for reliability.
 */
export async function isMinecraftLauncherInstalled(): Promise<boolean> {
  // Prefer WinGet check if available
  const hasWinGet = await isWinGetAvailable();
  if (hasWinGet) {
    const installedViaWinGet = await checkWinGetInstallation();
    if (installedViaWinGet) {
      return true;
    }
  }

  // Fallback to standard location checks
  return await checkStandardLocations();
}

