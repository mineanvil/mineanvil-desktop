/**
 * Vanilla Minecraft launch command builder + launcher (Electron main, Windows x64).
 *
 * For now:
 * - Uses placeholder auth args (accessToken="0", uuid placeholder)
 * - Uses managed runtime preferred (P12), fallback to PATH java
 *
 * SECURITY:
 * - Never log tokens (we use placeholder token "0" for now).
 */

import * as fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import * as path from "node:path";
import { spawn } from "node:child_process";
import { ensureDefaultInstance } from "../instances/instances";
import { resolveJavaForMinecraftVersion } from "../runtime/javaSelection";
import { ensureVanillaInstalled } from "./install";
import type { VersionJson } from "./metadata";
import { MS_CLIENT_ID } from "../../shared/generated/msClientId";

export interface LaunchSummary {
  readonly versionId: string;
  readonly classpathEntries: number;
  readonly notes: string[];
}

export async function buildVanillaLaunchCommand(params: {
  versionIdOrLatest: string;
  /**
   * Real Minecraft auth context.
   *
   * SECURITY:
   * - Never return tokens to the renderer (IPC must redact if displaying args).
   */
  auth?: { playerName: string; uuid: string; mcAccessToken: string };
  /**
   * Launch mode: "normal" (default) or "demo".
   * Demo mode preserves --demo flag, normal mode removes it.
   */
  launchMode?: "normal" | "demo";
}): Promise<{
  javaPath: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  summary: LaunchSummary;
}> {
  if (process.platform !== "win32") {
    throw new Error("Vanilla launching is currently supported on Windows runner only");
  }

  const launchMode = params.launchMode ?? "normal";

  const instance = await ensureDefaultInstance();
  const mcDir = path.join(instance.path, ".minecraft");

  const install = await ensureVanillaInstalled(instance.path, params.versionIdOrLatest);
  const versionId = install.versionId;

  const versionJsonPath = path.join(mcDir, "versions", versionId, `${versionId}.json`);
  const versionRaw = await fs.readFile(versionJsonPath, { encoding: "utf8" });
  const versionJson = JSON.parse(versionRaw) as VersionJson;

  // SP1.7: Resolve Java based on Minecraft version
  const javaResolution = await resolveJavaForMinecraftVersion(versionId);
  if (!javaResolution.javaPath) {
    throw new Error(
      `No Java ${javaResolution.major} runtime available for Minecraft ${versionId}. ` +
        `Reinstall MineAnvil or set MINEANVIL_JAVA_PATH to a Java ${javaResolution.major} installation.`,
    );
  }
  const javaPath = javaResolution.javaPath;

  // Build library classpath from version json
  const libsDir = path.join(mcDir, "libraries");
  const cp: string[] = [];

  for (const lib of versionJson.libraries) {
    // We only handle Windows selection here.
    const rules = lib.rules;
    if (rules && rules.length > 0) {
      let allowed = false;
      for (const r of rules) {
        const matches = !r.os?.name || r.os.name === "windows";
        if (matches) allowed = r.action === "allow";
      }
      if (!allowed) continue;
    }

    const artifact = lib.downloads?.artifact;
    if (artifact?.path) {
      cp.push(path.join(libsDir, artifact.path));
    }
  }

  // Add client jar
  cp.push(path.join(mcDir, "versions", versionId, `${versionId}.jar`));

  const cpSep = ";";
  const classpath = cp.join(cpSep);

  const auth = params.auth;
  const playerName = auth?.playerName ?? "Player";
  const uuid = auth?.uuid ?? "00000000-0000-0000-0000-000000000000";
  const accessToken = auth?.mcAccessToken ?? "0";

  const substitutions: Record<string, string> = {
    "${natives_directory}": install.nativesDir,
    "${launcher_name}": "MineAnvil",
    "${launcher_version}": "dev",
    "${classpath}": classpath,
    "${library_directory}": libsDir,
    "${game_directory}": mcDir,
    "${assets_root}": path.join(mcDir, "assets"),
    "${assets_index_name}": install.assetIndexId,
    "${auth_player_name}": playerName,
    "${version_name}": versionId,
    "${auth_uuid}": uuid,
    "${auth_access_token}": accessToken,
    "${user_type}": "msa",
    "${clientid}": MS_CLIENT_ID,
    "${auth_xuid}": "", // XUID not available in current auth flow
    "${version_type}": "release",
    "${resolution_width}": "854",
    "${resolution_height}": "480",
    "${quickPlayPath}": "",
    "${quickPlaySingleplayer}": "",
    "${quickPlayMultiplayer}": "",
    "${quickPlayRealms}": "",
  };

  const applySub = (s: string): string => {
    let out = s;
    for (const [k, v] of Object.entries(substitutions)) out = out.split(k).join(v);
    return out;
  };

  const flattenArgs = (arr: Array<string | { value: string | string[] }>): string[] => {
    const out: string[] = [];
    for (const a of arr) {
      if (typeof a === "string") out.push(applySub(a));
      else {
        const v = a.value;
        if (Array.isArray(v)) out.push(...v.map(applySub));
        else out.push(applySub(v));
      }
    }
    return out;
  };

  const jvmArgsFromJson = (() => {
    const jvm = versionJson.arguments?.jvm;
    if (!jvm) return [] as string[];
    // Ignore rules for now; treat all as included.
    const allArgs = flattenArgs(jvm.map((x) => (typeof x === "string" ? x : { value: x.value as any })));
    // Filter out macOS-specific options on Windows
    if (process.platform === "win32") {
      return allArgs.filter((arg) => arg !== "-XstartOnFirstThread");
    }
    return allArgs;
  })();

  const gameArgsFromJson = (() => {
    const game = versionJson.arguments?.game;
    if (!game) return [] as string[];
    return flattenArgs(game.map((x) => (typeof x === "string" ? x : { value: x.value as any })));
  })();

  const legacyGameArgs = (() => {
    const s = versionJson.minecraftArguments;
    if (!s) return [] as string[];
    // Minimal split; good enough for common legacy args.
    return s.split(/\s+/g).filter(Boolean).map(applySub);
  })();

  const jvmArgs: string[] = [
    "-Xmx2G",
    "-Xms512M",
    `-Djava.library.path=${install.nativesDir}`,
    ...jvmArgsFromJson,
    "-cp",
    classpath,
    versionJson.mainClass,
  ];

  // Build game args: use JSON args if available, otherwise legacy args
  // Modern versions (>= 1.13) use arguments.game and already include all required args
  // Legacy versions use minecraftArguments string which may need supplementation
  const gameArgs: string[] = gameArgsFromJson.length > 0 ? gameArgsFromJson : [
    ...legacyGameArgs,
    // For legacy versions, ensure required args are present
    "--username",
    playerName,
    "--version",
    versionId,
    "--gameDir",
    mcDir,
    "--assetsDir",
    path.join(mcDir, "assets"),
    "--assetIndex",
    install.assetIndexId,
    "--uuid",
    substitutions["${auth_uuid}"],
    "--accessToken",
    substitutions["${auth_access_token}"],
    "--userType",
    substitutions["${user_type}"],
  ];

  let args = [...jvmArgs, ...gameArgs];

  // Final placeholder expansion pass: catch any remaining ${...} tokens
  args = args.map((arg) => {
    let result = arg;
    for (const [placeholder, value] of Object.entries(substitutions)) {
      result = result.split(placeholder).join(value);
    }
    return result;
  });

  // Remove quickPlay, xuid, and demo flags with empty values to prevent issues
  // - Minecraft crashes if multiple quickPlay flags are present, even with empty values
  // - --demo triggers "buy Minecraft" flow even if account owns the game (only remove in normal mode)
  const flagsToRemoveIfEmpty = [
    "--quickPlaySingleplayer",
    "--quickPlayMultiplayer",
    "--quickPlayRealms",
    "--quickPlayPath",
    "--xuid",
  ];

  const filteredArgs: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (flagsToRemoveIfEmpty.includes(arg)) {
      const nextArg = args[i + 1];
      // If next arg exists and is empty string, skip both flag and value
      if (nextArg !== undefined && nextArg === "") {
        i++; // Skip the next arg (the empty value)
        continue; // Skip this flag
      }
    }
    // For --demo specifically, remove only in normal mode
    if (arg === "--demo" && launchMode === "normal") {
      // Check if next arg is empty string and skip both if so
      const nextArg = args[i + 1];
      if (nextArg !== undefined && nextArg === "") {
        i++; // Skip the next arg (the empty value)
      }
      continue; // Skip the demo flag
    }
    filteredArgs.push(arg);
  }
  args = filteredArgs;

  // Dev-only validation: check for duplicates and unexpanded placeholders
  if (process.env.NODE_ENV !== "production") {
    const singleValueFlags = [
      "--version",
      "--gameDir",
      "--assetsDir",
      "--assetIndex",
      "--uuid",
      "--accessToken",
      "--userType",
      "--username",
      "--demo",
    ];

    for (const flag of singleValueFlags) {
      const count = args.filter((a) => a === flag).length;
      if (count > 1) {
        throw new Error(
          `Launch args validation failed: flag ${flag} appears ${count} times (expected at most 1)`,
        );
      }
    }

    const unexpandedArgs = args.filter((a) => a.includes("${"));
    if (unexpandedArgs.length > 0) {
      throw new Error(
        `Launch args validation failed: unexpanded placeholders found: ${unexpandedArgs.join(", ")}`,
      );
    }
  }

  return {
    javaPath,
    args,
    cwd: mcDir,
    env: {},
    summary: {
      versionId,
      classpathEntries: cp.length,
      notes: [...install.notes],
    },
  };
}

export async function launchVanilla(params: {
  versionIdOrLatest: string;
  auth?: { playerName: string; uuid: string; mcAccessToken: string };
  launchMode?: "normal" | "demo";
}): Promise<{ ok: boolean; pid?: number; error?: string }> {
  try {
    const cmd = await buildVanillaLaunchCommand({
      versionIdOrLatest: params.versionIdOrLatest,
      auth: params.auth,
      launchMode: params.launchMode,
    });

    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const logDir = path.join(cmd.cwd, "logs");
    await fs.mkdir(logDir, { recursive: true });
    const logPath = path.join(logDir, `mineanvil-launch-${ts}.log`);

    const out = createWriteStream(logPath, { flags: "a" });

    const lastLines: string[] = [];
    const pushLine = (line: string) => {
      lastLines.push(line);
      if (lastLines.length > 200) lastLines.shift();
    };

    // Log full Java command line for diagnostics
    console.log("[minecraft.launch] Spawning Java process:");
    console.log(`  Java path: ${cmd.javaPath}`);
    console.log(`  Working directory: ${cmd.cwd}`);
    console.log(`  Arguments (${cmd.args.length}):`);
    cmd.args.forEach((arg, i) => {
      console.log(`    [${i}] ${arg}`);
    });

    const child = spawn(cmd.javaPath, cmd.args, {
      cwd: cmd.cwd,
      env: { ...process.env, ...cmd.env },
      windowsHide: false,
    });

    child.stdout?.on("data", (d: Buffer) => {
      const s = d.toString("utf8");
      out.write(s);
      for (const line of s.split(/\r?\n/g)) if (line) pushLine(line);
    });
    child.stderr?.on("data", (d: Buffer) => {
      const s = d.toString("utf8");
      out.write(s);
      for (const line of s.split(/\r?\n/g)) if (line) pushLine(line);
    });

    let exitCode: number | null = null;
    child.on("exit", (code) => {
      exitCode = code;
      out.end();
    });

    if (!child.pid) return { ok: false, error: "Failed to start java process" };

    // Detect immediate failure (e.g., missing DLL) before returning success.
    await new Promise((r) => setTimeout(r, 800));
    const code = exitCode;
    if (code !== null && code !== 0) {
      return { ok: false, error: `Java exited early (code ${code})\n${lastLines.join("\n")}` };
    }

    return { ok: true, pid: child.pid };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}



