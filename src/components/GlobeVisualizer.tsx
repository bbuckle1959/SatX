import { OrbitControls, Stars, useTexture } from '@react-three/drei';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

import type { SatelliteCoordinates } from '../hooks/useSatellitePropagation';
import { lerpSatelliteCoordinates } from '../lib/lerpGeodetic';
import type { UserLocation } from '../hooks/useUserLocation';
import type { SatelliteLookTarget } from '../lib/starlinkPointing';
import {
  DEFAULT_CAMERA_DISTANCE,
  GLOBE_RADIUS,
  GLOBE_RADIAL_BIAS,
  geodeticToCartesian,
} from '../lib/geo';
import { StarlinkServicingLayer } from './StarlinkServicingLayer';
import { attachInstanceSphereRaycast } from '../lib/instanceSphereRaycast';
import {
  createSatelliteMarkerGeometry,
  SATELLITE_MARKER_RADIUS,
} from '../lib/satelliteMarkerGeometry';
import earthTextureUrl from '../assets/earth_day.jpg';

import { getMobileGlobeRenderProfile } from '../lib/mobileGlobe';
import {
  isStarlinkObject,
  type ObjectType,
} from '../lib/objectTypes';
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
/** Bundled by Vite (`src/assets`) so path works in dev, preview, and Tauri. */
const EARTH_TEXTURE_URL = earthTextureUrl;

function findSatelliteById(
  id: string,
  positionsRef: RefObject<SatelliteCoordinates[]>,
  targetPositionsRef: RefObject<SatelliteCoordinates[]>,
  catalogPositionsRef: RefObject<SatelliteCoordinates[]>,
): SatelliteCoordinates | undefined {
  const sources = [
    positionsRef.current,
    targetPositionsRef.current,
    catalogPositionsRef.current,
  ];
  for (const list of sources) {
    for (let i = 0; i < list.length; i += 1) {
      if (list[i].id === id) return list[i];
    }
  }
  return undefined;
}

interface GlobeSceneProps {
  positionsRef: RefObject<SatelliteCoordinates[]>;
  targetPositionsRef: RefObject<SatelliteCoordinates[]>;
  lerpFromRef: RefObject<SatelliteCoordinates[]>;
  lerpStartAtRef: RefObject<number>;
  lerpDurationMs: number;
  selectedId: string | null;
  selectedIdRef: RefObject<string | null>;
  typeById: ReadonlyMap<string, ObjectType>;
  servicingStarlinkIdRef: RefObject<string | null>;
  servicingStarlinkId: string | null;
  servicingStarlink: SatelliteLookTarget | null;
  catalogPositionsRef: RefObject<SatelliteCoordinates[]>;
  userLocation: UserLocation | null;
  onSelectSatelliteRef: RefObject<(id: string | null) => void>;
  onRenderFps: (fps: number) => void;
  isMobile: boolean;
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
  maxInstances: number;
  pickRadius: number;
}

function MobileRaycasterTuning({
  pointsThreshold,
}: {
  pointsThreshold: number;
}) {
  const { raycaster } = useThree();

  useEffect(() => {
    raycaster.params.Points.threshold = pointsThreshold;
    raycaster.params.Line.threshold = pointsThreshold * 0.65;
    raycaster.params.Mesh.threshold = pointsThreshold * 0.5;
  }, [raycaster, pointsThreshold]);

  return null;
}

function EarthPlaceholder({ segments }: { segments: number }) {
  return (
    <mesh>
      <sphereGeometry args={[GLOBE_RADIUS, segments, segments]} />
      <meshBasicMaterial color="#1a4a7a" toneMapped={false} />
    </mesh>
  );
}

/** Texture + meshBasicMaterial so the map is always visible (not washed out by lights). */
function EarthGlobeTextured({
  onSelectSatelliteRef,
  segments,
}: {
  onSelectSatelliteRef: RefObject<(id: string | null) => void>;
  segments: number;
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
      <sphereGeometry args={[GLOBE_RADIUS, segments, segments]} />
      <meshBasicMaterial map={earthMap} toneMapped={false} />
    </mesh>
  );
}

function EarthGlobe({
  onSelectSatelliteRef,
  segments,
}: {
  onSelectSatelliteRef: RefObject<(id: string | null) => void>;
  segments: number;
}) {
  return (
    <Suspense fallback={<EarthPlaceholder segments={segments} />}>
      <EarthGlobeTextured
        onSelectSatelliteRef={onSelectSatelliteRef}
        segments={segments}
      />
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
  maxInstances,
  pickRadius,
}: SatelliteInstancesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const meshSetupRef = useRef(false);
  const detachRaycastRef = useRef<(() => void) | null>(null);
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

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return undefined;
    detachRaycastRef.current?.();
    detachRaycastRef.current = attachInstanceSphereRaycast(mesh, pickRadius);
    meshSetupRef.current = true;
    return () => {
      detachRaycastRef.current?.();
      detachRaycastRef.current = null;
    };
  }, [pickRadius]);

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
          new Float32Array(maxInstances * 3),
          3,
        );
      }
      detachRaycastRef.current?.();
      detachRaycastRef.current = attachInstanceSphereRaycast(mesh, pickRadius);
      meshSetupRef.current = true;
    }

    const selectedId = selectedIdRef.current;
    const servicingId = servicingStarlinkIdRef.current;
    const visibleIds: string[] = [];
    let instanceIndex = 0;
    let selectedScenePos: { x: number; y: number; z: number } | null = null;

    for (
      let i = 0;
      i < satellites.length && instanceIndex < maxInstances;
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
      args={[geometry, material, maxInstances]}
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

function UserLocationMarker({
  location,
  isMobile,
}: {
  location: UserLocation;
  isMobile: boolean;
}) {
  const [x, y, z] = geodeticToCartesian(location.latitude, location.longitude, 0);
  const coreRadius = isMobile ? 0.0073 : 0.0027;
  const haloRadius = isMobile ? 0.0133 : 0;

  return (
    <group position={[x, y, z]}>
      {isMobile && (
        <mesh renderOrder={1}>
          <sphereGeometry args={[haloRadius, 16, 16]} />
          <meshBasicMaterial
            color="#dc2626"
            transparent
            opacity={0.3}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      )}
      <mesh renderOrder={2}>
        <sphereGeometry args={[coreRadius, isMobile ? 16 : 10, isMobile ? 16 : 10]} />
        <meshBasicMaterial color="#ef4444" toneMapped={false} />
      </mesh>
    </group>
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

function CameraFocusOnSelection({
  selectedId,
  selectedIdRef,
  selectedScenePosRef,
  positionsRef,
  targetPositionsRef,
  catalogPositionsRef,
  typeById,
  controlsRef,
}: {
  selectedId: string | null;
  selectedIdRef: RefObject<string | null>;
  selectedScenePosRef: RefObject<{ x: number; y: number; z: number } | null>;
  positionsRef: RefObject<SatelliteCoordinates[]>;
  targetPositionsRef: RefObject<SatelliteCoordinates[]>;
  catalogPositionsRef: RefObject<SatelliteCoordinates[]>;
  typeById: ReadonlyMap<string, ObjectType>;
  controlsRef: RefObject<OrbitControlsImpl | null>;
}) {
  const { camera } = useThree();
  const pendingFocusIdRef = useRef<string | null>(null);
  const direction = useMemo(() => new THREE.Vector3(), []);

  const frameCamera = (x: number, y: number, z: number) => {
    direction.set(x, y, z).normalize();
    camera.position.copy(direction.multiplyScalar(DEFAULT_CAMERA_DISTANCE));
    camera.lookAt(0, 0, 0);
    const controls = controlsRef.current;
    if (controls) {
      controls.target.set(0, 0, 0);
      controls.update();
    }
  };

  useEffect(() => {
    if (!selectedId) {
      pendingFocusIdRef.current = null;
      return;
    }

    const sat = findSatelliteById(
      selectedId,
      positionsRef,
      targetPositionsRef,
      catalogPositionsRef,
    );
    const name = sat?.name ?? '';
    if (isStarlinkObject(selectedId, name, typeById)) {
      pendingFocusIdRef.current = null;
      return;
    }

    pendingFocusIdRef.current = selectedId;
  }, [
    selectedId,
    typeById,
    positionsRef,
    targetPositionsRef,
    catalogPositionsRef,
  ]);

  useFrame(() => {
    const pendingId = pendingFocusIdRef.current;
    if (!pendingId || selectedIdRef.current !== pendingId) return;

    const scenePos = selectedScenePosRef.current;
    if (scenePos) {
      frameCamera(
        scenePos.x * MARKER_RADIAL_BIAS,
        scenePos.y * MARKER_RADIAL_BIAS,
        scenePos.z * MARKER_RADIAL_BIAS,
      );
      pendingFocusIdRef.current = null;
      return;
    }

    const sat = findSatelliteById(
      pendingId,
      positionsRef,
      targetPositionsRef,
      catalogPositionsRef,
    );
    if (!sat) return;

    const [x, y, z] = geodeticToCartesian(
      sat.latitude,
      sat.longitude,
      sat.altitude,
    );
    frameCamera(x * GLOBE_RADIAL_BIAS, y * GLOBE_RADIAL_BIAS, z * GLOBE_RADIAL_BIAS);
    pendingFocusIdRef.current = null;
  });

  return null;
}

function GlobeOrbitControls({
  controlsRef,
  userLocation,
  selectedId,
  selectedIdRef,
  selectedScenePosRef,
  positionsRef,
  targetPositionsRef,
  catalogPositionsRef,
  typeById,
}: {
  controlsRef: RefObject<OrbitControlsImpl | null>;
  userLocation: UserLocation | null;
  selectedId: string | null;
  selectedIdRef: RefObject<string | null>;
  selectedScenePosRef: RefObject<{ x: number; y: number; z: number } | null>;
  positionsRef: RefObject<SatelliteCoordinates[]>;
  targetPositionsRef: RefObject<SatelliteCoordinates[]>;
  catalogPositionsRef: RefObject<SatelliteCoordinates[]>;
  typeById: ReadonlyMap<string, ObjectType>;
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
      <CameraFocusOnSelection
        selectedId={selectedId}
        selectedIdRef={selectedIdRef}
        selectedScenePosRef={selectedScenePosRef}
        positionsRef={positionsRef}
        targetPositionsRef={targetPositionsRef}
        catalogPositionsRef={catalogPositionsRef}
        typeById={typeById}
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
  selectedIdRef,
  typeById,
  servicingStarlinkIdRef,
  servicingStarlinkId,
  servicingStarlink,
  catalogPositionsRef,
  userLocation,
  onSelectSatelliteRef,
  onRenderFps,
  isMobile,
}: GlobeSceneProps) {
  const renderProfile = useMemo(
    () => getMobileGlobeRenderProfile(isMobile),
    [isMobile],
  );
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

      <MobileRaycasterTuning
        pointsThreshold={renderProfile.pointsRaycastThreshold}
      />

      <Stars
        radius={80}
        depth={40}
        count={renderProfile.starsCount}
        factor={2}
        saturation={0}
        fade
        speed={0}
      />

      <EarthGlobe
        onSelectSatelliteRef={onSelectSatelliteRef}
        segments={renderProfile.earthSegments}
      />
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
        maxInstances={renderProfile.maxInstances}
        pickRadius={renderProfile.pickRadius}
      />
      <SelectedMarker
        selectedIdRef={selectedIdRef}
        selectedScenePosRef={selectedScenePosRef}
      />

      {userLocation && (
        <UserLocationMarker location={userLocation} isMobile={isMobile} />
      )}

      {userLocation && servicingStarlink && servicingStarlinkId && (
        <StarlinkServicingLayer
          userLocation={userLocation}
          servicingStarlink={servicingStarlink}
          servicingStarlinkId={servicingStarlinkId}
          positionsRef={positionsRef}
          targetPositionsRef={targetPositionsRef}
          catalogPositionsRef={catalogPositionsRef}
        />
      )}

      <GlobeOrbitControls
        controlsRef={controlsRef}
        userLocation={userLocation}
        selectedId={selectedId}
        selectedIdRef={selectedIdRef}
        selectedScenePosRef={selectedScenePosRef}
        positionsRef={positionsRef}
        targetPositionsRef={targetPositionsRef}
        catalogPositionsRef={catalogPositionsRef}
        typeById={typeById}
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
  selectedIdRef: RefObject<string | null>;
  typeById: ReadonlyMap<string, ObjectType>;
  servicingStarlinkIdRef: RefObject<string | null>;
  servicingStarlinkId: string | null;
  servicingStarlink: SatelliteLookTarget | null;
  catalogPositionsRef: RefObject<SatelliteCoordinates[]>;
  userLocation: UserLocation | null;
  onSelectSatellite: (id: string | null) => void;
  onRenderFps: (fps: number) => void;
  isMobile: boolean;
}

export function GlobeVisualizer({
  positionsRef,
  targetPositionsRef,
  lerpFromRef,
  lerpStartAtRef,
  lerpDurationMs,
  selectedId,
  selectedIdRef,
  typeById,
  servicingStarlinkIdRef,
  servicingStarlinkId,
  servicingStarlink,
  catalogPositionsRef,
  userLocation,
  onSelectSatellite,
  onRenderFps,
  isMobile,
}: GlobeVisualizerProps) {
  const onSelectSatelliteRef = useRef(onSelectSatellite);
  onSelectSatelliteRef.current = onSelectSatellite;
  const renderProfile = useMemo(
    () => getMobileGlobeRenderProfile(isMobile),
    [isMobile],
  );
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
          antialias: renderProfile.antialias,
          powerPreference: 'high-performance',
          alpha: false,
          logarithmicDepthBuffer: true,
        }}
        dpr={isMobile ? [1, 1.5] : undefined}
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
          selectedIdRef={selectedIdRef}
          typeById={typeById}
          servicingStarlinkIdRef={servicingStarlinkIdRef}
          servicingStarlinkId={servicingStarlinkId}
          servicingStarlink={servicingStarlink}
          catalogPositionsRef={catalogPositionsRef}
          userLocation={userLocation}
          onSelectSatelliteRef={onSelectSatelliteRef}
          onRenderFps={onRenderFps}
          isMobile={isMobile}
        />
      </Canvas>
    </div>
  );
}
