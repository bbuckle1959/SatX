import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';

import {
  copySatelliteCoordinates,
  ORBIT_LERP_MS,
} from '../lib/lerpGeodetic';
import {
  filterCatalogIdsForMobileWorker,
  filterPositionsForMobileDisplay,
  prioritizePinnedPositions,
} from '../lib/mobileGlobe';
import type { UserLocation } from './useUserLocation';
import {
  matchesObjectTypeFilter,
  type ObjectType,
  type ObjectTypeFilter,
} from '../lib/objectTypes';
import type { TleRecord } from '../services/spaceTrack';
import type { OrbitWorkerOut } from '../workers/orbitCalc.protocol';

export interface SatelliteCoordinates {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  altitude: number;
  /** Reserved; globe orients markers from frame-to-frame position delta. */
  velocityX: number;
  velocityY: number;
  velocityZ: number;
}

const DEFAULT_VELOCITY_Y = 1;

function filterActiveIds(
  satellites: TleRecord[],
  objectTypeFilter: ObjectTypeFilter,
  typeById: ReadonlyMap<string, ObjectType>,
): string[] {
  if (objectTypeFilter === 'all') {
    return satellites.map((sat) => sat.id);
  }

  const ids: string[] = [];
  for (const sat of satellites) {
    if (matchesObjectTypeFilter(sat.id, objectTypeFilter, typeById)) {
      ids.push(sat.id);
    }
  }
  return ids;
}

function buildCoordinatesFromWorker(
  ids: string[],
  coords: Float64Array,
  nameById: ReadonlyMap<string, string>,
): SatelliteCoordinates[] {
  const out: SatelliteCoordinates[] = [];
  const stride = 3;

  for (let i = 0; i < ids.length; i += 1) {
    const base = i * stride;
    const id = ids[i];
    out.push({
      id,
      name: nameById.get(id) ?? id,
      latitude: coords[base],
      longitude: coords[base + 1],
      altitude: coords[base + 2],
      velocityX: 0,
      velocityY: DEFAULT_VELOCITY_Y,
      velocityZ: 0,
    });
  }

  return out;
}

export interface UseSatellitePropagationResult {
  /** Throttled snapshot for React UI (sidebar list); worker targets at 4 Hz. */
  positions: SatelliteCoordinates[];
  /** Lerped coordinates for the globe (updated every render frame). */
  positionsRef: RefObject<SatelliteCoordinates[]>;
  /** Full worker catalog before mobile/display throttling (servicing link lookup). */
  catalogPositionsRef: RefObject<SatelliteCoordinates[]>;
  /** Latest worker sample; globe lerps from `lerpFromRef` → this. */
  targetPositionsRef: RefObject<SatelliteCoordinates[]>;
  lerpFromRef: RefObject<SatelliteCoordinates[]>;
  lerpStartAtRef: RefObject<number>;
  lerpDurationMs: number;
  isPaused: boolean;
  togglePropagation: () => void;
  propagationFps: number;
  catalogParsedCount: number;
  activeCount: number;
  isParsing: boolean;
}

export interface MobilePropagationOptions {
  isMobile: boolean;
  userLocation: UserLocation | null;
  /** Selection / servicing ids always kept on globe when throttling. */
  getPinIds?: () => ReadonlyArray<string | null | undefined>;
}

export function useSatellitePropagation(
  satellites: TleRecord[],
  objectTypeFilter: ObjectTypeFilter,
  typeById: ReadonlyMap<string, ObjectType>,
  mobileOptions?: MobilePropagationOptions,
): UseSatellitePropagationResult {
  const isMobile = mobileOptions?.isMobile ?? false;
  const userLocation = mobileOptions?.userLocation ?? null;
  const getPinIds = mobileOptions?.getPinIds;
  const [positions, setPositions] = useState<SatelliteCoordinates[]>([]);
  const [propagationFps, setPropagationFps] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [catalogParsedCount, setCatalogParsedCount] = useState(0);
  const [isParsing, setIsParsing] = useState(false);

  const positionsRef = useRef<SatelliteCoordinates[]>([]);
  const catalogPositionsRef = useRef<SatelliteCoordinates[]>([]);
  const targetPositionsRef = useRef<SatelliteCoordinates[]>([]);
  const lerpFromRef = useRef<SatelliteCoordinates[]>([]);
  const lerpStartAtRef = useRef(0);

  const workerRef = useRef<Worker | null>(null);
  const tickCountRef = useRef(0);
  const tickWindowStartRef = useRef(0);

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const sat of satellites) map.set(sat.id, sat.name);
    return map;
  }, [satellites]);
  const nameByIdRef = useRef(nameById);
  nameByIdRef.current = nameById;

  const activeIds = useMemo(() => {
    if (isMobile) {
      return filterCatalogIdsForMobileWorker(
        satellites,
        objectTypeFilter,
        typeById,
      );
    }
    return filterActiveIds(satellites, objectTypeFilter, typeById);
  }, [satellites, objectTypeFilter, typeById, isMobile]);

  const activeCount = activeIds.length;
  const activeIdsRef = useRef(activeIds);
  activeIdsRef.current = activeIds;
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  const lastSat = satellites[satellites.length - 1];
  const workerInitKey =
    satellites.length > 0
      ? `${satellites.length}:${satellites[0].id}:${lastSat?.id ?? ''}`
      : 'empty';

  const applyWorkerTargets = useCallback(
    (next: SatelliteCoordinates[]) => {
      catalogPositionsRef.current = next;
      const pinIds = getPinIds?.() ?? [];
      let throttled = isMobile
        ? filterPositionsForMobileDisplay(next, userLocation, pinIds)
        : next;
      if (pinIds.length > 0) {
        throttled = prioritizePinnedPositions(throttled, pinIds);
      }

      const display = positionsRef.current;
      const sameLength =
        display.length === throttled.length &&
        display.every((sat, index) => sat.id === throttled[index]?.id);

      if (sameLength && display.length > 0) {
        lerpFromRef.current = copySatelliteCoordinates(display);
      } else {
        lerpFromRef.current = copySatelliteCoordinates(throttled);
        positionsRef.current = copySatelliteCoordinates(throttled);
      }

      targetPositionsRef.current = throttled;
      lerpStartAtRef.current = performance.now();
      setPositions(throttled);
    },
    [isMobile, userLocation, getPinIds],
  );

  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/orbitCalc.worker.ts', import.meta.url),
      { type: 'module' },
    );
    workerRef.current = worker;
    setIsParsing(satellites.length > 0);
    setCatalogParsedCount(0);
    tickCountRef.current = 0;
    tickWindowStartRef.current = performance.now();

    worker.onmessage = (event: MessageEvent<OrbitWorkerOut>) => {
      const msg = event.data;

      if (msg.type === 'ready') {
        setCatalogParsedCount(msg.parsedCount);
        setIsParsing(false);
        worker.postMessage({
          type: 'set-active-ids',
          ids: activeIdsRef.current,
        });
        worker.postMessage({
          type: 'set-paused',
          paused: isPausedRef.current,
        });
        return;
      }

      if (msg.type === 'positions') {
        const next = buildCoordinatesFromWorker(
          msg.ids,
          msg.coords,
          nameByIdRef.current,
        );
        applyWorkerTargets(next);

        tickCountRef.current += 1;
        const elapsed = performance.now() - tickWindowStartRef.current;
        if (elapsed >= 500) {
          setPropagationFps(
            Math.round((tickCountRef.current * 1000) / elapsed),
          );
          tickCountRef.current = 0;
          tickWindowStartRef.current = performance.now();
        }
      }
    };

    worker.onerror = () => {
      setIsParsing(false);
    };

    worker.postMessage({
      type: 'init',
      tles: satellites.map((sat) => ({
        id: sat.id,
        name: sat.name,
        line1: sat.line1,
        line2: sat.line2,
      })),
    });

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [workerInitKey, applyWorkerTargets]);

  useEffect(() => {
    workerRef.current?.postMessage({ type: 'set-active-ids', ids: activeIds });
  }, [activeIds]);

  useEffect(() => {
    workerRef.current?.postMessage({ type: 'set-paused', paused: isPaused });
  }, [isPaused]);

  useEffect(() => {
    if (satellites.length === 0) {
      positionsRef.current = [];
      catalogPositionsRef.current = [];
      targetPositionsRef.current = [];
      lerpFromRef.current = [];
      setPositions([]);
      setCatalogParsedCount(0);
      setIsParsing(false);
    }
  }, [satellites.length]);

  const togglePropagation = useCallback(() => {
    setIsPaused((paused) => !paused);
  }, []);

  return {
    positions,
    positionsRef,
    catalogPositionsRef,
    targetPositionsRef,
    lerpFromRef,
    lerpStartAtRef,
    lerpDurationMs: ORBIT_LERP_MS,
    isPaused,
    togglePropagation,
    propagationFps,
    catalogParsedCount,
    activeCount,
    isParsing,
  };
}
