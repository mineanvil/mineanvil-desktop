/**
 * Node-safe path resolver for MineAnvil scripts.
 * 
 * Provides the same path resolution as electron/src/main/paths.ts
 * but works in plain Node.js without Electron runtime.
 * 
 * Uses process.env.APPDATA on Windows, falls back to os.homedir().
 */

const os = require("node:os");
const path = require("node:path");

const DEFAULT_INSTANCE_ID = "default";

/**
 * Get the base data directory (equivalent to app.getPath("userData")).
 * On Windows: %APPDATA%\MineAnvil
 * On other platforms: ~/.config/MineAnvil (or similar)
 */
function getAppDataDir() {
  if (process.platform === "win32") {
    const appData = process.env.APPDATA;
    if (appData) {
      return path.join(appData, "MineAnvil");
    }
  }
  // Fallback to home directory
  const homeDir = os.homedir();
  if (process.platform === "darwin") {
    return path.join(homeDir, "Library", "Application Support", "MineAnvil");
  } else {
    // Linux and others
    return path.join(homeDir, ".config", "MineAnvil");
  }
}

/**
 * Get instance root directory.
 */
function getInstanceRoot(instanceId = DEFAULT_INSTANCE_ID) {
  return path.join(getAppDataDir(), "instances", instanceId);
}

/**
 * Get rollback directory for an instance.
 */
function getRollbackRoot(instanceId = DEFAULT_INSTANCE_ID) {
  return path.join(getInstanceRoot(instanceId), ".rollback");
}

/**
 * Get pack root directory for an instance.
 */
function getPackRoot(instanceId = DEFAULT_INSTANCE_ID) {
  return path.join(getInstanceRoot(instanceId), "pack");
}

/**
 * Get Minecraft directory for an instance.
 */
function getMinecraftDir(instanceId = DEFAULT_INSTANCE_ID) {
  return path.join(getInstanceRoot(instanceId), ".minecraft");
}

/**
 * Get staging directory for an instance.
 */
function getStagingDir(instanceId = DEFAULT_INSTANCE_ID) {
  return path.join(getInstanceRoot(instanceId), ".staging", "pack-install");
}

/**
 * Get quarantine directory for an instance.
 */
function getQuarantineDir(instanceId = DEFAULT_INSTANCE_ID) {
  return path.join(getInstanceRoot(instanceId), ".quarantine");
}

/**
 * Create a mock Electron app object that provides getPath("userData").
 * This can be set on global.__ELECTRON_APP_MOCK__ to make compiled
 * Electron code work in Node.js scripts.
 */
function createElectronAppMock() {
  const userData = getAppDataDir();
  return {
    getPath: (name) => {
      if (name === "userData") {
        return userData;
      }
      // For other paths, return reasonable defaults
      if (name === "temp") {
        return os.tmpdir();
      }
      if (name === "home") {
        return os.homedir();
      }
      // Default to userData for unknown paths
      return userData;
    },
    getName: () => "MineAnvil",
    setAppLogsPath: () => {},
  };
}

module.exports = {
  getAppDataDir,
  getInstanceRoot,
  getRollbackRoot,
  getPackRoot,
  getMinecraftDir,
  getStagingDir,
  getQuarantineDir,
  createElectronAppMock,
  DEFAULT_INSTANCE_ID,
};


