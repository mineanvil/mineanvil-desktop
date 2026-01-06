/**
 * Centralized Microsoft OAuth Client ID accessor.
 *
 * This module provides a single source of truth for MS_CLIENT_ID.
 * The value is read from a generated file (electron/src/shared/generated/msClientId.ts)
 * which is created at build time from the MS_CLIENT_ID environment variable.
 *
 * For development, process.env.MS_CLIENT_ID can override the generated value.
 */

import { MS_CLIENT_ID as GENERATED_MS_CLIENT_ID } from "./generated/msClientId";

const PLACEHOLDER_MS_CLIENT_ID = "YOUR_MICROSOFT_PUBLIC_CLIENT_ID";

/**
 * Get the Microsoft OAuth Client ID.
 *
 * In development, process.env.MS_CLIENT_ID can override the generated value.
 * In production builds, the generated value is used.
 *
 * @returns The Microsoft Client ID
 * @throws Error if MS_CLIENT_ID is missing or equals the placeholder
 */
export function getMsClientId(): string {
  // Allow process.env override for dev (useful for hot-reload scenarios)
  const envOverride = process.env.MS_CLIENT_ID?.trim();
  const clientId = envOverride || GENERATED_MS_CLIENT_ID;

  if (!clientId || clientId === PLACEHOLDER_MS_CLIENT_ID) {
    throw new Error(
      "Microsoft Client ID not configured. Set MS_CLIENT_ID in .env (dev) or environment.",
    );
  }

  return clientId;
}

