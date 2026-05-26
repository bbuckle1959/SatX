/// <reference types="vite/client" />

interface TauriInternals {
  invoke: <T>(
    cmd: string,
    args?: Record<string, unknown>,
    options?: unknown,
  ) => Promise<T>;
}

interface Window {
  __TAURI_INTERNALS__?: TauriInternals;
  isTauri?: boolean;
}
