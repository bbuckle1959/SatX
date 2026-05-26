import {
  degreesLat,
  degreesLong,
  eciToGeodetic,
  gstime,
  propagate,
  twoline2satrec,
} from 'satellite.js';
import * as THREE from 'three';

import {
  GLOBE_RADIAL_BIAS,
  GLOBE_SURFACE_BIAS,
  geodeticToCartesian,
} from './geo';

/** One nominal orbit ahead (minutes). */
export const ORBIT_PATH_DURATION_MIN = 90;
/** Sample interval along the projected path (minutes). */
export const ORBIT_PATH_STEP_MIN = 2;

export interface OrbitPathSample {
  latitude: number;
  longitude: number;
  altitudeKm: number;
}

function isFiniteGeodetic(lat: number, lng: number, alt: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Number.isFinite(alt) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Propagate a TLE from `startDate` forward in fixed time steps.
 * Returns 46 samples by default (0…90 min inclusive, every 2 min).
 */
export function sampleOrbitPath(
  line1: string,
  line2: string,
  startDate: Date = new Date(),
  durationMin = ORBIT_PATH_DURATION_MIN,
  stepMin = ORBIT_PATH_STEP_MIN,
): OrbitPathSample[] | null {
  let satrec;
  try {
    satrec = twoline2satrec(line1, line2);
    if (satrec.error !== 0) return null;
  } catch {
    return null;
  }

  const samples: OrbitPathSample[] = [];
  const stepMs = stepMin * 60 * 1000;
  const endMs = durationMin * 60 * 1000;
  const startMs = startDate.getTime();

  for (let offset = 0; offset <= endMs; offset += stepMs) {
    const date = new Date(startMs + offset);
    try {
      const gmst = gstime(date);
      const pv = propagate(satrec, date);
      const eci = pv?.position;
      if (!eci) continue;

      const geodetic = eciToGeodetic(eci, gmst);
      const latitude = degreesLat(geodetic.latitude);
      const longitude = degreesLong(geodetic.longitude);
      const altitudeKm = geodetic.height;

      if (!isFiniteGeodetic(latitude, longitude, altitudeKm)) continue;

      samples.push({ latitude, longitude, altitudeKm });
    } catch {
      // skip bad propagation instants
    }
  }

  return samples.length >= 2 ? samples : null;
}

function isValidScenePoint(v: THREE.Vector3): boolean {
  const r = v.length();
  return (
    Number.isFinite(v.x) &&
    Number.isFinite(v.y) &&
    Number.isFinite(v.z) &&
    r > 0.85 &&
    r < 2.5
  );
}

/**
 * Break a path when longitude jumps (antimeridian / dateline) so we never draw
 * a chord across the globe — that chord makes fat-line renderers fill the screen.
 */
export function splitSamplesByLongitude(
  samples: ReadonlyArray<OrbitPathSample>,
  maxLonStepDeg = 45,
): OrbitPathSample[][] {
  if (samples.length < 2) return [];

  const segments: OrbitPathSample[][] = [];
  let current: OrbitPathSample[] = [samples[0]];

  for (let i = 1; i < samples.length; i += 1) {
    const prev = current[current.length - 1];
    const next = samples[i];
    let delta = Math.abs(next.longitude - prev.longitude);
    if (delta > 180) delta = 360 - delta;

    if (delta > maxLonStepDeg && current.length >= 2) {
      segments.push(current);
      current = [next];
    } else {
      current.push(next);
    }
  }

  if (current.length >= 2) segments.push(current);
  return segments;
}

export function orbitSamplesToVector3(
  samples: ReadonlyArray<OrbitPathSample>,
  radialBias = GLOBE_RADIAL_BIAS,
): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  for (const sample of samples) {
    const [x, y, z] = geodeticToCartesian(
      sample.latitude,
      sample.longitude,
      sample.altitudeKm,
    );
    const v = new THREE.Vector3(x * radialBias, y * radialBias, z * radialBias);
    if (isValidScenePoint(v)) points.push(v);
  }
  return points;
}

/** Orbit polylines as separate segments (no dateline chords). */
export function computeOrbitPathSegments(
  line1: string,
  line2: string,
  startDate: Date = new Date(),
): THREE.Vector3[][] {
  const samples = sampleOrbitPath(line1, line2, startDate);
  if (!samples) return [];

  return splitSamplesByLongitude(samples)
    .map((segment) => orbitSamplesToVector3(segment))
    .filter((segment) => segment.length >= 2);
}

/** Full orbit path as one polyline (legacy); prefer `computeOrbitPathSegments`. */
export function computeOrbitPathPoints(
  line1: string,
  line2: string,
  startDate: Date = new Date(),
): THREE.Vector3[] | null {
  const segments = computeOrbitPathSegments(line1, line2, startDate);
  if (segments.length === 0) return null;
  return segments.flat();
}

/** Radial plumb line: current satellite position → sub-satellite point on the globe. */
export function groundTrackEndpoints(
  latitude: number,
  longitude: number,
  altitudeKm: number,
): { satellite: THREE.Vector3; surface: THREE.Vector3 } {
  const [sx, sy, sz] = geodeticToCartesian(latitude, longitude, altitudeKm);
  const [gx, gy, gz] = geodeticToCartesian(latitude, longitude, 0);
  return {
    satellite: new THREE.Vector3(
      sx * GLOBE_RADIAL_BIAS,
      sy * GLOBE_RADIAL_BIAS,
      sz * GLOBE_RADIAL_BIAS,
    ),
    surface: new THREE.Vector3(
      gx * GLOBE_SURFACE_BIAS,
      gy * GLOBE_SURFACE_BIAS,
      gz * GLOBE_SURFACE_BIAS,
    ),
  };
}
