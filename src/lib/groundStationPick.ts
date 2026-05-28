import * as THREE from 'three';

import { GLOBE_SURFACE_BIAS, geodeticToCartesian } from './geo';
import type { GroundStation } from './groundStationTypes';

const _position = new THREE.Vector3();
const _sphere = new THREE.Sphere();
const _hitPoint = new THREE.Vector3();
const _toStation = new THREE.Vector3();

/** Stations eligible for picking given sidebar toggles. */
export function filterGroundStationsForPick(
  stations: ReadonlyArray<GroundStation>,
  showGateways: boolean,
  showPops: boolean,
): GroundStation[] {
  if (!showGateways && !showPops) return [];
  return stations.filter((s) => {
    if (s.kind === 'pop') return showPops;
    return showGateways;
  });
}

/**
 * True when the pick ray passes near a visible ground site (generous sphere).
 * Used to suppress satellite hits along the same ray.
 */
export function rayPassesNearGroundStation(
  raycaster: THREE.Raycaster,
  stations: ReadonlyArray<Pick<GroundStation, 'latitude' | 'longitude'>>,
  sphereRadius: number,
): boolean {
  if (stations.length === 0) return false;

  const ray = raycaster.ray;
  for (let i = 0; i < stations.length; i += 1) {
    const station = stations[i];
    const [x, y, z] = geodeticToCartesian(
      station.latitude,
      station.longitude,
      0,
    );
    _position.set(
      x * GLOBE_SURFACE_BIAS,
      y * GLOBE_SURFACE_BIAS,
      z * GLOBE_SURFACE_BIAS,
    );
    _toStation.copy(_position).sub(ray.origin);
    if (_toStation.dot(ray.direction) <= 0) continue;

    _sphere.center.copy(_position);
    _sphere.radius = sphereRadius;
    if (ray.intersectSphere(_sphere, _hitPoint) !== null) return true;
  }

  return false;
}

/**
 * Prefer gateway/PoP when the click is near a station's screen projection
 * (satellites can sit along the same view ray but farther in depth).
 */
export function pickGroundStationAtClientPoint(
  clientX: number,
  clientY: number,
  domElement: HTMLElement,
  camera: THREE.Camera,
  stations: ReadonlyArray<GroundStation>,
  thresholdPx: number,
): string | null {
  if (stations.length === 0) return null;

  const rect = domElement.getBoundingClientRect();
  const localX = clientX - rect.left;
  const localY = clientY - rect.top;
  const thresholdSq = thresholdPx * thresholdPx;

  let bestId: string | null = null;
  let bestDistSq = thresholdSq;

  for (let i = 0; i < stations.length; i += 1) {
    const station = stations[i];
    const [x, y, z] = geodeticToCartesian(
      station.latitude,
      station.longitude,
      0,
    );
    _position.set(
      x * GLOBE_SURFACE_BIAS,
      y * GLOBE_SURFACE_BIAS,
      z * GLOBE_SURFACE_BIAS,
    );
    _position.project(camera);
    if (_position.z > 1) continue;

    const sx = (_position.x * 0.5 + 0.5) * rect.width;
    const sy = (-_position.y * 0.5 + 0.5) * rect.height;
    const dx = localX - sx;
    const dy = localY - sy;
    const distSq = dx * dx + dy * dy;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestId = station.id;
    }
  }

  return bestId;
}
