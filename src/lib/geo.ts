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

/**
 * Farthest camera distance (globe radii). Large enough to frame high-altitude
 * orbits: GPS/MEO sit at ~4.2 and GEO at ~6.6 globe radii from Earth's center,
 * so the camera must be able to pull back beyond them.
 */
export const MAX_CAMERA_DISTANCE = 9;

/** OrbitControls minimum distance (matches GlobeVisualizer). */
export const MIN_CAMERA_DISTANCE = GLOBE_RADIUS * 1.35;

/** Discrete zoom bands from farthest (1) to closest ({@link CAMERA_ZOOM_BANDS}). */
export const CAMERA_ZOOM_BANDS = 6;

/** Servicing link NORAD labels appear only in this many closest zoom bands. */
export const SERVICING_LABEL_ZOOM_BANDS = 2;

/** Max camera distance (from globe center) at which servicing labels may show. */
export function servicingLabelMaxCameraDistance(
  bands = CAMERA_ZOOM_BANDS,
  labelBands = SERVICING_LABEL_ZOOM_BANDS,
): number {
  const span = MAX_CAMERA_DISTANCE - MIN_CAMERA_DISTANCE;
  const hiddenBands = Math.max(0, bands - labelBands);
  return MIN_CAMERA_DISTANCE + (hiddenBands / bands) * span;
}

export function cameraZoomBand(
  cameraDistance: number,
  bands = CAMERA_ZOOM_BANDS,
): number {
  const clamped = Math.min(
    MAX_CAMERA_DISTANCE,
    Math.max(MIN_CAMERA_DISTANCE, cameraDistance),
  );
  const span = MAX_CAMERA_DISTANCE - MIN_CAMERA_DISTANCE;
  if (span <= 0) return bands;
  const fromClosest = (MAX_CAMERA_DISTANCE - clamped) / span;
  return Math.min(bands, Math.max(1, 1 + Math.floor(fromClosest * bands)));
}

export function isServicingLabelZoom(cameraDistance: number): boolean {
  return (
    cameraZoomBand(cameraDistance) >
    CAMERA_ZOOM_BANDS - SERVICING_LABEL_ZOOM_BANDS
  );
}

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

