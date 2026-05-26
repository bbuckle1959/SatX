import { useFrame } from '@react-three/fiber';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import * as THREE from 'three';

import type { SatelliteCoordinates } from '../hooks/useSatellitePropagation';
import { GLOBE_SURFACE_BIAS, geodeticToCartesian } from '../lib/geo';
import {
  computeOrbitPathSegments,
  groundTrackEndpoints,
  ORBIT_PATH_STEP_MIN,
} from '../lib/orbitPath';
import type { TleRecord } from '../services/spaceTrack';

const ORBIT_GLOW_OUTER = '#0ea5e9';
const ORBIT_GLOW_INNER = '#7dd3fc';
const GROUND_LINE_COLOR = '#38bdf8';
const GROUND_DOT_COLOR = '#bae6fd';

interface SelectedOrbitPathProps {
  selectedId: string | null;
  selectedTle: TleRecord | null;
  positionsRef: RefObject<SatelliteCoordinates[]>;
}

function OrbitPathSegment({
  points,
  color,
  opacity,
}: {
  points: THREE.Vector3[];
  color: string;
  opacity: number;
}) {
  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      toneMapped: false,
    });
    const obj = new THREE.Line(geometry, material);
    obj.renderOrder = 3;
    return obj;
  }, [points, color, opacity]);

  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    },
    [line],
  );

  return <primitive object={line} />;
}

function OrbitPathRing({ segments }: { segments: THREE.Vector3[][] }) {
  if (segments.length === 0) return null;

  return (
    <group>
      {segments.map((points, index) => (
        <group key={index}>
          <OrbitPathSegment
            points={points}
            color={ORBIT_GLOW_OUTER}
            opacity={0.35}
          />
          <OrbitPathSegment
            points={points}
            color={ORBIT_GLOW_INNER}
            opacity={0.75}
          />
        </group>
      ))}
    </group>
  );
}

function GroundTrackPlumb({
  selectedId,
  positionsRef,
}: {
  selectedId: string | null;
  positionsRef: RefObject<SatelliteCoordinates[]>;
}) {
  const geometryRef = useRef(new THREE.BufferGeometry());
  const positionArrayRef = useRef(new Float32Array(6));

  useEffect(() => {
    const attr = new THREE.BufferAttribute(positionArrayRef.current, 3);
    geometryRef.current.setAttribute('position', attr);
    return () => geometryRef.current.dispose();
  }, []);

  useFrame(() => {
    if (!selectedId) return;

    const satellites = positionsRef.current;
    let sat: SatelliteCoordinates | undefined;
    for (let i = 0; i < satellites.length; i += 1) {
      if (satellites[i].id === selectedId) {
        sat = satellites[i];
        break;
      }
    }
    if (!sat) return;

    const { satellite, surface } = groundTrackEndpoints(
      sat.latitude,
      sat.longitude,
      sat.altitude,
    );
    const arr = positionArrayRef.current;
    arr[0] = satellite.x;
    arr[1] = satellite.y;
    arr[2] = satellite.z;
    arr[3] = surface.x;
    arr[4] = surface.y;
    arr[5] = surface.z;
    const attr = geometryRef.current.getAttribute(
      'position',
    ) as THREE.BufferAttribute;
    attr.needsUpdate = true;
  });

  if (!selectedId) return null;

  return (
    <lineSegments geometry={geometryRef.current} renderOrder={4}>
      <lineBasicMaterial
        color={GROUND_LINE_COLOR}
        transparent
        opacity={0.75}
        depthWrite={false}
        toneMapped={false}
      />
    </lineSegments>
  );
}

function GroundTrackDot({
  selectedId,
  positionsRef,
}: {
  selectedId: string | null;
  positionsRef: RefObject<SatelliteCoordinates[]>;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    if (!selectedId) {
      mesh.visible = false;
      return;
    }

    const satellites = positionsRef.current;
    let sat: SatelliteCoordinates | undefined;
    for (let i = 0; i < satellites.length; i += 1) {
      if (satellites[i].id === selectedId) {
        sat = satellites[i];
        break;
      }
    }
    if (!sat) {
      mesh.visible = false;
      return;
    }

    const [gx, gy, gz] = geodeticToCartesian(sat.latitude, sat.longitude, 0);
    mesh.position.set(
      gx * GLOBE_SURFACE_BIAS,
      gy * GLOBE_SURFACE_BIAS,
      gz * GLOBE_SURFACE_BIAS,
    );
    mesh.visible = true;
  });

  return (
    <mesh ref={meshRef} visible={false} renderOrder={5}>
      <sphereGeometry args={[0.007, 12, 12]} />
      <meshBasicMaterial
        color={GROUND_DOT_COLOR}
        transparent
        opacity={0.95}
        toneMapped={false}
        depthWrite={false}
      />
    </mesh>
  );
}

export function SelectedOrbitPath({
  selectedId,
  selectedTle,
  positionsRef,
}: SelectedOrbitPathProps) {
  const [orbitSegments, setOrbitSegments] = useState<THREE.Vector3[][]>([]);

  const recomputePath = useCallback(() => {
    if (!selectedId || !selectedTle) {
      setOrbitSegments([]);
      return;
    }

    const segments = computeOrbitPathSegments(
      selectedTle.line1,
      selectedTle.line2,
      new Date(),
    );
    setOrbitSegments(segments);
  }, [selectedId, selectedTle]);

  useEffect(() => {
    recomputePath();

    const refreshMs = ORBIT_PATH_STEP_MIN * 60 * 1000;
    const timer = window.setInterval(recomputePath, refreshMs);
    return () => window.clearInterval(timer);
  }, [recomputePath]);

  if (!selectedId || !selectedTle || orbitSegments.length === 0) return null;

  return (
    <>
      <OrbitPathRing segments={orbitSegments} />
      <GroundTrackPlumb selectedId={selectedId} positionsRef={positionsRef} />
      <GroundTrackDot selectedId={selectedId} positionsRef={positionsRef} />
    </>
  );
}
