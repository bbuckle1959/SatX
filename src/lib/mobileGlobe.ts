import { GLOBE_MAX_INSTANCES } from './globeLimits';
import {
  elevationDegFromObserver,
  filterCatalogIdsForWorker,
  filterPositionsForDisplay,
  getDisplayOptions,
  getWorkerOptions,
  MOBILE_SUPPRESSED_TYPES,
  prioritizePinnedPositions,
} from './globeCatalog';
import { SATELLITE_MARKER_RADIUS } from './satelliteMarkerGeometry';

/** Max instanced markers on mobile (GPU / battery budget). */
export const MOBILE_GLOBE_MAX_INSTANCES = 6_000;

export const MOBILE_PICK_RADIUS_MULTIPLIER = 3.5;

const DESKTOP_PICK_RADIUS_MULTIPLIER = 1;

export {
  elevationDegFromObserver,
  filterPositionsForDisplay,
  MOBILE_SUPPRESSED_TYPES,
  prioritizePinnedPositions,
};

/** @deprecated Use {@link filterCatalogIdsForWorker} via globe catalog helpers. */
export function filterCatalogIdsForMobileWorker(
  satellites: Parameters<typeof filterCatalogIdsForWorker>[0],
  objectTypeFilter: Parameters<typeof filterCatalogIdsForWorker>[1],
  typeById: Parameters<typeof filterCatalogIdsForWorker>[2],
): string[] {
  return filterCatalogIdsForWorker(satellites, objectTypeFilter, typeById, {
    maxInstances: MOBILE_GLOBE_MAX_INSTANCES,
    mode: 'capped',
    preferStarlinkWhenAll: true,
    suppressedTypes: MOBILE_SUPPRESSED_TYPES,
  });
}

/** @deprecated Use {@link filterPositionsForDisplay}. */
export function filterPositionsForMobileDisplay(
  positions: Parameters<typeof filterPositionsForDisplay>[0],
  userLocation: Parameters<typeof filterPositionsForDisplay>[1],
  pinIds: Parameters<typeof filterPositionsForDisplay>[2],
  maxInstances: number = MOBILE_GLOBE_MAX_INSTANCES,
): ReturnType<typeof filterPositionsForDisplay> {
  return filterPositionsForDisplay(
    positions,
    userLocation,
    pinIds,
    maxInstances,
    new Map(),
    { starlinkOnlyFallback: true },
  );
}

export function getGlobeMaxInstances(isMobile: boolean): number {
  return isMobile ? MOBILE_GLOBE_MAX_INSTANCES : GLOBE_MAX_INSTANCES;
}

export function getSatellitePickRadius(isMobile: boolean): number {
  const base = SATELLITE_MARKER_RADIUS * 4;
  const mult = isMobile
    ? MOBILE_PICK_RADIUS_MULTIPLIER
    : DESKTOP_PICK_RADIUS_MULTIPLIER;
  return base * mult;
}

export function getPointsRaycastThreshold(isMobile: boolean): number {
  return isMobile ? 0.12 : 0.04;
}

export interface MobileGlobeRenderProfile {
  maxInstances: number;
  pickRadius: number;
  pointsRaycastThreshold: number;
  starsCount: number;
  earthSegments: number;
  antialias: boolean;
}

export function getMobileGlobeRenderProfile(
  isMobile: boolean,
): MobileGlobeRenderProfile {
  if (!isMobile) {
    return {
      maxInstances: GLOBE_MAX_INSTANCES,
      pickRadius: getSatellitePickRadius(false),
      pointsRaycastThreshold: getPointsRaycastThreshold(false),
      starsCount: 800,
      earthSegments: 48,
      antialias: true,
    };
  }

  return {
    maxInstances: MOBILE_GLOBE_MAX_INSTANCES,
    pickRadius: getSatellitePickRadius(true),
    pointsRaycastThreshold: getPointsRaycastThreshold(true),
    starsCount: 200,
    earthSegments: 32,
    antialias: false,
  };
}

export { getDisplayOptions, getWorkerOptions };
