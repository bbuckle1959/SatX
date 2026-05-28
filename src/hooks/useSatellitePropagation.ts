import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';

import {
  countMatchingCatalog,
  filterCatalogIdsForWorker,
  getDisplayOptions,
  getWorkerOptions,
  resolveGlobeDisplayPositions,
  type GlobePopulationMode,
} from '../lib/globeCatalog';
import { ORBIT_LERP_MS, syncSatelliteCoordinates } from '../lib/lerpGeodetic';
import { getGlobeMaxInstances } from '../lib/mobileGlobe';
import { mergePositionsById } from '../lib/satelliteLookup';
import type { UserLocation } from './useUserLocation';
import {
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
    });
  }

  return out;
}

export interface UseSatellitePropagationResult {
  /** Throttled snapshot for React UI (sidebar list); worker targets at 4 Hz. */
  positions: SatelliteCoordinates[];
  /** Id → latest display/catalog coordinates for O(1) lookup. */
  positionsById: ReadonlyMap<string, SatelliteCoordinates>;
  /** Increments each worker display update (servicing / selection refresh). */
  positionEpoch: number;
  /** Lerped coordinates for the globe (updated every render frame). */
  positionsRef: RefObject<SatelliteCoordinates[]>;
  /** Worker output before display throttling. */
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
  /** Active ids sent to the worker (capped). */
  activeCount: number;
  /** Matching catalog size before worker cap. */
  matchingCatalogCount: number;
  isParsing: boolean;
}

export interface PropagationDisplayOptions {
  isMobile: boolean;
  userLocation: UserLocation | null;
  globePopulation: GlobePopulationMode;
  /** Selection / servicing ids always kept on globe when throttling. */
  pinIds?: ReadonlyArray<string | null | undefined>;
}

export type { GlobePopulationMode };

export function useSatellitePropagation(
  satellites: TleRecord[],
  objectTypeFilter: ObjectTypeFilter,
  typeById: ReadonlyMap<string, ObjectType>,
  displayOptions?: PropagationDisplayOptions,
): UseSatellitePropagationResult {
  const isMobile = displayOptions?.isMobile ?? false;
  const userLocation = displayOptions?.userLocation ?? null;
  const globePopulation = displayOptions?.globePopulation ?? 'capped';
  const pinIds = displayOptions?.pinIds ?? [];
  const maxInstances = getGlobeMaxInstances(isMobile);

  const [positions, setPositions] = useState<SatelliteCoordinates[]>([]);
  const [positionsById, setPositionsById] = useState<
    ReadonlyMap<string, SatelliteCoordinates>
  >(() => new Map());
  const [positionEpoch, setPositionEpoch] = useState(0);
  const [propagationFps, setPropagationFps] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [catalogParsedCount, setCatalogParsedCount] = useState(0);
  const [isParsing, setIsParsing] = useState(false);

  const positionsRef = useRef<SatelliteCoordinates[]>([]);
  const catalogPositionsRef = useRef<SatelliteCoordinates[]>([]);
  const targetPositionsRef = useRef<SatelliteCoordinates[]>([]);
  const lerpFromRef = useRef<SatelliteCoordinates[]>([]);
  const lerpStartAtRef = useRef(0);
  const catalogByIdRef = useRef<Map<string, SatelliteCoordinates>>(new Map());

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

  const matchingCatalogCount = useMemo(
    () => countMatchingCatalog(satellites, objectTypeFilter, typeById),
    [satellites, objectTypeFilter, typeById],
  );

  const activeIds = useMemo(
    () =>
      filterCatalogIdsForWorker(
        satellites,
        objectTypeFilter,
        typeById,
        getWorkerOptions(isMobile, maxInstances, globePopulation),
      ),
    [satellites, objectTypeFilter, typeById, isMobile, maxInstances, globePopulation],
  );

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
      mergePositionsById(catalogByIdRef.current, next);

      const throttled = resolveGlobeDisplayPositions(
        next,
        globePopulation,
        userLocation,
        pinIds,
        maxInstances,
        typeById,
        getDisplayOptions(isMobile),
      );

      const display = positionsRef.current;
      const sameOrder =
        display.length === throttled.length &&
        display.every((sat, index) => sat.id === throttled[index]?.id);

      if (sameOrder && display.length > 0) {
        syncSatelliteCoordinates(lerpFromRef.current, display);
      } else {
        syncSatelliteCoordinates(lerpFromRef.current, throttled);
        syncSatelliteCoordinates(positionsRef.current, throttled);
      }

      targetPositionsRef.current = throttled;
      lerpStartAtRef.current = performance.now();
      setPositions(throttled);
      // Full catalog map for selection/details; `positions` stays throttled for the list.
      setPositionsById(new Map(catalogByIdRef.current));
      setPositionEpoch((epoch) => epoch + 1);
    },
    [isMobile, userLocation, pinIds, maxInstances, typeById, globePopulation],
  );

  const pinKey = pinIds
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
    .join('\0');

  useEffect(() => {
    const catalog = catalogPositionsRef.current;
    if (catalog.length === 0) return;
    applyWorkerTargets(catalog);
  }, [pinKey, globePopulation, applyWorkerTargets]);

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
      catalogByIdRef.current.clear();
      setPositions([]);
      setPositionsById(new Map());
      setCatalogParsedCount(0);
      setIsParsing(false);
    }
  }, [satellites.length]);

  const togglePropagation = useCallback(() => {
    setIsPaused((paused) => !paused);
  }, []);

  return {
    positions,
    positionsById,
    positionEpoch,
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
    matchingCatalogCount,
    isParsing,
  };
}
