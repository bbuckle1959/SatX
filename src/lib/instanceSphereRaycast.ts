import * as THREE from 'three';

const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _sphere = new THREE.Sphere();
const _hitPoint = new THREE.Vector3();

/**
 * Per-instance sphere raycast for picking (larger than visual geometry).
 * Only runs on pointer events, not every animation frame.
 */
export function attachInstanceSphereRaycast(
  mesh: THREE.InstancedMesh,
  radius: number,
): () => void {
  mesh.raycast = (raycaster, intersects) => {
    const count = mesh.count;
    if (count === 0) return;

    mesh.updateMatrixWorld(true);
    const matrixWorld = mesh.matrixWorld;

    for (let i = 0; i < count; i += 1) {
      mesh.getMatrixAt(i, _matrix);
      _position.setFromMatrixPosition(_matrix);
      _position.applyMatrix4(matrixWorld);
      _sphere.center.copy(_position);
      _sphere.radius = radius;

      const hit = raycaster.ray.intersectSphere(_sphere, _hitPoint);
      if (hit === null) continue;

      const distance = raycaster.ray.origin.distanceTo(_hitPoint);
      if (distance < raycaster.near || distance > raycaster.far) continue;

      intersects.push({
        distance,
        point: _hitPoint.clone(),
        object: mesh,
        instanceId: i,
      });
    }

    intersects.sort((a, b) => a.distance - b.distance);
  };

  return () => {
    mesh.raycast = THREE.InstancedMesh.prototype.raycast;
  };
}
