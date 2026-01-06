#!/usr/bin/env node
/**
 * Generate MS_CLIENT_ID TypeScript file from environment variable.
 *
 * This script reads MS_CLIENT_ID from process.env and generates
 * electron/src/shared/generated/msClientId.ts
 *
 * Usage:
 *   node scripts/generate-ms-client-id.ts
 *
 * Requires MS_CLIENT_ID environment variable to be set.
 * In dev, loads from .env file if it exists.
 */

import * as fs from "node:fs";
import * as path from "node:path";

// Load .env file if it exists (for dev)
try {
  const dotenv = await import("dotenv");
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
} catch {
  // dotenv not available or .env doesn't exist - continue
}

const MS_CLIENT_ID = process.env.MS_CLIENT_ID;

const outputDir = path.resolve(process.cwd(), "electron/src/shared/generated");
const outputFile = path.join(outputDir, "msClientId.ts");

// If MS_CLIENT_ID is not available but the file already exists, skip regeneration
// This allows packaged builds and local rebuilds to work without MS_CLIENT_ID
if (!MS_CLIENT_ID || MS_CLIENT_ID.trim() === "") {
  if (fs.existsSync(outputFile)) {
    console.log(`⏭️  Skipping generation: ${outputFile} already exists and MS_CLIENT_ID not available`);
    process.exit(0);
  } else {
    throw new Error("MS_CLIENT_ID missing for build");
  }
}

// Ensure directory exists
fs.mkdirSync(outputDir, { recursive: true });

// Escape the value for TypeScript string literal
function escapeForTypeScriptString(value: string): string {
  return value
    .replace(/\\/g, "\\\\") // Escape backslashes first
    .replace(/"/g, '\\"') // Escape double quotes
    .replace(/\n/g, "\\n") // Escape newlines
    .replace(/\r/g, "\\r") // Escape carriage returns
    .replace(/\t/g, "\\t"); // Escape tabs
}

// Write the generated file
const content = `/**
 * Generated file - DO NOT EDIT
 * This file is generated at build time from MS_CLIENT_ID environment variable.
 */

export const MS_CLIENT_ID = "${escapeForTypeScriptString(MS_CLIENT_ID.trim())}";
`;

fs.writeFileSync(outputFile, content, "utf8");

console.log(`✅ Generated ${outputFile}`);

