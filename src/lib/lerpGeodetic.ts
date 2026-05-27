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

function assignSlot(
  slot: SatelliteCoordinates | undefined,
  source: Pick<
    SatelliteCoordinates,
    'id' | 'name' | 'latitude' | 'longitude' | 'altitude'
  >,
): SatelliteCoordinates {
  if (!slot) {
    return {
      id: source.id,
      name: source.name,
      latitude: source.latitude,
      longitude: source.longitude,
      altitude: source.altitude,
    };
  }
  slot.id = source.id;
  slot.name = source.name;
  slot.latitude = source.latitude;
  slot.longitude = source.longitude;
  slot.altitude = source.altitude;
  return slot;
}

/** True when `dest` already matches `source` id order and values. */
export function positionsMatchSource(
  dest: ReadonlyArray<SatelliteCoordinates>,
  source: ReadonlyArray<SatelliteCoordinates>,
): boolean {
  if (dest.length !== source.length) return false;
  for (let i = 0; i < source.length; i += 1) {
    const a = dest[i];
    const b = source[i];
    if (!a || a.id !== b.id) return false;
    if (
      a.latitude !== b.latitude ||
      a.longitude !== b.longitude ||
      a.altitude !== b.altitude
    ) {
      return false;
    }
  }
  return true;
}

/** Reuse or grow `dest` slots from `source` without allocating a new array. */
export function syncSatelliteCoordinates(
  dest: SatelliteCoordinates[],
  source: ReadonlyArray<SatelliteCoordinates>,
): void {
  dest.length = source.length;
  for (let i = 0; i < source.length; i += 1) {
    dest[i] = assignSlot(dest[i], source[i]);
  }
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

    if (!slot || slot.id !== target.id) {
      slot = assignSlot(slot, target);
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
