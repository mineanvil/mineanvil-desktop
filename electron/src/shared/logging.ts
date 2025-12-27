/**
 * MineAnvil logging + diagnostics contract (shared).
 *
 * Goals:
 * - Unified structure across renderer, Electron main, and core services
 * - JSON line format for easy bundling/grepping
 * - Verbose mode enabled via `MINEANVIL_DEBUG=1`
 * - Never log secrets (best-effort redaction helper provided)
 *
 * Constraints:
 * - Types and helpers only
 * - No file IO in this layer
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Structured log entry.
 *
 * JSON line fields (required):
 * - ts: ISO timestamp
 * - level: debug/info/warn/error
 * - area: subsystem identifier (e.g., "auth", "ipc", "launch")
 * - message: human-readable message
 * - meta: structured, non-secret context (optional)
 */
export interface LogEntry {
  readonly ts: string;
  readonly level: LogLevel;
  readonly area: string;
  readonly message: string;
  readonly meta?: Record<string, unknown>;
}

/** A sink consumes already-structured log entries. */
export type LogSink = (entry: LogEntry) => void;

/** An object-style logger for a specific area/subsystem. */
export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Determine whether verbose logging is enabled.
 *
 * - In Electron/Node: pass `process.env` (or an object with MINEANVIL_DEBUG)
 * - In the browser: pass `{ MINEANVIL_DEBUG: "1" }` from your own config source
 */
export function isVerboseEnabled(env?: { MINEANVIL_DEBUG?: string | undefined }): boolean {
  return env?.MINEANVIL_DEBUG === "1";
}

/**
 * Best-effort redaction of common secret fields.
 *
 * Notes:
 * - This is defensive, not perfect. Callers should still avoid placing secrets in meta.
 * - Only plain objects/arrays are recursively processed; other values are returned as-is.
 */
export function redactSecrets<T>(value: T): T {
  const SECRET_KEY_RE =
    /^(authorization|cookie|set-cookie|token|access[_-]?token|refresh[_-]?token|password|pass|secret|api[_-]?key|client[_-]?secret)$/i;

  const seen = new WeakSet<object>();

  const walk = (v: unknown): unknown => {
    if (v === null) return v;
    if (typeof v !== "object") return v;

    if (seen.has(v as object)) return "[Circular]";
    seen.add(v as object);

    if (Array.isArray(v)) return v.map(walk);

    const out: Record<string, unknown> = {};
    for (const [k, raw] of Object.entries(v as Record<string, unknown>)) {
      if (SECRET_KEY_RE.test(k)) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = walk(raw);
      }
    }
    return out;
  };

  return walk(value) as T;
}

/** Create a well-formed log entry (adds `ts`; redacts meta). */
export function makeLogEntry(params: {
  level: LogLevel;
  area: string;
  message: string;
  meta?: Record<string, unknown>;
  now?: () => Date;
}): LogEntry {
  const now = params.now ?? (() => new Date());
  return {
    ts: now().toISOString(),
    level: params.level,
    area: params.area,
    message: params.message,
    meta: params.meta ? (redactSecrets(params.meta) as Record<string, unknown>) : undefined,
  };
}

/**
 * Format a log entry as a single JSON line string.
 * This is the canonical "wire format" for storing/exporting logs.
 */
export function formatJsonLine(entry: LogEntry): string {
  return JSON.stringify(entry);
}

/** Create an area-scoped logger writing to a sink. */
export function createLogger(params: {
  area: string;
  sink: LogSink;
  verbose?: boolean;
  now?: () => Date;
}): Logger {
  const emit = (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
    if (level === "debug" && !params.verbose) return;
    params.sink(
      makeLogEntry({
        level,
        area: params.area,
        message,
        meta,
        now: params.now,
      }),
    );
  };

  return {
    debug: (message, meta) => emit("debug", message, meta),
    info: (message, meta) => emit("info", message, meta),
    warn: (message, meta) => emit("warn", message, meta),
    error: (message, meta) => emit("error", message, meta),
  };
}

/**
 * In-memory log store helper (renderer-friendly).
 * No side effects unless you call `.push()`.
 */
export function createInMemoryLogStore(maxEntries = 1000): {
  push: LogSink;
  getAll: () => LogEntry[];
  clear: () => void;
} {
  let entries: LogEntry[] = [];

  return {
    push: (e) => {
      entries.push(e);
      if (entries.length > maxEntries) entries = entries.slice(entries.length - maxEntries);
    },
    getAll: () => entries.slice(),
    clear: () => {
      entries = [];
    },
  };
}

/**
 * LocalStorage-backed log store helper (renderer-only).
 *
 * This helper is optional and only used when called; it performs no IO on import.
 */
export function createLocalStorageLogStore(params: {
  storageKey: string;
  maxEntries?: number;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
}): {
  push: LogSink;
  getAll: () => LogEntry[];
  clear: () => void;
} {
  const maxEntries = params.maxEntries ?? 1000;
  const storage = params.storage ?? (typeof localStorage !== "undefined" ? localStorage : undefined);

  const read = (): LogEntry[] => {
    if (!storage) return [];
    const raw = storage.getItem(params.storageKey);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as LogEntry[]) : [];
    } catch {
      return [];
    }
  };

  const write = (entries: LogEntry[]): void => {
    if (!storage) return;
    storage.setItem(params.storageKey, JSON.stringify(entries));
  };

  return {
    push: (e) => {
      const current = read();
      const next = [...current, e].slice(-maxEntries);
      write(next);
    },
    getAll: () => read(),
    clear: () => {
      if (!storage) return;
      storage.removeItem(params.storageKey);
    },
  };
}


