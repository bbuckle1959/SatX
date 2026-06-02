import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import {
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
} from 'react';
import * as THREE from 'three';

import type { SatelliteCoordinates } from '../hooks/useSatellitePropagation';
import type { UserLocation } from '../hooks/useUserLocation';
import type { SatelliteLookTarget } from '../lib/starlinkPointing';
import {
  GLOBE_RADIAL_BIAS,
  GLOBE_SURFACE_BIAS,
  geodeticToCartesian,
  isServicingLabelZoom,
} from '../lib/geo';
import { findSatelliteById } from '../lib/satelliteLookup';

/** Rank 1 → 3: strongest → weaker alignment with dish boresight. */
export const SERVICING_LINK_COLORS = ['#ff9500', '#f59e0b', '#fbbf24'] as const;

const LINK_WIDTH_PX = 2;
/** Label sits 38% along the link from your location toward the satellite. */
const LABEL_ALONG_LINE = 0.38;

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

export interface ServicingCandidateLink {
  id: string;
  name: string;
  rank: number;
}

interface StarlinkServicingLayerProps {
  userLocation: UserLocation;
  candidates: ReadonlyArray<ServicingCandidateLink>;
  positionsById: ReadonlyMap<string, SatelliteCoordinates>;
  positionsRef: RefObject<SatelliteCoordinates[]>;
  targetPositionsRef: RefObject<SatelliteCoordinates[]>;
  catalogPositionsRef: RefObject<SatelliteCoordinates[]>;
  onSelectServicingLabelRef: RefObject<(id: string) => void>;
  selectedId: string | null;
}

interface ServicingLinkProps {
  userLocation: UserLocation;
  candidate: ServicingCandidateLink;
  fallback: SatelliteLookTarget;
  positionsById: ReadonlyMap<string, SatelliteCoordinates>;
  positionsRef: RefObject<SatelliteCoordinates[]>;
  targetPositionsRef: RefObject<SatelliteCoordinates[]>;
  catalogPositionsRef: RefObject<SatelliteCoordinates[]>;
  onSelectServicingLabelRef: RefObject<(id: string) => void>;
  selectedId: string | null;
}

function ServicingLink({
  userLocation,
  candidate,
  fallback,
  positionsById,
  positionsRef,
  targetPositionsRef,
  catalogPositionsRef,
  onSelectServicingLabelRef,
  selectedId,
}: ServicingLinkProps) {
  const userLocationRef = useRef(userLocation);
  userLocationRef.current = userLocation;
  const candidateIdRef = useRef(candidate.id);
  candidateIdRef.current = candidate.id;

  const { camera, size } = useThree();
  const meshRef = useRef<THREE.Mesh>(null);
  const labelGroupRef = useRef<THREE.Group>(null);
  const [labelVisible, setLabelVisible] = useState(false);
  const labelVisibleRef = useRef(false);
  const start = useMemo(() => new THREE.Vector3(), []);
  const end = useMemo(() => new THREE.Vector3(), []);
  const direction = useMemo(() => new THREE.Vector3(), []);
  const midpoint = useMemo(() => new THREE.Vector3(), []);
  const labelPos = useMemo(() => new THREE.Vector3(), []);
  const axisUp = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  const linkColor =
    SERVICING_LINK_COLORS[candidate.rank] ?? SERVICING_LINK_COLORS[2];

  useFrame(() => {
    const mesh = meshRef.current;
    const labelGroup = labelGroupRef.current;
    if (!mesh) return;

    const live =
      findSatelliteById(
        candidate.id,
        positionsById,
        positionsRef,
        targetPositionsRef,
        catalogPositionsRef,
      ) ?? fallback;

    const loc = userLocationRef.current;
    const [hx, hy, hz] = geodeticToCartesian(loc.latitude, loc.longitude, 0);
    const [sx, sy, sz] = geodeticToCartesian(
      live.latitude,
      live.longitude,
      live.altitude,
    );

    start.set(
      hx * GLOBE_SURFACE_BIAS,
      hy * GLOBE_SURFACE_BIAS,
      hz * GLOBE_SURFACE_BIAS,
    );
    end.set(sx * GLOBE_RADIAL_BIAS, sy * GLOBE_RADIAL_BIAS, sz * GLOBE_RADIAL_BIAS);

    direction.subVectors(end, start);
    const length = direction.length();
    if (length < 1e-6) {
      mesh.visible = false;
      if (labelGroup) labelGroup.visible = false;
      labelVisibleRef.current = false;
      if (labelVisible) setLabelVisible(false);
      return;
    }

    mesh.visible = true;
    midpoint.copy(start).add(end).multiplyScalar(0.5);
    const wupp = worldUnitsPerPixel(camera, size.height, midpoint);
    mesh.position.copy(midpoint);
    mesh.scale.set(wupp * LINK_WIDTH_PX, length, wupp * LINK_WIDTH_PX);
    mesh.quaternion.setFromUnitVectors(axisUp, direction.clone().normalize());

    labelPos.copy(start).lerp(end, LABEL_ALONG_LINE);
    const showLabel = isServicingLabelZoom(camera.position.length());

    if (labelGroup) {
      labelGroup.position.copy(labelPos);
      labelGroup.visible = showLabel;
    }
    if (showLabel !== labelVisibleRef.current) {
      labelVisibleRef.current = showLabel;
      setLabelVisible(showLabel);
    }
  });

  const selectLabel = (e: MouseEvent | PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    e.nativeEvent.stopImmediatePropagation();
    onSelectServicingLabelRef.current(candidateIdRef.current);
  };

  return (
    <group>
      <mesh ref={meshRef} renderOrder={10 + candidate.rank}>
        <cylinderGeometry args={[0.5, 0.5, 1, 8]} />
        <meshBasicMaterial
          color={linkColor}
          toneMapped={false}
          depthTest={false}
          depthWrite={false}
          transparent
          opacity={candidate.rank === 0 ? 1 : 0.88}
        />
      </mesh>
      <group ref={labelGroupRef} visible={false}>
        {labelVisible && (
          <Html
            key={candidate.id}
            center
            transform={false}
            occlude={false}
            zIndexRange={[100 + candidate.rank, 0]}
            style={{ pointerEvents: 'none' }}
          >
            <button
              type="button"
              className={[
                'servicing-link-label',
                selectedId === candidate.id
                  ? 'servicing-link-label--selected'
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ borderColor: linkColor, pointerEvents: 'auto' }}
              title={`${candidate.name} — view details`}
              aria-pressed={selectedId === candidate.id}
              onPointerDown={selectLabel}
              onClick={selectLabel}
            >
              {candidate.id}
            </button>
          </Html>
        )}
      </group>
    </group>
  );
}

export function StarlinkServicingLayer({
  userLocation,
  candidates,
  positionsById,
  positionsRef,
  targetPositionsRef,
  catalogPositionsRef,
  onSelectServicingLabelRef,
  selectedId,
}: StarlinkServicingLayerProps) {
  return (
    <>
      {candidates.map((candidate) => {
        const fallback: SatelliteLookTarget = {
          id: candidate.id,
          name: candidate.name,
          latitude: 0,
          longitude: 0,
          altitude: 0,
        };
        const live =
          findSatelliteById(
            candidate.id,
            positionsById,
            positionsRef,
            targetPositionsRef,
            catalogPositionsRef,
          ) ?? fallback;

        return (
          <ServicingLink
            key={candidate.id}
            userLocation={userLocation}
            candidate={candidate}
            fallback={live}
            positionsById={positionsById}
            positionsRef={positionsRef}
            targetPositionsRef={targetPositionsRef}
            catalogPositionsRef={catalogPositionsRef}
            onSelectServicingLabelRef={onSelectServicingLabelRef}
            selectedId={selectedId}
          />
        );
      })}
    </>
  );
}
