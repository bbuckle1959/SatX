import { slantRangeKm, type ViewCenter } from './viewMetrics';

interface GeodeticPosition {
  latitude: number;
  longitude: number;
  altitude: number;
}

/** O(n × k) — keeps the k smallest slant ranges without sorting the full catalog. */
export function nearestBySlantRange<T extends GeodeticPosition>(
  items: readonly T[],
  origin: ViewCenter,
  limit: number,
): T[] {
  if (limit <= 0 || items.length === 0) return [];
  if (items.length <= limit) {
    return [...items].sort(
      (a, b) => slantRangeKm(a, origin) - slantRangeKm(b, origin),
    );
  }

  const top: { item: T; rangeKm: number }[] = [];

  for (const item of items) {
    const rangeKm = slantRangeKm(item, origin);

    if (top.length < limit) {
      top.push({ item, rangeKm });
      if (top.length === limit) {
        top.sort((a, b) => a.rangeKm - b.rangeKm);
      }
      continue;
    }

    if (rangeKm >= top[limit - 1].rangeKm) continue;

    let insertAt = limit - 1;
    while (insertAt > 0 && rangeKm < top[insertAt - 1].rangeKm) {
      insertAt -= 1;
    }
    top.splice(insertAt, 0, { item, rangeKm });
    top.pop();
  }

  return top.map((entry) => entry.item);
}
