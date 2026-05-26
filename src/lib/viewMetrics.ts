import { EARTH_RADIUS_KM } from './geo';

const DEG2RAD = Math.PI / 180;

export interface ViewCenter {
  latitude: number;
  longitude: number;
}

export interface ViewRelativeMetrics {
  /** Great-circle distance on Earth's surface from the reference point to the satellite. */
  groundDistanceKm: number;
  /** Straight-line distance from the reference point (sea level) to the satellite. */
  slantRangeKm: number;
  /** Satellite altitude above mean sea level. */
  heightKm: number;
}

/** Spherical ECEF in km; axes match the globe scene (Y-up). */
function geodeticToEcefKm(
  latitude: number,
  longitude: number,
  altitudeKm: number,
): [number, number, number] {
  const latRad = latitude * DEG2RAD;
  const lonRad = longitude * DEG2RAD;
  const radius = EARTH_RADIUS_KM + altitudeKm;
  const cosLat = Math.cos(latRad);

  const x = radius * cosLat * Math.cos(lonRad);
  const y = radius * Math.sin(latRad);
  const z = radius * cosLat * Math.sin(lonRad);

  return [x, y, z];
}

export function greatCircleDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const lat1Rad = lat1 * DEG2RAD;
  const lat2Rad = lat2 * DEG2RAD;
  const dLat = lat2Rad - lat1Rad;
  const dLon = (lon2 - lon1) * DEG2RAD;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

/** Straight-line distance from origin (sea level) to the satellite in space. */
export function slantRangeKm(
  satellite: { latitude: number; longitude: number; altitude: number },
  origin: ViewCenter,
): number {
  const [x1, y1, z1] = geodeticToEcefKm(
    origin.latitude,
    origin.longitude,
    0,
  );
  const [x2, y2, z2] = geodeticToEcefKm(
    satellite.latitude,
    satellite.longitude,
    satellite.altitude,
  );

  return Math.hypot(x2 - x1, y2 - y1, z2 - z1);
}

export function viewRelativeMetrics(
  satellite: { latitude: number; longitude: number; altitude: number },
  origin: ViewCenter,
): ViewRelativeMetrics {
  const groundDistanceKm = greatCircleDistanceKm(
    origin.latitude,
    origin.longitude,
    satellite.latitude,
    satellite.longitude,
  );

  return {
    groundDistanceKm,
    slantRangeKm: slantRangeKm(satellite, origin),
    heightKm: satellite.altitude,
  };
}

export function formatDistanceKm(km: number): string {
  if (!Number.isFinite(km)) return '—';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 100) return `${km.toFixed(1)} km`;
  if (km < 10_000) return `${Math.round(km)} km`;
  return `${(km / 1000).toFixed(1)}k km`;
}

export function formatHeightKm(km: number): string {
  if (!Number.isFinite(km)) return '—';
  return `${Math.round(km)} km`;
}
