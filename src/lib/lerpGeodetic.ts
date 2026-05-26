import type { SatelliteCoordinates } from '../hooks/useSatellitePropagation';

/** Smooth 3D display between worker samples (matches ORBIT_TICK_MS). */
export const ORBIT_LERP_MS = 250;

function lerpLongitude(from: number, to: number, alpha: number): number {
  let delta = to - from;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  let lng = from + delta * alpha;
  if (lng > 180) lng -= 360;
  if (lng < -180) lng += 360;
  return lng;
}

export function copySatelliteCoordinates(
  source: ReadonlyArray<SatelliteCoordinates>,
): SatelliteCoordinates[] {
  return source.map((sat) => ({
    id: sat.id,
    name: sat.name,
    latitude: sat.latitude,
    longitude: sat.longitude,
    altitude: sat.altitude,
    velocityX: sat.velocityX,
    velocityY: sat.velocityY,
    velocityZ: sat.velocityZ,
  }));
}

/**
 * Write lerped geodetic positions into `out` (resized to match `to`).
 * Longitude uses shortest arc; lat/alt are linear.
 */
export function lerpSatelliteCoordinates(
  out: SatelliteCoordinates[],
  from: ReadonlyArray<SatelliteCoordinates>,
  to: ReadonlyArray<SatelliteCoordinates>,
  alpha: number,
): void {
  const t = alpha >= 1 ? 1 : alpha <= 0 ? 0 : alpha;
  const count = to.length;
  out.length = count;

  for (let i = 0; i < count; i += 1) {
    const target = to[i];
    const prev = from[i];
    let slot = out[i];

    if (!slot) {
      slot = {
        id: target.id,
        name: target.name,
        latitude: target.latitude,
        longitude: target.longitude,
        altitude: target.altitude,
        velocityX: 0,
        velocityY: 1,
        velocityZ: 0,
      };
      out[i] = slot;
    } else {
      slot.id = target.id;
      slot.name = target.name;
    }

    if (!prev || t >= 1) {
      slot.latitude = target.latitude;
      slot.longitude = target.longitude;
      slot.altitude = target.altitude;
      continue;
    }

    if (t <= 0) {
      slot.latitude = prev.latitude;
      slot.longitude = prev.longitude;
      slot.altitude = prev.altitude;
      continue;
    }

    slot.latitude = prev.latitude + (target.latitude - prev.latitude) * t;
    slot.longitude = lerpLongitude(prev.longitude, target.longitude, t);
    slot.altitude = prev.altitude + (target.altitude - prev.altitude) * t;
  }
}
