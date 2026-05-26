/** Mean Earth radius in km (used to scale altitude above the globe). */
export const EARTH_RADIUS_KM = 6371;

/** Globe radius in scene units (Three.js world space). */
export const GLOBE_RADIUS = 1;

/** Slight radial offset so markers and paths sit above the globe shell. */
export const GLOBE_RADIAL_BIAS = 1.0015;

/** Ground-track marker sits just above the nominal surface. */
export const GLOBE_SURFACE_BIAS = 1.002;

/** Default camera distance when framing a surface point. */
export const DEFAULT_CAMERA_DISTANCE = 2.75;

const DEG2RAD = Math.PI / 180;

/**
 * Geodetic (lat°, lon°, alt km) → Cartesian position on a Y-up sphere.
 * Altitude is expressed as distance above the nominal Earth surface.
 *
 * Longitude is negated so eastward ground tracks (increasing lon) match
 * the Three.js equirectangular earth texture and SphereGeometry UV winding.
 */
export function geodeticToCartesian(
  latitude: number,
  longitude: number,
  altitudeKm: number,
  globeRadius = GLOBE_RADIUS,
  earthRadiusKm = EARTH_RADIUS_KM,
): [number, number, number] {
  const surfaceRadius =
    globeRadius + (altitudeKm / earthRadiusKm) * globeRadius;
  const latRad = latitude * DEG2RAD;
  const lonRad = -longitude * DEG2RAD;

  const cosLat = Math.cos(latRad);
  const x = surfaceRadius * cosLat * Math.cos(lonRad);
  const y = surfaceRadius * Math.sin(latRad);
  const z = surfaceRadius * cosLat * Math.sin(lonRad);

  return [x, y, z];
}

