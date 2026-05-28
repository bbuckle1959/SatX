import * as THREE from 'three';

import { geodeticToCartesian } from './geo';
import { isStarlinkObject, type ObjectType } from './objectTypes';

const DEG2RAD = Math.PI / 180;

/** Ignore satellites below this elevation at the dish (trees, buildings). */
export const MIN_SERVICING_SATELLITE_ELEVATION_DEG = 25;

export interface GeodeticObserver {
  latitude: number;
  longitude: number;
}

export interface SatelliteLookTarget {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  altitude: number;
}

/**
 * Starlink reports true-north compass azimuth (° clockwise, [-180, 180]).
 * The globe uses negated longitude in {@link geodeticToCartesian}, so the scene
 * tangent "east" axis is mirrored; negate dish azimuth before sin/cos so e.g.
 * -154° from the dish is not treated as +154° on the map.
 */
export function starlinkAzimuthToSceneDeg(azimuthDeg: number): number {
  return -azimuthDeg;
}

/**
 * Unit vector in scene space for dish boresight from Starlink azimuth/elevation (°)
 * at the observer.
 */
export function dishPointingUnitVector(
  observer: GeodeticObserver,
  azimuthDeg: number,
  elevationDeg: number,
): THREE.Vector3 {
  const az = starlinkAzimuthToSceneDeg(azimuthDeg) * DEG2RAD;
  const el = elevationDeg * DEG2RAD;

  const east = Math.cos(el) * Math.sin(az);
  const north = Math.cos(el) * Math.cos(az);
  const up = Math.sin(el);

  const [ox, oy, oz] = geodeticToCartesian(
    observer.latitude,
    observer.longitude,
    0,
  );
  const observerPos = new THREE.Vector3(ox, oy, oz);
  const upAxis = observerPos.clone().normalize();

  const [nx, ny, nz] = geodeticToCartesian(
    observer.latitude + 0.02,
    observer.longitude,
    0,
  );
  const northAxis = new THREE.Vector3(nx, ny, nz)
    .sub(observerPos)
    .normalize();
  const eastAxis = new THREE.Vector3().crossVectors(upAxis, northAxis).normalize();
  northAxis.crossVectors(eastAxis, upAxis).normalize();

  return new THREE.Vector3()
    .addScaledVector(eastAxis, east)
    .addScaledVector(northAxis, north)
    .addScaledVector(upAxis, up)
    .normalize();
}

/**
 * Pick the Starlink satellite whose direction from the observer best aligns with
 * the dish boresight (smallest angular separation). Only considers satellites at
 * least {@link MIN_SERVICING_SATELLITE_ELEVATION_DEG} above the local horizon.
 */
export function findServicingStarlink(
  observer: GeodeticObserver,
  azimuthDeg: number,
  elevationDeg: number,
  satellites: ReadonlyArray<SatelliteLookTarget>,
  typeById: ReadonlyMap<string, ObjectType>,
): SatelliteLookTarget | null {
  const pointing = dishPointingUnitVector(observer, azimuthDeg, elevationDeg);
  const [ox, oy, oz] = geodeticToCartesian(observer.latitude, observer.longitude, 0);
  const observerPos = new THREE.Vector3(ox, oy, oz);
  const upAxis = observerPos.clone().normalize();
  const minElRad = MIN_SERVICING_SATELLITE_ELEVATION_DEG * DEG2RAD;

  let best: SatelliteLookTarget | null = null;
  let bestAngleRad = Infinity;

  for (const sat of satellites) {
    if (!isStarlinkObject(sat.id, sat.name, typeById)) continue;

    const [sx, sy, sz] = geodeticToCartesian(
      sat.latitude,
      sat.longitude,
      sat.altitude,
    );
    const toSat = new THREE.Vector3(sx, sy, sz).sub(observerPos);
    const range = toSat.length();
    if (range < 1e-6) continue;

    const sinEl = THREE.MathUtils.clamp(toSat.dot(upAxis) / range, -1, 1);
    if (Math.asin(sinEl) < minElRad) continue;

    toSat.normalize();
    const dot = THREE.MathUtils.clamp(pointing.dot(toSat), -1, 1);
    const angle = Math.acos(dot);

    if (angle < bestAngleRad) {
      bestAngleRad = angle;
      best = sat;
    }
  }

  return best;
}
