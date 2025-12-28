/**
 * Fixed loopback redirect listener for OAuth callbacks.
 *
 * Uses a fixed redirect URI:
 *   http://127.0.0.1:53682/callback
 *
 * SECURITY:
 * - Never log auth codes/tokens.
 * - State is only logged as "present/absent" by callers (not here).
 */

import * as http from "node:http";
import { URL } from "node:url";

export const REDIRECT_HOST = "127.0.0.1" as const;
export const REDIRECT_PORT = 53682 as const;
export const REDIRECT_PATH = "/callback" as const;
export const REDIRECT_URI = `http://${REDIRECT_HOST}:${REDIRECT_PORT}${REDIRECT_PATH}` as const;

function htmlPage(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8" /><title>${title}</title></head><body>${body}</body></html>`;
}

export async function waitForOAuthCallback(expectedState: string): Promise<{ code: string }> {
  return await new Promise((resolve, reject) => {
    let handled = false;

    const server = http.createServer((req, res) => {
      const finish = (status: number, html: string) => {
        try {
          res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
          res.end(html);
        } finally {
          if (!handled) handled = true;
          server.close();
        }
      };

      try {
        const url = new URL(req.url ?? "/", REDIRECT_URI);
        if (req.method !== "GET" || url.pathname !== REDIRECT_PATH) {
          finish(404, htmlPage("Not found", "<h1>Not found</h1>"));
          reject(new Error("Unexpected callback path"));
          return;
        }

        const error = url.searchParams.get("error");
        const errorDescription = url.searchParams.get("error_description");
        const state = url.searchParams.get("state");
        const code = url.searchParams.get("code");

        if (error) {
          finish(
            200,
            htmlPage(
              "Sign-in failed",
              "<h1>Sign-in failed</h1><p>You may close this tab and return to MineAnvil.</p>",
            ),
          );
          reject(new Error(`${error}${errorDescription ? `: ${errorDescription}` : ""}`));
          return;
        }

        if (!code) {
          finish(
            200,
            htmlPage(
              "Sign-in failed",
              "<h1>Sign-in failed</h1><p>Missing authorization code. You may close this tab.</p>",
            ),
          );
          reject(new Error("Missing authorization code"));
          return;
        }

        if (!state || state !== expectedState) {
          finish(
            200,
            htmlPage(
              "Sign-in failed",
              "<h1>Sign-in failed</h1><p>State mismatch. You may close this tab.</p>",
            ),
          );
          reject(new Error("OAuth state mismatch"));
          return;
        }

        finish(
          200,
          htmlPage(
            "Sign-in complete",
            "<h1>Sign-in complete</h1><p>You may close this tab and return to MineAnvil.</p>",
          ),
        );
        resolve({ code });
      } catch (e) {
        finish(
          200,
          htmlPage(
            "Sign-in failed",
            "<h1>Sign-in failed</h1><p>You may close this tab and return to MineAnvil.</p>",
          ),
        );
        reject(e);
      }
    });

    server.on("error", (err: unknown) => {
      const anyErr = err as { code?: unknown };
      if (anyErr?.code === "EADDRINUSE") {
        reject(new Error("Port 53682 is already in use. Close the other app and try again."));
      } else {
        reject(new Error("Unable to start local sign-in callback server."));
      }
    });

    server.listen(REDIRECT_PORT, REDIRECT_HOST);
  });
}


