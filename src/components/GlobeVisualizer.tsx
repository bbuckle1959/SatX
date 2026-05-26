import { OrbitControls, Stars, useTexture } from '@react-three/drei';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

import type { SatelliteCoordinates } from '../hooks/useSatellitePropagation';
import { lerpSatelliteCoordinates } from '../lib/lerpGeodetic';
import type { UserLocation } from '../hooks/useUserLocation';
import type { DishSite } from '../lib/dishSite';
import {
  DEFAULT_CAMERA_DISTANCE,
  GLOBE_RADIUS,
  GLOBE_RADIAL_BIAS,
  geodeticToCartesian,
} from '../lib/geo';
import type { TleRecord } from '../services/spaceTrack';
import { SelectedOrbitPath } from './SelectedOrbitPath';
import { StarlinkServicingLayer } from './StarlinkServicingLayer';
import type { StarlinkAlignment } from './StarlinkPanel';
import { attachInstanceSphereRaycast } from '../lib/instanceSphereRaycast';
import {
  createSatelliteMarkerGeometry,
  SATELLITE_MARKER_RADIUS,
} from '../lib/satelliteMarkerGeometry';
import earthTextureUrl from '../assets/earth_day.jpg';

import { GLOBE_MAX_INSTANCES } from '../lib/globeLimits';

const MAX_INSTANCES = GLOBE_MAX_INSTANCES;
const MARKER_UP = new THREE.Vector3(0, 1, 0);
const MARKER_DIRECTION = new THREE.Vector3();
const MARKER_RADIAL_BIAS = GLOBE_RADIAL_BIAS;
const MIN_MOVE_SQ = 1e-16;
const DEFAULT_SAT_COLOR = '#5eead4';
const SELECTED_SAT_COLOR = '#fbbf24';
const SERVICING_STARLINK_COLOR = '#ff9500';

interface MarkerFrameState {
  x: number;
  y: number;
  z: number;
  latitude: number;
  longitude: number;
  altitude: number;
  quaternion: THREE.Quaternion;
}

function applyMarkerOrientation(
  dummy: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  sat: SatelliteCoordinates,
  prev: MarkerFrameState | undefined,
): void {
  const moved =
    !prev ||
    prev.latitude !== sat.latitude ||
    prev.longitude !== sat.longitude ||
    prev.altitude !== sat.altitude;

  if (!moved) {
    dummy.quaternion.copy(prev!.quaternion);
    return;
  }

  if (prev) {
    MARKER_DIRECTION.set(x - prev.x, y - prev.y, z - prev.z);
    if (MARKER_DIRECTION.lengthSq() > MIN_MOVE_SQ) {
      MARKER_DIRECTION.normalize();
      dummy.quaternion.setFromUnitVectors(MARKER_UP, MARKER_DIRECTION);
      return;
    }
    dummy.quaternion.copy(prev.quaternion);
    return;
  }

  dummy.quaternion.identity();
}
/** Sphere radius used only during pointer raycast (not rendered). */
const PICK_RADIUS = SATELLITE_MARKER_RADIUS * 4;

/** Bundled by Vite (`src/assets`) so path works in dev, preview, and Tauri. */
const EARTH_TEXTURE_URL = earthTextureUrl;

interface GlobeSceneProps {
  positionsRef: RefObject<SatelliteCoordinates[]>;
  targetPositionsRef: RefObject<SatelliteCoordinates[]>;
  lerpFromRef: RefObject<SatelliteCoordinates[]>;
  lerpStartAtRef: RefObject<number>;
  lerpDurationMs: number;
  selectedId: string | null;
  selectedTle: TleRecord | null;
  selectedIdRef: RefObject<string | null>;
  servicingStarlinkIdRef: RefObject<string | null>;
  starlinkAlignment: StarlinkAlignment | null;
  dishSite: DishSite | null;
  userLocation: UserLocation | null;
  onSelectSatelliteRef: RefObject<(id: string | null) => void>;
  onRenderFps: (fps: number) => void;
}

interface SatelliteInstancesProps {
  positionsRef: RefObject<SatelliteCoordinates[]>;
  targetPositionsRef: RefObject<SatelliteCoordinates[]>;
  lerpFromRef: RefObject<SatelliteCoordinates[]>;
  lerpStartAtRef: RefObject<number>;
  lerpDurationMs: number;
  selectedIdRef: RefObject<string | null>;
  servicingStarlinkIdRef: RefObject<string | null>;
  visibleInstanceIdsRef: RefObject<string[]>;
  selectedScenePosRef: RefObject<{ x: number; y: number; z: number } | null>;
  onSelectSatelliteRef: RefObject<(id: string | null) => void>;
}

function EarthPlaceholder() {
  return (
    <mesh>
      <sphereGeometry args={[GLOBE_RADIUS, 48, 48]} />
      <meshBasicMaterial color="#1a4a7a" toneMapped={false} />
    </mesh>
  );
}

/** Texture + meshBasicMaterial so the map is always visible (not washed out by lights). */
function EarthGlobeTextured({
  onSelectSatelliteRef,
}: {
  onSelectSatelliteRef: RefObject<(id: string | null) => void>;
}) {
  const { gl } = useThree();
  const earthMap = useTexture(EARTH_TEXTURE_URL);

  useEffect(() => {
    earthMap.colorSpace = THREE.SRGBColorSpace;
    earthMap.anisotropy = gl.capabilities.getMaxAnisotropy();
    earthMap.needsUpdate = true;
  }, [earthMap, gl]);

  return (
    <mesh
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onSelectSatelliteRef.current(null);
      }}
    >
      <sphereGeometry args={[GLOBE_RADIUS, 48, 48]} />
      <meshBasicMaterial map={earthMap} toneMapped={false} />
    </mesh>
  );
}

function EarthGlobe({
  onSelectSatelliteRef,
}: {
  onSelectSatelliteRef: RefObject<(id: string | null) => void>;
}) {
  return (
    <Suspense fallback={<EarthPlaceholder />}>
      <EarthGlobeTextured onSelectSatelliteRef={onSelectSatelliteRef} />
    </Suspense>
  );
}

function SatelliteInstances({
  positionsRef,
  targetPositionsRef,
  lerpFromRef,
  lerpStartAtRef,
  lerpDurationMs,
  selectedIdRef,
  servicingStarlinkIdRef,
  visibleInstanceIdsRef,
  selectedScenePosRef,
  onSelectSatelliteRef,
}: SatelliteInstancesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const meshSetupRef = useRef(false);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const markerStateRef = useRef(new Map<string, MarkerFrameState>());

  const [geometry, material] = useMemo(() => {
    const geom = createSatelliteMarkerGeometry();
    const mat = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      toneMapped: false,
      depthWrite: false,
      depthTest: true,
    });
    return [geom, mat];
  }, []);

  const selectInstance = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const idx = e.instanceId;
    if (idx === undefined || idx < 0) return;
    const satId = visibleInstanceIdsRef.current[idx];
    if (satId) onSelectSatelliteRef.current(satId);
  };

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const targets = targetPositionsRef.current;
    if (targets.length > 0) {
      const elapsed = performance.now() - lerpStartAtRef.current;
      const alpha = Math.min(1, elapsed / lerpDurationMs);
      lerpSatelliteCoordinates(
        positionsRef.current,
        lerpFromRef.current,
        targets,
        alpha,
      );
    }

    const satellites = positionsRef.current;
    if (!satellites.length) return;

    if (!meshSetupRef.current) {
      if (!mesh.instanceColor) {
        mesh.instanceColor = new THREE.InstancedBufferAttribute(
          new Float32Array(MAX_INSTANCES * 3),
          3,
        );
      }
      attachInstanceSphereRaycast(mesh, PICK_RADIUS);
      meshSetupRef.current = true;
    }

    const selectedId = selectedIdRef.current;
    const servicingId = servicingStarlinkIdRef.current;
    const visibleIds: string[] = [];
    let instanceIndex = 0;
    let selectedScenePos: { x: number; y: number; z: number } | null = null;

    for (
      let i = 0;
      i < satellites.length && instanceIndex < MAX_INSTANCES;
      i += 1
    ) {
      const sat = satellites[i];
      const [x, y, z] = geodeticToCartesian(
        sat.latitude,
        sat.longitude,
        sat.altitude,
      );

      dummy.position.set(
        x * MARKER_RADIAL_BIAS,
        y * MARKER_RADIAL_BIAS,
        z * MARKER_RADIAL_BIAS,
      );

      let state = markerStateRef.current.get(sat.id);
      if (!state) {
        state = {
          x: 0,
          y: 0,
          z: 0,
          latitude: 0,
          longitude: 0,
          altitude: 0,
          quaternion: new THREE.Quaternion(),
        };
        markerStateRef.current.set(sat.id, state);
      }

      applyMarkerOrientation(dummy, x, y, z, sat, state);
      state.x = x;
      state.y = y;
      state.z = z;
      state.latitude = sat.latitude;
      state.longitude = sat.longitude;
      state.altitude = sat.altitude;
      state.quaternion.copy(dummy.quaternion);

      if (sat.id === selectedId) {
        selectedScenePos = { x, y, z };
      }

      dummy.updateMatrix();
      mesh.setMatrixAt(instanceIndex, dummy.matrix);

      if (sat.id === selectedId) {
        color.set(SELECTED_SAT_COLOR);
      } else if (servicingId && sat.id === servicingId) {
        color.set(SERVICING_STARLINK_COLOR);
      } else {
        color.set(DEFAULT_SAT_COLOR);
      }
      mesh.setColorAt(instanceIndex, color);

      visibleIds.push(sat.id);
      instanceIndex += 1;
    }

    visibleInstanceIdsRef.current = visibleIds;
    selectedScenePosRef.current = selectedScenePos;

    if (visibleIds.length < markerStateRef.current.size) {
      const visibleSet = new Set(visibleIds);
      for (const id of markerStateRef.current.keys()) {
        if (!visibleSet.has(id)) markerStateRef.current.delete(id);
      }
    }

    mesh.count = instanceIndex;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, MAX_INSTANCES]}
      frustumCulled={false}
      renderOrder={2}
      onClick={selectInstance}
      onPointerDown={selectInstance}
      onPointerOver={(e) => {
        e.stopPropagation();
        if (e.instanceId !== undefined) {
          document.body.style.cursor = 'pointer';
        }
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'default';
      }}
    />
  );
}

function SelectedMarker({
  selectedIdRef,
  selectedScenePosRef,
}: {
  selectedIdRef: RefObject<string | null>;
  selectedScenePosRef: RefObject<{ x: number; y: number; z: number } | null>;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    if (!selectedIdRef.current) {
      mesh.visible = false;
      return;
    }

    const pos = selectedScenePosRef.current;
    if (!pos) {
      mesh.visible = false;
      return;
    }

    mesh.position.set(
      pos.x * MARKER_RADIAL_BIAS,
      pos.y * MARKER_RADIAL_BIAS,
      pos.z * MARKER_RADIAL_BIAS,
    );
    mesh.visible = true;
  });

  return (
    <mesh ref={meshRef} visible={false}>
      <sphereGeometry args={[SATELLITE_MARKER_RADIUS * 2, 10, 10]} />
      <meshBasicMaterial
        color="#fbbf24"
        transparent
        opacity={0.35}
        toneMapped={false}
        depthWrite={false}
      />
    </mesh>
  );
}

function UserLocationMarker({ location }: { location: UserLocation }) {
  const [x, y, z] = geodeticToCartesian(location.latitude, location.longitude, 0);

  return (
    <mesh position={[x, y, z]}>
      <sphereGeometry args={[0.008, 12, 12]} />
      <meshBasicMaterial color="#7dd3fc" toneMapped={false} />
    </mesh>
  );
}

function CameraFocusOnUser({
  userLocation,
  controlsRef,
}: {
  userLocation: UserLocation | null;
  controlsRef: RefObject<OrbitControlsImpl | null>;
}) {
  const { camera } = useThree();
  const hasCenteredRef = useRef(false);
  const direction = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    if (!userLocation || hasCenteredRef.current) return;

    const [x, y, z] = geodeticToCartesian(
      userLocation.latitude,
      userLocation.longitude,
      0,
    );
    direction.set(x, y, z).normalize();
    camera.position.copy(direction.multiplyScalar(DEFAULT_CAMERA_DISTANCE));
    camera.lookAt(0, 0, 0);

    const controls = controlsRef.current;
    if (controls) {
      controls.target.set(0, 0, 0);
      controls.update();
    }

    hasCenteredRef.current = true;
  }, [userLocation, camera, controlsRef, direction]);

  return null;
}

function GlobeOrbitControls({
  controlsRef,
  userLocation,
}: {
  controlsRef: RefObject<OrbitControlsImpl | null>;
  userLocation: UserLocation | null;
}) {
  return (
    <>
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        minDistance={GLOBE_RADIUS * 1.35}
        maxDistance={GLOBE_RADIUS * 6}
        rotateSpeed={0.45}
        zoomSpeed={0.9}
        dampingFactor={0.08}
        enableDamping
      />
      <CameraFocusOnUser
        userLocation={userLocation}
        controlsRef={controlsRef}
      />
    </>
  );
}

function RenderFpsTracker({ onRenderFps }: { onRenderFps: (fps: number) => void }) {
  const framesRef = useRef(0);
  const windowStartRef = useRef(performance.now());
  const onRenderFpsRef = useRef(onRenderFps);
  onRenderFpsRef.current = onRenderFps;

  useFrame(() => {
    const now = performance.now();
    framesRef.current += 1;
    const elapsed = now - windowStartRef.current;
    if (elapsed >= 500) {
      onRenderFpsRef.current(
        Math.round((framesRef.current * 1000) / Math.max(elapsed, 1)),
      );
      framesRef.current = 0;
      windowStartRef.current = now;
    }
  });

  return null;
}

function GlobeScene({
  positionsRef,
  targetPositionsRef,
  lerpFromRef,
  lerpStartAtRef,
  lerpDurationMs,
  selectedId,
  selectedTle,
  selectedIdRef,
  servicingStarlinkIdRef,
  starlinkAlignment,
  dishSite,
  userLocation,
  onSelectSatelliteRef,
  onRenderFps,
}: GlobeSceneProps) {
  const visibleInstanceIdsRef = useRef<string[]>([]);
  const selectedScenePosRef = useRef<{ x: number; y: number; z: number } | null>(
    null,
  );
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  return (
    <>
      <ambientLight intensity={0.62} />
      <hemisphereLight
        color="#b8d4f8"
        groundColor="#3d2e24"
        intensity={0.55}
      />
      <directionalLight position={[5, 2, 4]} intensity={0.85} />
      <directionalLight position={[-4, -1, -3]} intensity={0.18} />

      <Stars
        radius={80}
        depth={40}
        count={800}
        factor={2}
        saturation={0}
        fade
        speed={0}
      />

      <EarthGlobe onSelectSatelliteRef={onSelectSatelliteRef} />
      <SatelliteInstances
        positionsRef={positionsRef}
        targetPositionsRef={targetPositionsRef}
        lerpFromRef={lerpFromRef}
        lerpStartAtRef={lerpStartAtRef}
        lerpDurationMs={lerpDurationMs}
        selectedIdRef={selectedIdRef}
        servicingStarlinkIdRef={servicingStarlinkIdRef}
        visibleInstanceIdsRef={visibleInstanceIdsRef}
        selectedScenePosRef={selectedScenePosRef}
        onSelectSatelliteRef={onSelectSatelliteRef}
      />
      <SelectedMarker
        selectedIdRef={selectedIdRef}
        selectedScenePosRef={selectedScenePosRef}
      />

      <SelectedOrbitPath
        selectedId={selectedId}
        selectedTle={selectedTle}
        positionsRef={positionsRef}
      />

      {userLocation && <UserLocationMarker location={userLocation} />}

      {starlinkAlignment && dishSite && (
        <StarlinkServicingLayer
          dishSite={dishSite}
          servicingStarlinkIdRef={servicingStarlinkIdRef}
          positionsRef={positionsRef}
        />
      )}

      <GlobeOrbitControls
        controlsRef={controlsRef}
        userLocation={userLocation}
      />

      <RenderFpsTracker onRenderFps={onRenderFps} />
    </>
  );
}

interface GlobeVisualizerProps {
  positionsRef: RefObject<SatelliteCoordinates[]>;
  targetPositionsRef: RefObject<SatelliteCoordinates[]>;
  lerpFromRef: RefObject<SatelliteCoordinates[]>;
  lerpStartAtRef: RefObject<number>;
  lerpDurationMs: number;
  selectedId: string | null;
  selectedTle: TleRecord | null;
  selectedIdRef: RefObject<string | null>;
  servicingStarlinkIdRef: RefObject<string | null>;
  starlinkAlignment: StarlinkAlignment | null;
  dishSite: DishSite | null;
  userLocation: UserLocation | null;
  onSelectSatellite: (id: string | null) => void;
  onRenderFps: (fps: number) => void;
}

export function GlobeVisualizer({
  positionsRef,
  targetPositionsRef,
  lerpFromRef,
  lerpStartAtRef,
  lerpDurationMs,
  selectedId,
  selectedTle,
  selectedIdRef,
  servicingStarlinkIdRef,
  starlinkAlignment,
  dishSite,
  userLocation,
  onSelectSatellite,
  onRenderFps,
}: GlobeVisualizerProps) {
  const onSelectSatelliteRef = useRef(onSelectSatellite);
  onSelectSatelliteRef.current = onSelectSatellite;
  return (
    <div className="globe-wrap">
      <Canvas
        camera={{
          position: [0, 0.15, 2.75],
          fov: 45,
          near: 0.01,
          far: 200,
        }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          alpha: false,
          logarithmicDepthBuffer: true,
        }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.NoToneMapping;
        }}
      >
        <color attach="background" args={['#050810']} />
        <GlobeScene
          positionsRef={positionsRef}
          targetPositionsRef={targetPositionsRef}
          lerpFromRef={lerpFromRef}
          lerpStartAtRef={lerpStartAtRef}
          lerpDurationMs={lerpDurationMs}
          selectedId={selectedId}
          selectedTle={selectedTle}
          selectedIdRef={selectedIdRef}
          servicingStarlinkIdRef={servicingStarlinkIdRef}
          starlinkAlignment={starlinkAlignment}
          dishSite={dishSite}
          userLocation={userLocation}
          onSelectSatelliteRef={onSelectSatelliteRef}
          onRenderFps={onRenderFps}
        />
      </Canvas>
    </div>
  );
}
