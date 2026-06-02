import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Scene-space marker radius (matches GlobeVisualizer dot scale). */
export const SATELLITE_MARKER_RADIUS = 0.00175;

const ARROW_LENGTH = SATELLITE_MARKER_RADIUS * 1.1;
const ARROW_RADIUS = SATELLITE_MARKER_RADIUS * 0.425;

/**
 * Small sphere + cone along +Y (tip = direction of travel when oriented).
 */
export function createSatelliteMarkerGeometry(): THREE.BufferGeometry {
  const body = new THREE.SphereGeometry(SATELLITE_MARKER_RADIUS, 6, 6);
  const head = new THREE.ConeGeometry(ARROW_RADIUS, ARROW_LENGTH, 5);
  head.translate(0, SATELLITE_MARKER_RADIUS + ARROW_LENGTH * 0.5, 0);

  const merged = mergeGeometries([body, head]);
  body.dispose();
  head.dispose();

  if (!merged) {
    return new THREE.SphereGeometry(SATELLITE_MARKER_RADIUS, 6, 6);
  }

  merged.computeVertexNormals();
  return merged;
}
