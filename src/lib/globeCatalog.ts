import * as THREE from 'three';

import type { SatelliteCoordinates } from '../hooks/useSatellitePropagation';
import type { UserLocation } from '../hooks/useUserLocation';
import { GLOBE_MAX_INSTANCES } from './globeLimits';
import { geodeticToCartesian } from './geo';
import {
  isStarlinkObject,
  matchesObjectTypeFilter,
  type ObjectType,
  type ObjectTypeFilter,
} from './objectTypes';

const _observer = new THREE.Vector3();
const _satellite = new THREE.Vector3();
const _toSat = new THREE.Vector3();
const _up = new THREE.Vector3();

/** Types omitted on mobile when showing “all” (background / clutter). */
export const MOBILE_SUPPRESSED_TYPES: ReadonlySet<ObjectType> = new Set([
  'debris',
]);

/** Capped = worker/display limited to globe instance budget; full = all type-filtered objects. */
export type GlobePopulationMode = 'capped' | 'full';

export const GLOBE_POPULATION_OPTIONS: ReadonlyArray<{
  value: GlobePopulationMode;
  label: string;
}> = [
  { value: 'capped', label: 'Optimized (globe cap)' },
  { value: 'full', label: 'Full catalog' },
] as const;

export interface CatalogWorkerOptions {
  maxInstances: number;
  mode: GlobePopulationMode;
  /** When filter is “all”, prefer Starlink IDs before filling the cap. */
  preferStarlinkWhenAll: boolean;
  /** Skip these types when building an “all” catalog (mobile). */
  suppressedTypes?: ReadonlySet<ObjectType>;
}

/** Count TLE rows matching the object-type filter (no instance cap). */
export function countMatchingCatalog(
  satellites: ReadonlyArray<{ id: string }>,
  objectTypeFilter: ObjectTypeFilter,
  typeById: ReadonlyMap<string, ObjectType>,
): number {
  if (objectTypeFilter === 'all') return satellites.length;
  let n = 0;
  for (const sat of satellites) {
    if (matchesObjectTypeFilter(sat.id, objectTypeFilter, typeById)) n += 1;
  }
  return n;
}

/** All IDs matching the object-type filter (no instance cap). */
export function listMatchingCatalogIds(
  satellites: ReadonlyArray<{ id: string; name: string }>,
  objectTypeFilter: ObjectTypeFilter,
  typeById: ReadonlyMap<string, ObjectType>,
  suppressedTypes?: ReadonlySet<ObjectType>,
): string[] {
  if (objectTypeFilter !== 'all') {
    const ids: string[] = [];
    for (const sat of satellites) {
      if (!matchesObjectTypeFilter(sat.id, objectTypeFilter, typeById)) continue;
      ids.push(sat.id);
    }
    return ids;
  }

  const ids: string[] = [];
  for (const sat of satellites) {
    const type = typeById.get(sat.id);
    if (type && suppressedTypes?.has(type)) continue;
    ids.push(sat.id);
  }
  return ids;
}

/**
 * Worker active-id list: type filter, then optional cap for propagation budget.
 */
export function filterCatalogIdsForWorker(
  satellites: ReadonlyArray<{ id: string; name: string }>,
  objectTypeFilter: ObjectTypeFilter,
  typeById: ReadonlyMap<string, ObjectType>,
  options: CatalogWorkerOptions,
): string[] {
  if (options.mode === 'full') {
    return listMatchingCatalogIds(
      satellites,
      objectTypeFilter,
      typeById,
      options.suppressedTypes,
    );
  }

  const { maxInstances, preferStarlinkWhenAll, suppressedTypes } = options;

  if (objectTypeFilter !== 'all') {
    const ids: string[] = [];
    for (const sat of satellites) {
      if (!matchesObjectTypeFilter(sat.id, objectTypeFilter, typeById)) continue;
      ids.push(sat.id);
      if (ids.length >= maxInstances) break;
    }
    return ids;
  }

  const starlinkIds: string[] = [];
  const otherIds: string[] = [];

  for (const sat of satellites) {
    const type = typeById.get(sat.id);
    if (type && suppressedTypes?.has(type)) continue;

    if (
      preferStarlinkWhenAll &&
      (type === 'starlink' || isStarlinkObject(sat.id, sat.name, typeById))
    ) {
      starlinkIds.push(sat.id);
    } else {
      otherIds.push(sat.id);
    }
  }

  if (!preferStarlinkWhenAll) {
    const all = [...starlinkIds, ...otherIds];
    return all.length <= maxInstances ? all : all.slice(0, maxInstances);
  }

  if (starlinkIds.length >= maxInstances) {
    return starlinkIds.slice(0, maxInstances);
  }

  const remaining = maxInstances - starlinkIds.length;
  return [...starlinkIds, ...otherIds.slice(0, remaining)];
}

/** Elevation angle (degrees) from observer to satellite; negative = below horizon. */
export function elevationDegFromObserver(
  sat: Pick<SatelliteCoordinates, 'latitude' | 'longitude' | 'altitude'>,
  observer: UserLocation,
): number {
  const [ox, oy, oz] = geodeticToCartesian(
    observer.latitude,
    observer.longitude,
    0,
  );
  const [sx, sy, sz] = geodeticToCartesian(
    sat.latitude,
    sat.longitude,
    sat.altitude,
  );

  _observer.set(ox, oy, oz);
  _satellite.set(sx, sy, sz);
  _up.copy(_observer).normalize();
  _toSat.subVectors(_satellite, _observer);
  const range = _toSat.length();
  if (range < 1e-9) return 90;

  return Math.asin(THREE.MathUtils.clamp(_toSat.dot(_up) / range, -1, 1)) *
    (180 / Math.PI);
}

/** Move pinned ids to the front so they stay within the globe instance cap. */
export function prioritizePinnedPositions(
  positions: ReadonlyArray<SatelliteCoordinates>,
  pinIds: ReadonlyArray<string | null | undefined>,
): SatelliteCoordinates[] {
  const order = pinIds.filter(
    (id): id is string => typeof id === 'string' && id.length > 0,
  );
  if (order.length === 0) return [...positions];

  const pinSet = new Set(order);
  const byId = new Map<string, SatelliteCoordinates>();
  const rest: SatelliteCoordinates[] = [];

  for (const sat of positions) {
    if (pinSet.has(sat.id)) byId.set(sat.id, sat);
    else rest.push(sat);
  }

  const pinned: SatelliteCoordinates[] = [];
  for (const id of order) {
    const sat = byId.get(id);
    if (sat) pinned.push(sat);
  }

  if (pinned.length === 0) return [...positions];
  return [...pinned, ...rest];
}

interface DisplayPoolOptions {
  /** When no overhead sats and no location, keep only Starlink (mobile). */
  starlinkOnlyFallback: boolean;
}

function poolMatchesStarlink(
  sat: SatelliteCoordinates,
  typeById: ReadonlyMap<string, ObjectType>,
): boolean {
  return isStarlinkObject(sat.id, sat.name, typeById);
}

/**
 * Display set: overhead cone when location known; keeps pinned ids; caps length.
 */
export function filterPositionsForDisplay(
  positions: ReadonlyArray<SatelliteCoordinates>,
  userLocation: UserLocation | null,
  pinIds: ReadonlyArray<string | null | undefined>,
  maxInstances: number,
  typeById: ReadonlyMap<string, ObjectType>,
  options: DisplayPoolOptions,
): SatelliteCoordinates[] {
  const pinSet = new Set(
    pinIds.filter((id): id is string => typeof id === 'string' && id.length > 0),
  );

  const pinned: SatelliteCoordinates[] = [];
  const pool: SatelliteCoordinates[] = [];

  for (const sat of positions) {
    if (pinSet.has(sat.id)) {
      pinned.push(sat);
      continue;
    }
    pool.push(sat);
  }

  let candidates = pool;

  if (userLocation) {
    const overhead: { sat: SatelliteCoordinates; elevation: number }[] = [];
    for (const sat of pool) {
      const elevation = elevationDegFromObserver(sat, userLocation);
      if (elevation > 0) overhead.push({ sat, elevation });
    }
    if (overhead.length > 0) {
      overhead.sort((a, b) => b.elevation - a.elevation);
      candidates = overhead.map((entry) => entry.sat);
    } else if (options.starlinkOnlyFallback) {
      candidates = pool.filter((sat) => poolMatchesStarlink(sat, typeById));
    }
  } else if (options.starlinkOnlyFallback) {
    candidates = pool.filter((sat) => poolMatchesStarlink(sat, typeById));
  }

  const cap = Math.max(0, maxInstances - pinned.length);
  const trimmed = candidates.slice(0, cap);

  const seen = new Set<string>();
  const out: SatelliteCoordinates[] = [];

  for (const sat of pinned) {
    if (seen.has(sat.id)) continue;
    seen.add(sat.id);
    out.push(sat);
  }
  for (const sat of trimmed) {
    if (seen.has(sat.id)) continue;
    seen.add(sat.id);
    out.push(sat);
  }

  return out;
}

/** Positions passed to the globe and sidebar after population mode is applied. */
export function resolveGlobeDisplayPositions(
  positions: ReadonlyArray<SatelliteCoordinates>,
  mode: GlobePopulationMode,
  userLocation: UserLocation | null,
  pinIds: ReadonlyArray<string | null | undefined>,
  maxInstances: number,
  typeById: ReadonlyMap<string, ObjectType>,
  displayOptions: DisplayPoolOptions,
): SatelliteCoordinates[] {
  if (mode === 'full') {
    const pinned = pinIds.filter(
      (id): id is string => typeof id === 'string' && id.length > 0,
    );
    if (pinned.length === 0) return [...positions];
    return prioritizePinnedPositions(positions, pinIds);
  }

  let throttled = filterPositionsForDisplay(
    positions,
    userLocation,
    pinIds,
    maxInstances,
    typeById,
    displayOptions,
  );
  const hasPins = pinIds.some(
    (id) => typeof id === 'string' && id.length > 0,
  );
  if (hasPins) {
    throttled = prioritizePinnedPositions(throttled, pinIds);
  }
  return throttled;
}

export function getWorkerOptions(
  isMobile: boolean,
  maxInstances: number,
  mode: GlobePopulationMode,
): CatalogWorkerOptions {
  if (isMobile) {
    return {
      maxInstances,
      mode,
      preferStarlinkWhenAll: true,
      suppressedTypes: MOBILE_SUPPRESSED_TYPES,
    };
  }
  return {
    maxInstances,
    mode,
    preferStarlinkWhenAll: true,
    suppressedTypes: undefined,
  };
}

export function getDisplayOptions(isMobile: boolean): DisplayPoolOptions {
  return { starlinkOnlyFallback: isMobile };
}

export { GLOBE_MAX_INSTANCES };
