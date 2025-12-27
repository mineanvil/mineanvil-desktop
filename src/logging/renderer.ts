import {
  createInMemoryLogStore,
  createLogger,
  formatJsonLine,
  isVerboseEnabled,
  type LogEntry,
  type Logger,
} from "../../electron/src/shared/logging";

const store = createInMemoryLogStore(1000);

const verbose = isVerboseEnabled(
  (import.meta as unknown as { env?: { MINEANVIL_DEBUG?: string } }).env,
);

const sink = (entry: LogEntry) => {
  store.push(entry);

  const line = formatJsonLine(entry);
  if (entry.level === "error") console.error(line);
  else if (entry.level === "warn") console.warn(line);
  else if (entry.level === "info") console.info(line);
  else console.debug(line);
};

/**
 * Renderer logger factory.
 *
 * - Writes JSON lines to console.
 * - Captures recent entries in-memory for diagnostics export.
 */
export function getRendererLogger(area = "renderer"): Logger {
  return createLogger({ area, sink, verbose });
}

/** Retrieve recent renderer log entries captured in-memory. */
export function getRecentRendererLogs(): LogEntry[] {
  return store.getAll();
}


