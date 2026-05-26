/** Turn fetch/abort failures into short messages (no "signal is aborted" noise). */
export function describeFetchFailure(err: unknown, source: string): string {
  if (err instanceof DOMException && err.name === 'AbortError') {
    return `${source}: request timed out`;
  }

  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (
      err.name === 'AbortError' ||
      msg.includes('aborted') ||
      msg.includes('abort')
    ) {
      return `${source}: request timed out`;
    }
    return `${source}: ${err.message}`;
  }

  return `${source}: request failed`;
}
