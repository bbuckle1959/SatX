import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';

import type { SatelliteCoordinates } from '../hooks/useSatellitePropagation';
import type { UserLocation } from '../hooks/useUserLocation';
import type { SatelliteLookTarget } from '../lib/starlinkPointing';
import {
  GLOBE_RADIAL_BIAS,
  GLOBE_SURFACE_BIAS,
  geodeticToCartesian,
} from '../lib/geo';
import { findSatelliteById } from '../lib/satelliteLookup';

/** Servicing link: your location → active Starlink satellite. */
const LINK_COLOR = '#ff9500';
/** Screen-space width of the rod (diameter in CSS pixels). */
const LINK_WIDTH_PX = 2;

function worldUnitsPerPixel(
  camera: THREE.Camera,
  viewportHeight: number,
  worldPoint: THREE.Vector3,
): number {
  if (!(camera instanceof THREE.PerspectiveCamera) || viewportHeight <= 0) {
    return 0.0004;
  }
  const dist = camera.position.distanceTo(worldPoint);
  if (dist < 1e-6) return 0.0004;
  const vFovRad = (camera.fov * Math.PI) / 180;
  const worldHeight = 2 * Math.tan(vFovRad / 2) * dist;
  return worldHeight / viewportHeight;
}

interface StarlinkServicingLayerProps {
  userLocation: UserLocation;
  servicingStarlink: SatelliteLookTarget;
  servicingStarlinkId: string;
  positionsById: ReadonlyMap<string, SatelliteCoordinates>;
  positionsRef: RefObject<SatelliteCoordinates[]>;
  targetPositionsRef: RefObject<SatelliteCoordinates[]>;
  catalogPositionsRef: RefObject<SatelliteCoordinates[]>;
}

function ServicingLink({
  userLocation,
  servicingStarlink,
  servicingStarlinkId,
  positionsById,
  positionsRef,
  targetPositionsRef,
  catalogPositionsRef,
}: StarlinkServicingLayerProps) {
  const userLocationRef = useRef(userLocation);
  userLocationRef.current = userLocation;

  const servicingRef = useRef(servicingStarlink);
  servicingRef.current = servicingStarlink;

  const { camera, size } = useThree();
  const meshRef = useRef<THREE.Mesh>(null);
  const start = useMemo(() => new THREE.Vector3(), []);
  const end = useMemo(() => new THREE.Vector3(), []);
  const direction = useMemo(() => new THREE.Vector3(), []);
  const midpoint = useMemo(() => new THREE.Vector3(), []);
  const axisUp = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const live =
      findSatelliteById(
        servicingStarlinkId,
        positionsById,
        positionsRef,
        targetPositionsRef,
        catalogPositionsRef,
      ) ?? servicingRef.current;

    const loc = userLocationRef.current;
    const [hx, hy, hz] = geodeticToCartesian(loc.latitude, loc.longitude, 0);
    const [sx, sy, sz] = geodeticToCartesian(
      live.latitude,
      live.longitude,
      live.altitude,
    );

    start.set(hx * GLOBE_SURFACE_BIAS, hy * GLOBE_SURFACE_BIAS, hz * GLOBE_SURFACE_BIAS);
    end.set(sx * GLOBE_RADIAL_BIAS, sy * GLOBE_RADIAL_BIAS, sz * GLOBE_RADIAL_BIAS);

    direction.subVectors(end, start);
    const length = direction.length();
    if (length < 1e-6) {
      mesh.visible = false;
      return;
    }

    mesh.visible = true;
    midpoint.copy(start).add(end).multiplyScalar(0.5);
    mesh.position.copy(midpoint);
    mesh.scale.set(
      worldUnitsPerPixel(camera, size.height, midpoint) * LINK_WIDTH_PX,
      length,
      worldUnitsPerPixel(camera, size.height, midpoint) * LINK_WIDTH_PX,
    );
    mesh.quaternion.setFromUnitVectors(axisUp, direction.normalize());
  });

  return (
    <mesh ref={meshRef} renderOrder={10}>
      <cylinderGeometry args={[0.5, 0.5, 1, 8]} />
      <meshBasicMaterial
        color={LINK_COLOR}
        toneMapped={false}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}

export function StarlinkServicingLayer(props: StarlinkServicingLayerProps) {
  return <ServicingLink {...props} />;
}
