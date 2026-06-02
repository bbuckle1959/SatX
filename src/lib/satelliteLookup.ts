import type { RefObject } from 'react';

import type { SatelliteCoordinates } from '../hooks/useSatellitePropagation';

export function buildPositionsById(
  positions: ReadonlyArray<SatelliteCoordinates>,
): Map<string, SatelliteCoordinates> {
  const map = new Map<string, SatelliteCoordinates>();
  for (const sat of positions) map.set(sat.id, sat);
  return map;
}

export function mergePositionsById(
  map: Map<string, SatelliteCoordinates>,
  positions: ReadonlyArray<SatelliteCoordinates>,
): void {
  for (const sat of positions) map.set(sat.id, sat);
}

function findInList(
  id: string,
  list: ReadonlyArray<SatelliteCoordinates>,
): SatelliteCoordinates | undefined {
  for (let i = 0; i < list.length; i += 1) {
    if (list[i].id === id) return list[i];
  }
  return undefined;
}

export function findSatelliteById(
  id: string,
  positionsById: ReadonlyMap<string, SatelliteCoordinates> | null | undefined,
  positionsRef: RefObject<SatelliteCoordinates[]>,
  targetPositionsRef: RefObject<SatelliteCoordinates[]>,
  catalogPositionsRef: RefObject<SatelliteCoordinates[]>,
): SatelliteCoordinates | undefined {
  const fromMap = positionsById?.get(id);
  if (fromMap) return fromMap;

  const sources = [
    positionsRef.current,
    targetPositionsRef.current,
    catalogPositionsRef.current,
  ];
  for (const list of sources) {
    const found = findInList(id, list);
    if (found) return found;
  }
  return undefined;
}

/** Sidebar / details: prefer latest worker catalog, then display targets. */
export function findSatelliteForSelection(
  id: string,
  positionsById: ReadonlyMap<string, SatelliteCoordinates> | null | undefined,
  positionsRef: RefObject<SatelliteCoordinates[]>,
  targetPositionsRef: RefObject<SatelliteCoordinates[]>,
  catalogPositionsRef: RefObject<SatelliteCoordinates[]>,
): SatelliteCoordinates | undefined {
  const fromCatalog = findInList(id, catalogPositionsRef.current);
  if (fromCatalog) return fromCatalog;

  const fromTarget = findInList(id, targetPositionsRef.current);
  if (fromTarget) return fromTarget;

  const fromMap = positionsById?.get(id);
  if (fromMap && fromMap.id === id) return fromMap;

  return findInList(id, positionsRef.current);
}

export function getSatelliteFromMap(
  positionsById: ReadonlyMap<string, SatelliteCoordinates>,
  id: string,
  fallback?: SatelliteCoordinates | null,
): SatelliteCoordinates | null {
  return positionsById.get(id) ?? fallback ?? null;
}
