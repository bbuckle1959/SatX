import * as THREE from 'three';

import type { SatelliteCoordinates } from '../hooks/useSatellitePropagation';
import type { UserLocation } from '../hooks/useUserLocation';
import {
  classifyObjectType,
  matchesObjectTypeFilter,
  type ObjectType,
  type ObjectTypeFilter,
} from './objectTypes';
import { geodeticToCartesian } from './geo';
import { GLOBE_MAX_INSTANCES } from './globeLimits';
import { SATELLITE_MARKER_RADIUS } from './satelliteMarkerGeometry';

/** Max instanced markers on mobile (GPU / battery budget). */
export const MOBILE_GLOBE_MAX_INSTANCES = 6_000;

/** Desktop uses {@link GLOBE_MAX_INSTANCES} from globeLimits. */
export const MOBILE_PICK_RADIUS_MULTIPLIER = 3.5;

const DESKTOP_PICK_RADIUS_MULTIPLIER = 1;

/** Types omitted on mobile when showing “all” (background / clutter). */
export const MOBILE_SUPPRESSED_TYPES: ReadonlySet<ObjectType> = new Set([
  'debris',
]);

const _observer = new THREE.Vector3();
const _satellite = new THREE.Vector3();
const _toSat = new THREE.Vector3();
const _up = new THREE.Vector3();

export function getGlobeMaxInstances(isMobile: boolean): number {
  return isMobile ? MOBILE_GLOBE_MAX_INSTANCES : GLOBE_MAX_INSTANCES;
}

/** Sphere radius for instanced-mesh raycast picking (not the visible mesh). */
export function getSatellitePickRadius(isMobile: boolean): number {
  const base = SATELLITE_MARKER_RADIUS * 4;
  const mult = isMobile
    ? MOBILE_PICK_RADIUS_MULTIPLIER
    : DESKTOP_PICK_RADIUS_MULTIPLIER;
  return base * mult;
}

/**
 * Suggested `raycaster.params.Points.threshold` for auxiliary picking
 * (instanced satellites use per-sphere raycast in instanceSphereRaycast).
 */
export function getPointsRaycastThreshold(isMobile: boolean): number {
  return isMobile ? 0.12 : 0.04;
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

function isStarlinkName(name: string): boolean {
  return /STARLINK/i.test(name);
}

/**
 * Worker/catalog ID list for mobile: drop debris-like populations and prefer
 * Starlink payloads (up to {@link MOBILE_GLOBE_MAX_INSTANCES}).
 */
export function filterCatalogIdsForMobileWorker(
  satellites: ReadonlyArray<{ id: string; name: string }>,
  objectTypeFilter: ObjectTypeFilter,
  typeById: ReadonlyMap<string, ObjectType>,
): string[] {
  if (objectTypeFilter !== 'all') {
    const ids: string[] = [];
    for (const sat of satellites) {
      if (!matchesObjectTypeFilter(sat.id, objectTypeFilter, typeById)) continue;
      ids.push(sat.id);
      if (ids.length >= MOBILE_GLOBE_MAX_INSTANCES) break;
    }
    return ids;
  }

  const starlinkIds: string[] = [];
  const otherIds: string[] = [];

  for (const sat of satellites) {
    const type = typeById.get(sat.id) ?? classifyObjectType(sat.name);
    if (MOBILE_SUPPRESSED_TYPES.has(type)) continue;

    if (type === 'starlink' || isStarlinkName(sat.name)) {
      starlinkIds.push(sat.id);
    } else {
      otherIds.push(sat.id);
    }
  }

  if (starlinkIds.length >= MOBILE_GLOBE_MAX_INSTANCES) {
    return starlinkIds.slice(0, MOBILE_GLOBE_MAX_INSTANCES);
  }

  const remaining = MOBILE_GLOBE_MAX_INSTANCES - starlinkIds.length;
  return [...starlinkIds, ...otherIds.slice(0, remaining)];
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

/**
 * Per-frame display set: overhead cone when location known, else catalog order;
 * always keeps pinned ids (selection / servicing).
 */
export function filterPositionsForMobileDisplay(
  positions: ReadonlyArray<SatelliteCoordinates>,
  userLocation: UserLocation | null,
  pinIds: ReadonlyArray<string | null | undefined>,
  maxInstances: number = MOBILE_GLOBE_MAX_INSTANCES,
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
    const overhead: SatelliteCoordinates[] = [];
    for (const sat of pool) {
      if (elevationDegFromObserver(sat, userLocation) > 0) {
        overhead.push(sat);
      }
    }
    if (overhead.length > 0) {
      overhead.sort(
        (a, b) =>
          elevationDegFromObserver(b, userLocation) -
          elevationDegFromObserver(a, userLocation),
      );
      candidates = overhead;
    } else {
      candidates = pool.filter(
        (sat) =>
          (typeHint(sat) === 'starlink' || isStarlinkName(sat.name)),
      );
    }
  } else {
    candidates = pool.filter(
      (sat) => typeHint(sat) === 'starlink' || isStarlinkName(sat.name),
    );
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

function typeHint(sat: SatelliteCoordinates): ObjectType {
  return classifyObjectType(sat.name);
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
