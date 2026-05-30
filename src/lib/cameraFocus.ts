import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

import { DEFAULT_CAMERA_DISTANCE, MAX_CAMERA_DISTANCE } from './geo';

/**
 * Gap (globe radii) kept between the camera and the focused point so the
 * selected object sits just in front of the camera rather than on the near plane.
 */
const FOCUS_CLEARANCE = 0.9;

export function frameGlobeCameraOnDirection(
  camera: THREE.Camera,
  controls: OrbitControlsImpl | null,
  direction: THREE.Vector3,
  x: number,
  y: number,
  z: number,
  radialBias = 1,
): void {
  const px = x * radialBias;
  const py = y * radialBias;
  const pz = z * radialBias;

  // Distance of the focused point from Earth's center (globe radii). Surface
  // points are ~1; MEO/GEO satellites are several radii out. The camera sits on
  // the same ray but looks at the center, so it must be placed *beyond* the
  // point — otherwise high-altitude selections end up behind the view.
  const pointRadius = Math.hypot(px, py, pz);
  const distance = Math.min(
    MAX_CAMERA_DISTANCE,
    Math.max(DEFAULT_CAMERA_DISTANCE, pointRadius + FOCUS_CLEARANCE),
  );

  direction.set(px, py, pz).normalize();
  camera.position.copy(direction.multiplyScalar(distance));
  camera.lookAt(0, 0, 0);
  if (controls) {
    controls.target.set(0, 0, 0);
    controls.update();
  }
}
