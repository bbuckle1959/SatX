const DEFAULT_MS = 12_000;

/** Abort fetch after `ms` so unreachable hosts fail fast instead of hanging the UI. */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  ms = DEFAULT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const usesOwnSignal = init.signal != null;
  const timeoutId = setTimeout(() => controller.abort(), ms);

  try {
    return await fetch(input, {
      ...init,
      signal: init.signal ?? controller.signal,
    });
  } catch (err) {
    if (!usesOwnSignal && controller.signal.aborted) {
      throw new Error('Request timed out');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
