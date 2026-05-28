import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';

import { attachInstanceSphereRaycast } from '../lib/instanceSphereRaycast';
import { GLOBE_SURFACE_BIAS, geodeticToCartesian } from '../lib/geo';
import type { GroundStation } from '../lib/groundStationTypes';

const GATEWAY_OPERATIONAL_COLOR = '#f59e0b';
const GATEWAY_PLANNED_COLOR = '#d97706';
const POP_COLOR = '#22d3ee';
const SELECTED_GROUND_STATION_COLOR = '#fef08a';

const GATEWAY_RADIUS = 0.0042;
const POP_RADIUS = 0.0032;
const PLANNED_OPACITY = 0.45;

interface GroundStationsLayerProps {
  stations: ReadonlyArray<GroundStation>;
  showGateways: boolean;
  showPops: boolean;
  selectedGroundStationId: string | null;
  selectedGroundStationIdRef: RefObject<string | null>;
  onSelectGroundStationRef: RefObject<(id: string | null) => void>;
  pickRadius: number;
}

function GroundStationInstances({
  stations,
  resolveColor,
  radius,
  opacity = 1,
  selectedGroundStationId,
  selectedGroundStationIdRef,
  onSelectGroundStationRef,
  visibleStationIdsRef,
  pickRadius,
}: {
  stations: GroundStation[];
  resolveColor: (station: GroundStation) => THREE.Color;
  selectedGroundStationId: string | null;
  radius: number;
  opacity?: number;
  selectedGroundStationIdRef: RefObject<string | null>;
  onSelectGroundStationRef: RefObject<(id: string | null) => void>;
  visibleStationIdsRef: RefObject<string[]>;
  pickRadius: number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const detachRaycastRef = useRef<(() => void) | null>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const count = stations.length;

  const geometry = useMemo(() => new THREE.OctahedronGeometry(1, 0), []);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#ffffff',
        toneMapped: false,
        depthWrite: false,
        transparent: opacity < 1,
        opacity,
      }),
    [opacity],
  );

  const selectInstance = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const idx = e.instanceId;
    if (idx === undefined || idx < 0) return;
    const stationId = visibleStationIdsRef.current[idx];
    if (stationId) onSelectGroundStationRef.current(stationId);
  };

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || count === 0) return undefined;

    if (!mesh.instanceColor) {
      mesh.instanceColor = new THREE.InstancedBufferAttribute(
        new Float32Array(Math.max(count, 1) * 3),
        3,
      );
    }

    detachRaycastRef.current?.();
    detachRaycastRef.current = attachInstanceSphereRaycast(mesh, pickRadius);

    return () => {
      detachRaycastRef.current?.();
      detachRaycastRef.current = null;
    };
  }, [count, pickRadius]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || count === 0) return;

    const selectedId =
      selectedGroundStationId ?? selectedGroundStationIdRef.current;
    const scale = radius * GLOBE_SURFACE_BIAS;
    const ids: string[] = [];

    for (let i = 0; i < count; i += 1) {
      const station = stations[i];
      const [x, y, z] = geodeticToCartesian(
        station.latitude,
        station.longitude,
        0,
      );

      dummy.position.set(
        x * GLOBE_SURFACE_BIAS,
        y * GLOBE_SURFACE_BIAS,
        z * GLOBE_SURFACE_BIAS,
      );
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      if (station.id === selectedId) {
        color.set(SELECTED_GROUND_STATION_COLOR);
      } else {
        color.copy(resolveColor(station));
      }
      mesh.setColorAt(i, color);
      ids.push(station.id);
    }

    visibleStationIdsRef.current = ids;
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [
    stations,
    count,
    dummy,
    radius,
    selectedGroundStationId,
    selectedGroundStationIdRef,
    resolveColor,
    color,
    visibleStationIdsRef,
  ]);

  if (count === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, count]}
      frustumCulled={false}
      renderOrder={4}
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

export function GroundStationsLayer({
  stations,
  showGateways,
  showPops,
  selectedGroundStationId,
  selectedGroundStationIdRef,
  onSelectGroundStationRef,
  pickRadius,
}: GroundStationsLayerProps) {
  const operationalIdsRef = useRef<string[]>([]);
  const plannedIdsRef = useRef<string[]>([]);
  const popIdsRef = useRef<string[]>([]);

  const operationalColor = useMemo(() => new THREE.Color(GATEWAY_OPERATIONAL_COLOR), []);
  const plannedColor = useMemo(() => new THREE.Color(GATEWAY_PLANNED_COLOR), []);
  const popColor = useMemo(() => new THREE.Color(POP_COLOR), []);

  const { operational, planned, pops } = useMemo(() => {
    const op: GroundStation[] = [];
    const pl: GroundStation[] = [];
    const pp: GroundStation[] = [];

    for (const station of stations) {
      if (station.kind === 'gateway') {
        if (station.status === 'planned') pl.push(station);
        else op.push(station);
      } else if (station.kind === 'pop') {
        pp.push(station);
      }
    }

    return { operational: op, planned: pl, pops: pp };
  }, [stations]);

  const resolveOperationalColor = useMemo(
    () => (_station: GroundStation) => operationalColor,
    [operationalColor],
  );
  const resolvePlannedColor = useMemo(
    () => (_station: GroundStation) => plannedColor,
    [plannedColor],
  );
  const resolvePopColor = useMemo(
    () => (_station: GroundStation) => popColor,
    [popColor],
  );

  return (
    <>
      {showGateways && (
        <>
          <GroundStationInstances
            stations={operational}
            resolveColor={resolveOperationalColor}
            radius={GATEWAY_RADIUS}
            selectedGroundStationId={selectedGroundStationId}
            selectedGroundStationIdRef={selectedGroundStationIdRef}
            onSelectGroundStationRef={onSelectGroundStationRef}
            visibleStationIdsRef={operationalIdsRef}
            pickRadius={pickRadius}
          />
          <GroundStationInstances
            stations={planned}
            resolveColor={resolvePlannedColor}
            radius={GATEWAY_RADIUS}
            opacity={PLANNED_OPACITY}
            selectedGroundStationId={selectedGroundStationId}
            selectedGroundStationIdRef={selectedGroundStationIdRef}
            onSelectGroundStationRef={onSelectGroundStationRef}
            visibleStationIdsRef={plannedIdsRef}
            pickRadius={pickRadius}
          />
        </>
      )}
      {showPops && (
        <GroundStationInstances
          stations={pops}
          resolveColor={resolvePopColor}
          radius={POP_RADIUS}
          selectedGroundStationId={selectedGroundStationId}
          selectedGroundStationIdRef={selectedGroundStationIdRef}
          onSelectGroundStationRef={onSelectGroundStationRef}
          visibleStationIdsRef={popIdsRef}
          pickRadius={pickRadius}
        />
      )}
    </>
  );
}
