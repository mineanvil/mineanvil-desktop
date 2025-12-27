import { redactSecrets, type LogEntry } from "../../electron/src/shared/logging";
import { getRecentRendererLogs } from "../logging/renderer";

export interface DiagnosticsBundle {
  readonly app: {
    readonly name: "MineAnvil";
    readonly build: "dev";
    readonly timestamp: string;
  };
  readonly environment: {
    readonly userAgent: string;
    readonly platform: string;
    readonly language: string;
  };
  readonly logs: LogEntry[];
}

export function buildDiagnosticsBundle(now = () => new Date()): DiagnosticsBundle {
  const timestamp = now().toISOString();

  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "unknown";
  const platform = typeof navigator !== "undefined" ? (navigator.platform || "unknown") : "unknown";
  const language = typeof navigator !== "undefined" ? (navigator.language || "unknown") : "unknown";

  const bundle: DiagnosticsBundle = {
    app: {
      name: "MineAnvil",
      build: "dev",
      timestamp,
    },
    environment: {
      userAgent,
      platform,
      language,
    },
    logs: getRecentRendererLogs(),
  };

  // Conservative redaction across the full bundle.
  return redactSecrets(bundle);
}

export function downloadDiagnosticsJson(bundle: DiagnosticsBundle): void {
  const safeTs = bundle.app.timestamp.replace(/[:.]/g, "-");
  const filename = `mineanvil-diagnostics-${safeTs}.json`;

  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  // Clean up ASAP.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}



