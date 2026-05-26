import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import './App.css';
import { AppSidebar } from './components/AppSidebar';
import { GlobeVisualizer } from './components/GlobeVisualizer';
import { MobileBottomSheet } from './components/MobileBottomSheet';
import type { StarlinkAlignment } from './components/StarlinkPanel';
import { dishObserverSite } from './lib/dishSite';
import { findServicingStarlinkId } from './lib/starlinkPointing';
import { GLOBE_MAX_INSTANCES } from './lib/globeLimits';
import { getGlobeMaxInstances } from './lib/mobileGlobe';
import { nearestBySlantRange } from './lib/nearestSatellites';
import {
  useSatellitePropagation,
  type SatelliteCoordinates,
} from './hooks/useSatellitePropagation';
import { useUserLocation } from './hooks/useUserLocation';
import { useIsMobileViewport } from './hooks/useMediaQuery';
import {
  buildTypeById,
  getObjectTypeLabel,
  type ObjectTypeFilter,
} from './lib/objectTypes';
import { fetchActiveSatcat, type SatcatEntry } from './services/satcat';
import { fetchActiveTles, type TleRecord } from './services/spaceTrack';
import { viewRelativeMetrics } from './lib/viewMetrics';

const LIST_LIMIT = 120;

function App() {
  const [tles, setTles] = useState<TleRecord[]>([]);
  const [satcatById, setSatcatById] = useState<Map<string, SatcatEntry>>(
    () => new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [catalogSource, setCatalogSource] = useState<string | null>(null);
  const [objectTypeFilter, setObjectTypeFilter] =
    useState<ObjectTypeFilter>('all');
  const [renderFps, setRenderFps] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [starlinkAlignment, setStarlinkAlignment] =
    useState<StarlinkAlignment | null>(null);
  const userLocation = useUserLocation();
  const isMobile = useIsMobileViewport();
  const servicingStarlinkIdRef = useRef<string | null>(null);

  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;

  const typeById = useMemo(() => buildTypeById(tles), [tles]);
  const tleById = useMemo(() => {
    const map = new Map<string, TleRecord>();
    for (const tle of tles) map.set(tle.id, tle);
    return map;
  }, [tles]);

  const getMobilePinIds = useCallback(
    () => [selectedId, servicingStarlinkIdRef.current],
    [selectedId],
  );

  const {
    positions,
    positionsRef,
    targetPositionsRef,
    lerpFromRef,
    lerpStartAtRef,
    lerpDurationMs,
    isPaused,
    togglePropagation,
    propagationFps,
    catalogParsedCount,
    activeCount,
    isParsing,
  } = useSatellitePropagation(tles, objectTypeFilter, typeById, {
    isMobile,
    userLocation,
    getPinIds: getMobilePinIds,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { records, source } = await fetchActiveTles();
        if (!cancelled) {
          setTles(records);
          setCatalogSource(source);
        }

        window.setTimeout(() => {
          if (cancelled) return;
          fetchActiveSatcat()
            .then((map) => {
              if (!cancelled) setSatcatById(map);
            })
            .catch(() => {});
        }, 120_000);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load TLE data',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const [selectedSatellite, setSelectedSatellite] =
    useState<SatelliteCoordinates | null>(null);

  useEffect(() => {
    if (!selectedId) {
      setSelectedSatellite(null);
      return;
    }

    const sat =
      positionsRef.current?.find((s) => s.id === selectedId) ??
      positions.find((s) => s.id === selectedId) ??
      null;
    setSelectedSatellite(sat);
  }, [selectedId, positions, positionsRef]);

  useEffect(() => {
    if (!selectedId) return;
    const visible = positionsRef.current;
    let found = false;
    for (let i = 0; i < visible.length; i += 1) {
      if (visible[i].id === selectedId) {
        found = true;
        break;
      }
    }
    if (!found) setSelectedId(null);
  }, [positions, selectedId, positionsRef]);

  const filteredPositions = positions;
  const propagatedCount = positions.length;
  const globeMaxInstances = getGlobeMaxInstances(isMobile);
  const onGlobeRendered = Math.min(propagatedCount, globeMaxInstances);
  const globeCapActive = !isMobile && propagatedCount > GLOBE_MAX_INSTANCES;

  const listItems = useMemo(() => {
    if (!userLocation) {
      return filteredPositions.slice(0, LIST_LIMIT).map((sat) => ({
        sat,
        metrics: null as ReturnType<typeof viewRelativeMetrics> | null,
      }));
    }

    const nearest = nearestBySlantRange(
      filteredPositions,
      userLocation,
      LIST_LIMIT,
    );

    return nearest.map((sat) => ({
      sat,
      metrics: viewRelativeMetrics(sat, userLocation),
    }));
  }, [filteredPositions, userLocation]);

  const selectedTypeLabel = getObjectTypeLabel(objectTypeFilter);

  const selectedTle = useMemo(
    () => (selectedId ? (tleById.get(selectedId) ?? null) : null),
    [selectedId, tleById],
  );

  const dishSite = useMemo(() => dishObserverSite(userLocation), [userLocation]);

  const servicingStarlinkId = useMemo(() => {
    if (!starlinkAlignment || !dishSite) return null;
    const catalog =
      positionsRef.current.length > 0 ? positionsRef.current : positions;
    return findServicingStarlinkId(
      dishSite,
      starlinkAlignment.azimuth_deg,
      starlinkAlignment.elevation_deg,
      catalog,
    );
  }, [starlinkAlignment, dishSite, positions, positionsRef]);

  useEffect(() => {
    servicingStarlinkIdRef.current = servicingStarlinkId;
  }, [servicingStarlinkId]);

  const servicingSatelliteName = useMemo(() => {
    if (!servicingStarlinkId) return null;
    const fromPos = positions.find((s) => s.id === servicingStarlinkId);
    if (fromPos) return fromPos.name;
    return tleById.get(servicingStarlinkId)?.name ?? null;
  }, [servicingStarlinkId, positions, tleById]);

  const servicingLabel =
    servicingSatelliteName ??
    (servicingStarlinkId ? `NORAD ${servicingStarlinkId}` : null);

  const sidebarProps = {
    propagationFps,
    renderFps,
    activeCount,
    onGlobeRendered,
    catalogParsedCount,
    objectTypeFilter,
    catalogSource,
    globeCapActive,
    tlesCount: tles.length,
    onAlignmentChange: setStarlinkAlignment,
    servicingSatelliteName,
    dishSite,
    loading,
    isParsing,
    error,
    selectedSatellite,
    userLocation,
    tleById,
    satcatById,
    typeById,
    onCloseDetails: () => setSelectedId(null),
    objectTypeFilterValue: objectTypeFilter,
    onObjectTypeFilterChange: setObjectTypeFilter,
    listItems,
    filteredCount: filteredPositions.length,
    selectedId,
    onSelectSatellite: setSelectedId,
    isPaused,
    onTogglePropagation: togglePropagation,
  };

  return (
    <div className={`app${isMobile ? ' app--mobile' : ''}`}>
      <main className="visualizer">
        <GlobeVisualizer
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
          onSelectSatellite={setSelectedId}
          onRenderFps={setRenderFps}
          isMobile={isMobile}
        />
        <div className="visualizer-overlay">
          <span className="overlay-pill">
            {isPaused ? 'Paused' : 'Live'} · {onGlobeRendered.toLocaleString()}{' '}
            {objectTypeFilter === 'all'
              ? 'objects'
              : selectedTypeLabel.toLowerCase()}
          </span>
          {!isMobile && userLocation && (
            <span className="overlay-pill">
              Your location {userLocation.latitude.toFixed(1)}°,{' '}
              {userLocation.longitude.toFixed(1)}°
            </span>
          )}
          {!isMobile && (
            <span className="overlay-pill">Click object for details</span>
          )}
        </div>
      </main>

      <aside className="sidebar hidden md:flex">
        <AppSidebar {...sidebarProps} />
      </aside>

      <div className="mobile-sheet-host md:hidden">
        <MobileBottomSheet
          metrics={{
            calcFps: propagationFps,
            renderFps,
            activeCount,
            servicingLabel,
          }}
        >
          <aside className="sidebar sidebar--sheet">
            <AppSidebar {...sidebarProps} />
          </aside>
        </MobileBottomSheet>
      </div>
    </div>
  );
}

export default App;
