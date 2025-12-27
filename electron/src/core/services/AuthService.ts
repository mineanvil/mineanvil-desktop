import type { Session } from "../types";

/**
 * AuthService
 *
 * Responsibility:
 * - Establish and end an authenticated user session.
 * - Provide current session state to other core services.
 *
 * Non-responsibilities (by design):
 * - No Electron APIs.
 * - No filesystem access.
 * - No side effects in this layer.
 * - No secrets/tokens in return types.
 */
export interface AuthService {
  /** Start an interactive or delegated sign-in flow (implemented in platform layer). */
  signIn(): Promise<Session>;

  /** Clear the current session. */
  signOut(): Promise<void>;

  /** Retrieve the current session, or null if not signed in. */
  getSession(): Promise<Session | null>;
}


