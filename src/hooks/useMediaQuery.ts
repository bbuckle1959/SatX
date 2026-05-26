import { useEffect, useState } from 'react';

/**
 * Subscribes to a CSS media query (e.g. mobile breakpoint).
 * Default `false` until the first client match to avoid SSR/hydration flicker.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Viewport width under 768px (below Tailwind `md`). */
export function useIsMobileViewport(): boolean {
  return useMediaQuery('(max-width: 767px)');
}
