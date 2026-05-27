import { useEffect, useMemo, useRef, useState } from 'react';

import './App.css';
import { AppSidebar } from './components/AppSidebar';
import { GlobeVisualizer } from './components/GlobeVisualizer';
import { MobileBottomSheet } from './components/MobileBottomSheet';
import type { StarlinkAlignment } from './components/StarlinkPanel';
import { dishObserverSite } from './lib/dishSite';
import { MOBILE_UI_ENABLED } from './lib/features';
import { findServicingStarlink } from './lib/starlinkPointing';
import type { GlobePopulationMode } from './lib/globeCatalog';
import { getGlobeMaxInstances } from './lib/mobileGlobe';
import { nearestBySlantRange } from './lib/nearestSatellites';
import { getSatelliteFromMap } from './lib/satelliteLookup';
import {
  useSatellitePropagation,
  type SatelliteCoordinates,
} from './hooks/useSatellitePropagation';
import { useUserLocation } from './hooks/useUserLocation';
import { useIsMobileViewport } from './hooks/useMediaQuery';
import {
  buildTypeById,
  getObjectTypeLabel,
  isStarlinkObject,
  type ObjectTypeFilter,
} from './lib/objectTypes';
import { fetchActiveSatcat, type SatcatEntry } from './services/satcat';
import { fetchActiveTles, type TleRecord } from './services/spaceTrack';
import { viewRelativeMetrics } from './lib/viewMetrics';

const LIST_LIMIT = 50;

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
  const [globePopulation, setGlobePopulation] =
    useState<GlobePopulationMode>('capped');
  const [renderFps, setRenderFps] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [starlinkAlignment, setStarlinkAlignment] =
    useState<StarlinkAlignment | null>(null);
  const { location: userLocation, status: locationStatus } = useUserLocation();
  const viewportMobile = useIsMobileViewport();
  const isMobile = MOBILE_UI_ENABLED && viewportMobile;
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;

  const typeById = useMemo(() => buildTypeById(tles), [tles]);
  const tleById = useMemo(() => {
    const map = new Map<string, TleRecord>();
    for (const tle of tles) map.set(tle.id, tle);
    return map;
  }, [tles]);

  const starlinkFilterActive = objectTypeFilter === 'starlink';
  const [servicingPinId, setServicingPinId] = useState<string | null>(null);

  const globePinIds = useMemo(
    () => [selectedId, starlinkFilterActive ? servicingPinId : null],
    [selectedId, starlinkFilterActive, servicingPinId],
  );

  useEffect(() => {
    if (!starlinkFilterActive) setStarlinkAlignment(null);
  }, [starlinkFilterActive]);

  const {
    positions,
    positionsById,
    positionEpoch,
    positionsRef,
    catalogPositionsRef,
    targetPositionsRef,
    lerpFromRef,
    lerpStartAtRef,
    lerpDurationMs,
    isPaused,
    togglePropagation,
    propagationFps,
    catalogParsedCount,
    activeCount,
    matchingCatalogCount,
    isParsing,
  } = useSatellitePropagation(tles, objectTypeFilter, typeById, {
    isMobile,
    userLocation,
    globePopulation,
    pinIds: globePinIds,
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

  const selectedSatellite = useMemo(
    () =>
      selectedId
        ? getSatelliteFromMap(positionsById, selectedId, null)
        : null,
    [selectedId, positionsById],
  );

  const propagatedCount = positions.length;
  const globeMaxInstances = getGlobeMaxInstances(isMobile);
  const onGlobeRendered = Math.min(propagatedCount, globeMaxInstances);
  const globeDrawLimited = propagatedCount > globeMaxInstances;
  const globeCapActive =
    globePopulation === 'capped'
      ? matchingCatalogCount > globeMaxInstances
      : globeDrawLimited;

  const selectedTypeLabel = getObjectTypeLabel(objectTypeFilter);

  const dishSite = useMemo(() => dishObserverSite(userLocation), [userLocation]);

  const starlinkCatalog = useMemo(() => {
    if (!starlinkFilterActive) return [];
    const catalog = catalogPositionsRef.current;
    const out: SatelliteCoordinates[] = [];
    for (let i = 0; i < catalog.length; i += 1) {
      const sat = catalog[i];
      if (isStarlinkObject(sat.id, sat.name, typeById)) out.push(sat);
    }
    return out;
  }, [starlinkFilterActive, positionEpoch, typeById, catalogPositionsRef]);

  const servicingStarlink = useMemo(() => {
    if (!starlinkFilterActive || !starlinkAlignment || !dishSite) return null;
    return findServicingStarlink(
      dishSite,
      starlinkAlignment.azimuth_deg,
      starlinkAlignment.elevation_deg,
      starlinkCatalog,
      typeById,
    );
  }, [
    starlinkFilterActive,
    starlinkAlignment,
    dishSite,
    starlinkCatalog,
    typeById,
  ]);

  const servicingStarlinkId = servicingStarlink?.id ?? null;

  useEffect(() => {
    setServicingPinId(servicingStarlinkId);
  }, [servicingStarlinkId]);

  const listItems = useMemo(() => {
    const buildItem = (sat: SatelliteCoordinates) => ({
      sat,
      metrics: userLocation
        ? viewRelativeMetrics(sat, userLocation)
        : (null as ReturnType<typeof viewRelativeMetrics> | null),
    });

    let items: ReturnType<typeof buildItem>[];
    if (!userLocation) {
      items = positions.slice(0, LIST_LIMIT).map(buildItem);
    } else {
      items = nearestBySlantRange(positions, userLocation, LIST_LIMIT).map(
        buildItem,
      );
    }

    if (!starlinkFilterActive || !servicingStarlink) return items;

    const servicingId = servicingStarlink.id;
    const live =
      getSatelliteFromMap(positionsById, servicingId, servicingStarlink) ??
      servicingStarlink;
    const servicingItem = buildItem(live);
    const rest = items.filter((item) => item.sat.id !== servicingId);
    return [servicingItem, ...rest].slice(0, LIST_LIMIT);
  }, [
    positions,
    positionsById,
    userLocation,
    servicingStarlink,
    starlinkFilterActive,
  ]);

  useEffect(() => {
    if (!selectedId) return;
    if (!positionsById.has(selectedId)) setSelectedId(null);
  }, [positionsById, selectedId]);

  const servicingLabel = starlinkFilterActive
    ? (servicingStarlink?.name ??
      (servicingStarlinkId ? `NORAD ${servicingStarlinkId}` : null))
    : null;

  const sidebarProps = {
    propagationFps,
    renderFps,
    activeCount,
    onGlobeRendered,
    catalogParsedCount,
    objectTypeFilter,
    catalogSource,
    globeCapActive,
    globePopulation,
    globeMaxInstances,
    globeDrawLimited,
    onGlobePopulationChange: setGlobePopulation,
    tlesCount: tles.length,
    starlinkAlignment,
    onAlignmentChange: setStarlinkAlignment,
    servicingStarlinkId,
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
    onObjectTypeFilterChange: setObjectTypeFilter,
    listItems,
    filteredCount: positions.length,
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
          positionsById={positionsById}
          targetPositionsRef={targetPositionsRef}
          lerpFromRef={lerpFromRef}
          lerpStartAtRef={lerpStartAtRef}
          lerpDurationMs={lerpDurationMs}
          selectedId={selectedId}
          selectedIdRef={selectedIdRef}
          typeById={typeById}
          servicingStarlinkId={
            starlinkFilterActive ? servicingStarlinkId : null
          }
          servicingStarlink={
            starlinkFilterActive ? servicingStarlink : null
          }
          catalogPositionsRef={catalogPositionsRef}
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
          {userLocation && (
            <span className="overlay-pill overlay-pill--location">
              Your location {userLocation.latitude.toFixed(1)}°,{' '}
              {userLocation.longitude.toFixed(1)}°
            </span>
          )}
          {isMobile && !userLocation && locationStatus === 'pending' && (
            <span className="overlay-pill overlay-pill--location-warn">
              Locating…
            </span>
          )}
          {isMobile && !userLocation && locationStatus === 'denied' && (
            <span className="overlay-pill overlay-pill--location-warn">
              Location off — enable in settings
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

      {MOBILE_UI_ENABLED && (
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
      )}
    </div>
  );
}

export default App;
