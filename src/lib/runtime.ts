const CELESTRAK_SKIP_KEY = 'satx:skip-celestrak-network';

/** True when running inside the Tauri desktop webview. */
export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** Remember CelesTrak timeouts so we stop hitting the Vite proxy / remote host. */
export function markCelestrakUnreachable(): void {
  try {
    sessionStorage.setItem(CELESTRAK_SKIP_KEY, '1');
  } catch {
    // ignore (private mode)
  }
}

/** Skip CelesTrak HTTP (unreachable on many Starlink links; optional metadata only). */
export function shouldSkipCelestrakNetwork(): boolean {
  if (isTauriRuntime()) return true;
  try {
    return sessionStorage.getItem(CELESTRAK_SKIP_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * In `tauri dev`, the UI is served from the Vite dev server — use its CelesTrak
 * proxy so the webview does not hit celestrak.org directly (often blocked or slow
 * on Starlink and similar networks).
 */
export function shouldUseCelestrakProxy(): boolean {
  return import.meta.env.DEV;
}

export function celestrakProxyUrl(path: string): string {
  return `/api/celestrak${path}`;
}

export function celestrakDirectUrl(path: string): string {
  return `https://celestrak.org${path}`;
}

/** CelesTrak URL for the current runtime (proxy in dev, direct in production builds). */
export function celestrakCatalogUrl(path: string): string {
  if (shouldUseCelestrakProxy()) {
    return celestrakProxyUrl(path);
  }
  return celestrakDirectUrl(path);
}
