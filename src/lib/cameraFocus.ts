import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

import { DEFAULT_CAMERA_DISTANCE } from './geo';

export function frameGlobeCameraOnDirection(
  camera: THREE.Camera,
  controls: OrbitControlsImpl | null,
  direction: THREE.Vector3,
  x: number,
  y: number,
  z: number,
  radialBias = 1,
): void {
  direction.set(x * radialBias, y * radialBias, z * radialBias).normalize();
  camera.position.copy(direction.multiplyScalar(DEFAULT_CAMERA_DISTANCE));
  camera.lookAt(0, 0, 0);
  if (controls) {
    controls.target.set(0, 0, 0);
    controls.update();
  }
}
