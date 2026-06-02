import { useEffect, useMemo, useRef, useState } from 'react';

import './App.css';
import { AppSidebar } from './components/AppSidebar';
import { GlobeVisualizer } from './components/GlobeVisualizer';
import { GroundStationDetails } from './components/GroundStationDetails';
import { SatelliteDetails } from './components/SatelliteDetails';
import { MobileBottomSheet } from './components/MobileBottomSheet';
import type { StarlinkAlignment } from './components/StarlinkPanel';
import { dishObserverSite } from './lib/dishSite';
import { MOBILE_UI_ENABLED } from './lib/features';
import {
  findServicingStarlinkCandidates,
  SERVICING_CANDIDATE_COUNT,
} from './lib/starlinkPointing';
import type { ServicingCandidateLink } from './components/StarlinkServicingLayer';
import type { GlobePopulationMode } from './lib/globeCatalog';
import { getGlobeMaxInstances } from './lib/mobileGlobe';
import { nearestBySlantRange } from './lib/nearestSatellites';
import {
  findSatelliteById,
  findSatelliteForSelection,
  getSatelliteFromMap,
} from './lib/satelliteLookup';
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
import type {
  GroundStation,
  GroundStationsSummary,
} from './lib/groundStationTypes';
import { viewRelativeMetrics } from './lib/viewMetrics';
import {
  getBundledGroundStations,
  loadGroundStations,
} from './services/groundStations';

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
  const [selectedGroundStationId, setSelectedGroundStationId] = useState<
    string | null
  >(null);
  const [starlinkAlignment, setStarlinkAlignment] =
    useState<StarlinkAlignment | null>(null);
  const { location: userLocation, status: locationStatus } = useUserLocation();
  const viewportMobile = useIsMobileViewport();
  const isMobile = MOBILE_UI_ENABLED && viewportMobile;
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;
  /** After servicing-label click, ignore globe instance picks briefly. */
  const globePickSuppressUntilRef = useRef(0);
  const onSelectServicingLabelRef = useRef<(id: string) => void>(() => {});

  const typeById = useMemo(() => buildTypeById(tles), [tles]);
  const tleById = useMemo(() => {
    const map = new Map<string, TleRecord>();
    for (const tle of tles) map.set(tle.id, tle);
    return map;
  }, [tles]);

  const starlinkFilterActive = objectTypeFilter === 'starlink';
  /** Stable join of servicing candidate ids for globe pinIds (avoids worker restarts). */
  const [servicingPinIdsKey, setServicingPinIdsKey] = useState('');
  const [showGateways, setShowGateways] = useState(true);
  const [showPops, setShowPops] = useState(false);
  const [groundStations, setGroundStations] = useState(
    () => getBundledGroundStations().stations,
  );
  const [groundStationCounts, setGroundStationCounts] =
    useState<GroundStationsSummary>(() => {
      const c = getBundledGroundStations().counts;
      return {
        gateways: c.gateways,
        operational: c.operational,
        planned: c.planned,
        pops: c.pops,
      };
    });

  const globePinIds = useMemo(() => {
    const pins: (string | null)[] = [selectedId];
    if (!servicingPinIdsKey) return pins;
    for (const id of servicingPinIdsKey.split(',')) {
      if (id) pins.push(id);
    }
    return pins;
  }, [selectedId, servicingPinIdsKey]);

  useEffect(() => {
    if (!starlinkFilterActive) {
      setStarlinkAlignment(null);
      setSelectedGroundStationId(null);
    }
  }, [starlinkFilterActive]);

  useEffect(() => {
    let cancelled = false;
    loadGroundStations()
      .then((bundle) => {
        if (cancelled) return;
        setGroundStations(bundle.stations);
        setGroundStationCounts({
          gateways: bundle.counts.gateways,
          operational: bundle.counts.operational,
          planned: bundle.counts.planned,
          pops: bundle.counts.pops,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

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

  const groundStationById = useMemo(() => {
    const map = new Map<string, GroundStation>();
    for (const station of groundStations) map.set(station.id, station);
    return map;
  }, [groundStations]);

  const selectedSatellite = useMemo(() => {
    if (!selectedId) return null;
    return (
      findSatelliteForSelection(
        selectedId,
        positionsById,
        positionsRef,
        targetPositionsRef,
        catalogPositionsRef,
      ) ?? null
    );
  }, [selectedId, positionsById, positionEpoch]);

  const selectedGroundStation = useMemo(
    () =>
      selectedGroundStationId
        ? (groundStationById.get(selectedGroundStationId) ?? null)
        : null,
    [selectedGroundStationId, groundStationById],
  );

  const handleSelectSatellite = (id: string | null) => {
    setSelectedGroundStationId(null);
    setSelectedId(id);
  };

  onSelectServicingLabelRef.current = (id: string) => {
    globePickSuppressUntilRef.current = performance.now() + 400;
    setSelectedGroundStationId(null);
    setSelectedId(id);
  };

  const handleSelectGroundStation = (id: string | null) => {
    setSelectedId(null);
    setSelectedGroundStationId(id);
  };

  const handleClearSelection = () => {
    setSelectedId(null);
    setSelectedGroundStationId(null);
  };

  useEffect(() => {
    if (!selectedGroundStationId) return;
    const station = groundStationById.get(selectedGroundStationId);
    if (!station) {
      setSelectedGroundStationId(null);
      return;
    }
    if (station.kind === 'gateway' && !showGateways) {
      setSelectedGroundStationId(null);
    } else if (station.kind === 'pop' && !showPops) {
      setSelectedGroundStationId(null);
    }
  }, [
    selectedGroundStationId,
    groundStationById,
    showGateways,
    showPops,
  ]);

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

  const servicingStarlinkCandidates = useMemo(() => {
    if (!starlinkFilterActive || !starlinkAlignment || !dishSite) return [];
    return findServicingStarlinkCandidates(
      dishSite,
      starlinkAlignment.azimuth_deg,
      starlinkAlignment.elevation_deg,
      starlinkCatalog,
      typeById,
      SERVICING_CANDIDATE_COUNT,
    );
  }, [
    starlinkFilterActive,
    starlinkAlignment,
    dishSite,
    starlinkCatalog,
    typeById,
  ]);

  const servicingStarlinkIds = useMemo(
    () => servicingStarlinkCandidates.map((m) => m.target.id),
    [servicingStarlinkCandidates],
  );

  const servicingStarlinkId = servicingStarlinkIds[0] ?? null;
  const servicingStarlink = servicingStarlinkCandidates[0]?.target ?? null;

  const servicingPinIdsKeyNext = starlinkFilterActive
    ? servicingStarlinkIds.join(',')
    : '';
  useEffect(() => {
    setServicingPinIdsKey((prev) =>
      prev === servicingPinIdsKeyNext ? prev : servicingPinIdsKeyNext,
    );
  }, [servicingPinIdsKeyNext]);

  const servicingCandidateLinks = useMemo((): ServicingCandidateLink[] => {
    return servicingStarlinkCandidates.map((match, rank) => ({
      id: match.target.id,
      name: match.target.name,
      rank,
    }));
  }, [servicingStarlinkCandidates]);

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

    if (!starlinkFilterActive || servicingStarlinkCandidates.length === 0) {
      return items;
    }

    const candidateIds = new Set(
      servicingStarlinkCandidates.map((m) => m.target.id),
    );
    const pinned = servicingStarlinkCandidates.map((match) => {
      const id = match.target.id;
      const live =
        getSatelliteFromMap(positionsById, id, match.target) ?? match.target;
      return buildItem(live);
    });
    const rest = items.filter((item) => !candidateIds.has(item.sat.id));
    return [...pinned, ...rest].slice(0, LIST_LIMIT);
  }, [
    positions,
    positionsById,
    userLocation,
    servicingStarlinkCandidates,
    starlinkFilterActive,
  ]);

  useEffect(() => {
    if (!selectedId) return;
    const found = findSatelliteById(
      selectedId,
      positionsById,
      positionsRef,
      targetPositionsRef,
      catalogPositionsRef,
    );
    if (!found) setSelectedId(null);
  }, [selectedId, positionsById, positionEpoch]);

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
    servicingStarlinkIds,
    servicingCandidateLinks,
    dishSite,
    loading,
    isParsing,
    error,
    userLocation,
    onObjectTypeFilterChange: setObjectTypeFilter,
    listItems,
    filteredCount: positions.length,
    selectedId,
    onSelectSatellite: handleSelectSatellite,
    isPaused,
    onTogglePropagation: togglePropagation,
    showGateways,
    showPops,
    onShowGatewaysChange: setShowGateways,
    onShowPopsChange: setShowPops,
    groundStationCounts,
  };

  return (
    <div className={`app${isMobile ? ' app--mobile' : ''}`}>
      <aside className="sidebar hidden md:flex">
        <AppSidebar {...sidebarProps} />
      </aside>

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
          servicingStarlinkIds={
            starlinkFilterActive ? servicingStarlinkIds : []
          }
          servicingCandidateLinks={
            starlinkFilterActive ? servicingCandidateLinks : []
          }
          catalogPositionsRef={catalogPositionsRef}
          userLocation={userLocation}
          onSelectSatellite={handleSelectSatellite}
          onSelectServicingLabelRef={onSelectServicingLabelRef}
          globePickSuppressUntilRef={globePickSuppressUntilRef}
          onRenderFps={setRenderFps}
          isMobile={isMobile}
          groundStations={groundStations}
          showGateways={starlinkFilterActive && showGateways}
          showPops={starlinkFilterActive && showPops}
          selectedGroundStationId={selectedGroundStationId}
          onSelectGroundStation={handleSelectGroundStation}
          onClearSelection={handleClearSelection}
        />
        {selectedSatellite && (
          <div className="visualizer-details">
            <SatelliteDetails
              satellite={selectedSatellite}
              userLocation={userLocation}
              tle={tleById.get(selectedSatellite.id)}
              satcat={satcatById.get(selectedSatellite.id)}
              objectType={typeById.get(selectedSatellite.id)}
              onClose={handleClearSelection}
            />
          </div>
        )}
        {selectedGroundStation && !selectedSatellite && (
          <div className="visualizer-details">
            <GroundStationDetails
              station={selectedGroundStation}
              userLocation={userLocation}
              onClose={handleClearSelection}
            />
          </div>
        )}
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
          {starlinkFilterActive && showGateways && (
            <span className="overlay-pill-gateway">
              Gateways {groundStationCounts.operational.toLocaleString()} op
              {groundStationCounts.planned > 0
                ? ` / ${groundStationCounts.planned.toLocaleString()} planned`
                : ''}
            </span>
          )}
          {starlinkFilterActive && showPops && (
            <span className="overlay-pill-pop">
              {groundStationCounts.pops.toLocaleString()} PoPs
            </span>
          )}
          {!isMobile && !selectedSatellite && !selectedGroundStation && (
            <span className="overlay-pill">
              Click satellite or ground site for details
            </span>
          )}
        </div>
      </main>

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
