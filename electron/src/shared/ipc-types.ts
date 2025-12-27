/**
 * Typed IPC contracts shared between:
 * - Electron main process (`electron/src/main/**`)
 * - Electron preload (`electron/src/preload/**`)
 * - Renderer (later, via a thin adapter)
 *
 * IMPORTANT:
 * - Keep this file free of Electron imports so it can be shared safely.
 * - Types only; no runtime side effects.
 */

export const IPC_CHANNELS = {
  ping: "mineanvil:ping",
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

/**
 * API exposed to the renderer via `contextBridge.exposeInMainWorld`.
 * The renderer should never import from `electron` directly.
 */
export interface RendererApi {
  /** Test call to validate wiring. */
  ping(): Promise<string>;
}

declare global {
  interface Window {
    /**
     * Preload-exposed API.
     *
     * NOTE: The renderer may still run in a normal browser (Vite dev), where
     * this object will be absent until we add a browser-safe adapter later.
     */
    mineanvil?: RendererApi;
  }
}


