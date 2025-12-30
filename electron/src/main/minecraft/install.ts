/**
 * Vanilla Minecraft installer (Electron main, Windows x64).
 *
 * - Downloads version json + client jar
 * - Downloads libraries + native classifiers
 * - Downloads asset index + assets objects
 * - Extracts natives to `.minecraft/natives/<versionId>/`
 *
 * This is intentionally "minimal but correct" for vanilla.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { spawn } from "node:child_process";
import { fetchVersionJson, resolveVersion } from "./metadata";
import { downloadToFile } from "../net/downloader";

export interface InstallResult {
  readonly versionId: string;
  readonly instancePath: string;
  readonly nativesDir: string;
  readonly assetIndexId: string;
  readonly counts: {
    readonly librariesDownloaded: number;
    readonly librariesSkipped: number;
    readonly assetsDownloaded: number;
    readonly assetsSkipped: number;
    readonly nativesDownloaded: number;
  };
  readonly notes: string[];
}

type AssetIndex = {
  id?: string;
  objects: Record<string, { hash: string; size: number }>;
};

function minecraftDir(instancePath: string): string {
  return path.join(instancePath, ".minecraft");
}

function isAllowedForWindows(rules?: Array<{ action: "allow" | "disallow"; os?: { name?: string } }>): boolean {
  if (!rules || rules.length === 0) return true;
  let allowed = false;
  for (const r of rules) {
    const osName = r.os?.name;
    const matches = !osName || osName === "windows";
    if (matches) allowed = r.action === "allow";
  }
  return allowed;
}

async function ensureDir(p: string): Promise<void> {
  await fs.mkdir(p, { recursive: true });
}

async function writeJson(p: string, value: unknown): Promise<void> {
  await ensureDir(path.dirname(p));
  await fs.writeFile(p, JSON.stringify(value, null, 2), { encoding: "utf8" });
}

async function readJsonFile<T>(p: string): Promise<T> {
  const raw = await fs.readFile(p, { encoding: "utf8" });
  return JSON.parse(raw) as T;
}

async function tryReadJsonFile<T>(p: string): Promise<T | null> {
  try {
    return await readJsonFile<T>(p);
  } catch {
    return null;
  }
}

async function writeJsonAtomic(p: string, value: unknown): Promise<void> {
  await ensureDir(path.dirname(p));
  const tmp = `${p}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), { encoding: "utf8" });
  // Best-effort replace: remove existing, then rename tmp into place.
  // If we crash in-between, we'll re-download/re-write on the next run.
  try {
    await fs.rm(p, { force: true });
  } catch {
    // ignore
  }
  await fs.rename(tmp, p);
}

async function extractZipWindows(params: {
  zipFile: string;
  destDir: string;
  exclude?: string[];
}): Promise<void> {
  if (process.platform !== "win32") {
    throw new Error("Native extraction is only supported on Windows");
  }

  const exclude = params.exclude ?? [];
  const excludeJson = JSON.stringify(exclude);

  // PowerShell script uses .NET ZipArchive to honor exclusions.
  const script = `
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = "${params.zipFile.replaceAll('"', '""')}"
$dest = "${params.destDir.replaceAll('"', '""')}"
$exclude = ${excludeJson}
New-Item -ItemType Directory -Force -Path $dest | Out-Null
$archive = [System.IO.Compression.ZipFile]::OpenRead($zip)
try {
  foreach ($entry in $archive.Entries) {
    if ([string]::IsNullOrEmpty($entry.FullName)) { continue }
    if ($entry.FullName.EndsWith("/")) { continue }
    $skip = $false
    foreach ($ex in $exclude) {
      if ($entry.FullName -like $ex) { $skip = $true; break }
    }
    if ($skip) { continue }
    $outPath = Join-Path $dest $entry.FullName
    $outDir = Split-Path -Parent $outPath
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null
    [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $outPath, $true)
  }
} finally {
  $archive.Dispose()
}
`;

  await new Promise<void>((resolve, reject) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`powershell extract failed (exit ${code ?? -1})`));
    });
  });
}

function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let i = 0;
  let active = 0;

  return new Promise((resolve, reject) => {
    const next = () => {
      if (i >= items.length && active === 0) {
        resolve(results);
        return;
      }
      while (active < limit && i < items.length) {
        const idx = i++;
        active++;
        void fn(items[idx])
          .then((r) => {
            results[idx] = r;
            active--;
            next();
          })
          .catch(reject);
      }
    };
    next();
  });
}

export async function ensureVanillaInstalled(instancePath: string, versionIdOrLatest: string): Promise<InstallResult> {
  if (process.platform !== "win32") {
    throw new Error("Vanilla install is currently supported on Windows runner only");
  }

  const notes: string[] = [];
  const mcDir = minecraftDir(instancePath);
  const versionsDir = path.join(mcDir, "versions");
  const librariesDir = path.join(mcDir, "libraries");
  const assetsDir = path.join(mcDir, "assets");

  // Deterministic re-run behavior:
  // - If caller passes "latest", pin the resolved release version locally and reuse it on subsequent runs.
  // - If we already have the version JSON on disk, reuse it (avoid network variability).
  const mineanvilMetaDir = path.join(mcDir, "mineanvil");
  const latestPinPath = path.join(mineanvilMetaDir, "latest-release.json");

  let versionId: string;
  let versionJsonUrl: string | null = null;

  if (versionIdOrLatest === "latest") {
    const pinned = await tryReadJsonFile<{ versionId?: unknown }>(latestPinPath);
    if (pinned && typeof pinned.versionId === "string" && pinned.versionId.trim()) {
      versionId = pinned.versionId;
      notes.push(`latest pinned: ${versionId}`);
    } else {
      const resolved = await resolveVersion("latest");
      versionId = resolved.versionId;
      versionJsonUrl = resolved.versionJsonUrl;
      await writeJsonAtomic(latestPinPath, { versionId, resolvedAt: new Date().toISOString() });
      notes.push(`latest resolved+pinned: ${versionId}`);
    }
  } else {
    versionId = versionIdOrLatest;
  }

  const versionDir = path.join(versionsDir, versionId);
  const versionJsonPath = path.join(versionDir, `${versionId}.json`);
  const clientJarPath = path.join(versionDir, `${versionId}.jar`);

  let versionJson = await tryReadJsonFile<Awaited<ReturnType<typeof fetchVersionJson>>>(versionJsonPath);
  if (!versionJson) {
    if (!versionJsonUrl) {
      const resolved = await resolveVersion(versionId);
      versionJsonUrl = resolved.versionJsonUrl;
    }
    versionJson = await fetchVersionJson(versionJsonUrl);
    await writeJsonAtomic(versionJsonPath, versionJson);
    notes.push(`saved version json: ${versionJsonPath}`);
  } else {
    notes.push(`using cached version json: ${versionJsonPath}`);
  }

  // Client jar
  const client = versionJson.downloads.client;
  await downloadToFile(client.url, clientJarPath, {
    expectedSize: client.size,
    expectedSha1: client.sha1,
  });
  notes.push(`client jar: ${clientJarPath}`);

  // Libraries + natives
  let librariesDownloaded = 0;
  let librariesSkipped = 0;
  let nativesDownloaded = 0;

  const nativesDir = path.join(mcDir, "natives", versionId);
  await ensureDir(nativesDir);

  for (const lib of versionJson.libraries) {
    if (!isAllowedForWindows(lib.rules)) continue;
    const artifact = lib.downloads?.artifact;
    if (artifact) {
      const dest = path.join(librariesDir, artifact.path);
      const res = await downloadToFile(artifact.url, dest, {
        expectedSize: artifact.size,
        expectedSha1: artifact.sha1,
      });
      if (res.downloaded) librariesDownloaded++;
      else librariesSkipped++;
    }

    // Natives for windows
    const nativesKey = lib.natives?.windows;
    if (nativesKey && lib.downloads?.classifiers) {
      const classifierKey = nativesKey.replace("${arch}", "64");
      const classifier = lib.downloads.classifiers[classifierKey];
      if (!classifier) continue;
      const dest = path.join(librariesDir, classifier.path);
      await downloadToFile(classifier.url, dest, {
        expectedSize: classifier.size,
        expectedSha1: classifier.sha1,
      });
      nativesDownloaded++;

      await extractZipWindows({
        zipFile: dest,
        destDir: nativesDir,
        exclude: lib.extract?.exclude,
      });
    }
  }

  notes.push(`nativesDir=${nativesDir}`);

  // Assets
  const assetIndex = versionJson.assetIndex;
  const assetIndexId = assetIndex.id;
  const assetIndexPath = path.join(assetsDir, "indexes", `${assetIndexId}.json`);

  await downloadToFile(assetIndex.url, assetIndexPath, {
    expectedSize: assetIndex.size,
    expectedSha1: assetIndex.sha1,
  });

  const indexJson = await readJsonFile<AssetIndex>(assetIndexPath);
  const objects = Object.values(indexJson.objects ?? {});

  let assetsDownloaded = 0;
  let assetsSkipped = 0;

  // Limit concurrency to keep it tame; assets can be many.
  await mapLimit(objects, 8, async (obj) => {
    const hash = obj.hash;
    const prefix = hash.slice(0, 2);
    const url = `https://resources.download.minecraft.net/${prefix}/${hash}`;
    const dest = path.join(assetsDir, "objects", prefix, hash);
    const res = await downloadToFile(url, dest, {
      expectedSize: obj.size,
      expectedSha1: hash, // asset object hash is SHA1
    });
    if (res.downloaded) assetsDownloaded++;
    else assetsSkipped++;
    return true;
  });

  notes.push(`assetIndexId=${assetIndexId}`);

  return {
    versionId,
    instancePath,
    nativesDir,
    assetIndexId,
    counts: {
      librariesDownloaded,
      librariesSkipped,
      assetsDownloaded,
      assetsSkipped,
      nativesDownloaded,
    },
    notes,
  };
}


