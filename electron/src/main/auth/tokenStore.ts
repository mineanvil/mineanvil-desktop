/**
 * Token storage (Windows-focused) for MineAnvil.
 *
 * Stage 1 (per prompt):
 * - Use Electron `safeStorage` to encrypt at rest.
 * - Persist only ciphertext to disk under:
 *   app.getPath("userData")/secrets/tokens.json
 *
 * Security notes:
 * - Never write plaintext tokens to disk.
 * - Best-effort file permissions are applied (may be limited on Windows).
 * - Do not log token contents.
 */

import { app, safeStorage } from "electron";
import fs from "node:fs/promises";
import path from "node:path";

export interface StoredTokens {
  readonly access_token: string;
  readonly refresh_token: string;
  readonly expires_at: number; // epoch ms
  readonly token_type: string;
  readonly scope?: string;
  readonly obtained_at?: number; // epoch ms
}

function secretsDir(): string {
  return path.join(app.getPath("userData"), "secrets");
}

function tokensFilePath(): string {
  return path.join(secretsDir(), "tokens.json");
}

type StoredFile = {
  v: 1;
  ciphertext_b64: string;
};

async function ensureSecretsDir(): Promise<void> {
  // Best-effort permissions (Windows may ignore mode bits).
  await fs.mkdir(secretsDir(), { recursive: true, mode: 0o700 });
}

export async function saveTokens(tokens: StoredTokens): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("safeStorage encryption is not available");
  }

  await ensureSecretsDir();

  const plaintext = JSON.stringify(tokens);
  const ciphertext = safeStorage.encryptString(plaintext);

  const file: StoredFile = {
    v: 1,
    ciphertext_b64: ciphertext.toString("base64"),
  };

  // Best-effort file permissions (Windows may ignore mode bits).
  await fs.writeFile(tokensFilePath(), JSON.stringify(file), { encoding: "utf8", mode: 0o600 });
}

export async function loadTokens(): Promise<StoredTokens | null> {
  if (!safeStorage.isEncryptionAvailable()) return null;

  let raw: string;
  try {
    raw = await fs.readFile(tokensFilePath(), { encoding: "utf8" });
  } catch {
    return null;
  }

  let parsed: StoredFile | null = null;
  try {
    parsed = JSON.parse(raw) as StoredFile;
  } catch {
    return null;
  }

  if (!parsed || parsed.v !== 1 || typeof parsed.ciphertext_b64 !== "string") return null;

  try {
    const buf = Buffer.from(parsed.ciphertext_b64, "base64");
    const plaintext = safeStorage.decryptString(buf);
    const tokens = JSON.parse(plaintext) as StoredTokens;
    // Minimal validation
    if (
      !tokens ||
      typeof tokens.access_token !== "string" ||
      typeof tokens.refresh_token !== "string" ||
      typeof tokens.token_type !== "string" ||
      typeof tokens.expires_at !== "number"
    ) {
      return null;
    }
    return tokens;
  } catch {
    return null;
  }
}

export async function clearTokens(): Promise<void> {
  try {
    await fs.rm(tokensFilePath(), { force: true });
  } catch {
    // ignore
  }
}



