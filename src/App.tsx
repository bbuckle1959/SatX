import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Filter,
  Pause,
  Play,
  Radio,
  Satellite,
} from 'lucide-react';

import './App.css';
import { GlobeVisualizer } from './components/GlobeVisualizer';
import { SatelliteDetails } from './components/SatelliteDetails';
import {
  StarlinkPanel,
  type StarlinkAlignment,
} from './components/StarlinkPanel';
import { dishObserverSite } from './lib/dishSite';
import { findServicingStarlinkId } from './lib/starlinkPointing';
import { GLOBE_MAX_INSTANCES } from './lib/globeLimits';
import { nearestBySlantRange } from './lib/nearestSatellites';
import {
  useSatellitePropagation,
  type SatelliteCoordinates,
} from './hooks/useSatellitePropagation';
import { useUserLocation } from './hooks/useUserLocation';
import {
  buildTypeById,
  getObjectTypeLabel,
  OBJECT_TYPE_OPTIONS,
  type ObjectTypeFilter,
} from './lib/objectTypes';
import { fetchActiveSatcat, type SatcatEntry } from './services/satcat';
import { fetchActiveTles, type TleRecord } from './services/spaceTrack';
import {
  formatDistanceKm,
  formatHeightKm,
  viewRelativeMetrics,
} from './lib/viewMetrics';

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
  const servicingStarlinkIdRef = useRef<string | null>(null);

  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;

  const typeById = useMemo(() => buildTypeById(tles), [tles]);
  const tleById = useMemo(() => {
    const map = new Map<string, TleRecord>();
    for (const tle of tles) map.set(tle.id, tle);
    return map;
  }, [tles]);

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
  } = useSatellitePropagation(tles, objectTypeFilter, typeById);

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

        // SATCAT is optional metadata; skip on startup to avoid CelesTrak timeouts on Starlink.
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
  const onGlobeRendered = Math.min(propagatedCount, GLOBE_MAX_INSTANCES);
  const globeCapActive = propagatedCount > GLOBE_MAX_INSTANCES;

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

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>SatX Tracker</h1>
          <p>Live orbital propagation & debris map</p>
        </div>

        <div className="metrics">
          <div className="metric-card">
            <div className="metric-label">
              <Activity size={14} aria-hidden />
              Calc FPS
            </div>
            <div className="metric-value">{propagationFps}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">
              <Satellite size={14} aria-hidden />
              Active
            </div>
            <div className="metric-value">{activeCount.toLocaleString()}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">
              <Radio size={14} aria-hidden />
              Render FPS
            </div>
            <div className="metric-value">{renderFps}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">
              <Satellite size={14} aria-hidden />
              On Globe
            </div>
            <div className="metric-value">
              {onGlobeRendered.toLocaleString()}
            </div>
          </div>
        </div>
        {tles.length > 0 && (
          <p className="catalog-meta">
            Catalog {catalogParsedCount.toLocaleString()} parsed
            {objectTypeFilter !== 'all'
              ? ` · filter: ${selectedTypeLabel}`
              : ''}
            {catalogSource ? ` · ${catalogSource}` : ''}
            {globeCapActive
              ? ` · globe draws first ${GLOBE_MAX_INSTANCES.toLocaleString()}`
              : ''}
          </p>
        )}

        <StarlinkPanel
          onAlignmentChange={setStarlinkAlignment}
          servicingSatelliteName={servicingSatelliteName}
          hasDishSite={dishSite !== null}
          dishSite={dishSite}
        />

        {(loading || isParsing) && (
          <div className="status-banner loading">
            {loading
              ? 'Loading satellite catalog… (first browser load may take ~20s)'
              : 'Parsing orbital data…'}
          </div>
        )}
        {error && <div className="status-banner error">{error}</div>}

        {selectedSatellite && (
          <SatelliteDetails
            satellite={selectedSatellite}
            userLocation={userLocation}
            tle={tleById.get(selectedSatellite.id)}
            satcat={satcatById.get(selectedSatellite.id)}
            objectType={typeById.get(selectedSatellite.id)}
            onClose={() => setSelectedId(null)}
          />
        )}

        <div className="filter-wrap">
          <label className="filter-label" htmlFor="object-type-filter">
            <Filter size={14} aria-hidden />
            Object type
          </label>
          <select
            id="object-type-filter"
            className="filter-select"
            value={objectTypeFilter}
            onChange={(e) =>
              setObjectTypeFilter(e.target.value as ObjectTypeFilter)
            }
            aria-label="Filter by object type"
          >
            {OBJECT_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="list-meta">
          Showing {listItems.length.toLocaleString()} of{' '}
          {filteredPositions.length.toLocaleString()} matches
          {objectTypeFilter !== 'all' ? ` · ${selectedTypeLabel}` : ''}
          <span className="list-meta-sub">
            {userLocation
              ? 'Sorted by slant range from your location'
              : 'Allow location access to sort by slant range from you'}
          </span>
        </div>

        <ul className="satellite-list">
          {listItems.length === 0 ? (
            <li className="empty-state">
              {loading ? 'Waiting for catalog…' : 'No satellites match this filter.'}
            </li>
          ) : (
            listItems.map(({ sat, metrics }) => (
              <li
                key={sat.id}
                className={selectedId === sat.id ? 'selected' : undefined}
                onClick={() => setSelectedId(sat.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedId(sat.id);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-pressed={selectedId === sat.id}
              >
                <div className="satellite-name" title={sat.name}>
                  {sat.name}
                </div>
                <div className="satellite-meta">
                  {metrics ? (
                    <>
                      <span className="satellite-meta-primary">
                        {formatDistanceKm(metrics.slantRangeKm)} slant range ·{' '}
                        {formatHeightKm(metrics.heightKm)} height
                      </span>
                      <span className="satellite-meta-secondary">
                        NORAD {sat.id}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="satellite-meta-primary">
                        {sat.latitude.toFixed(2)}°, {sat.longitude.toFixed(2)}°
                      </span>
                      <span className="satellite-meta-secondary">
                        {sat.altitude.toFixed(0)} km alt · NORAD {sat.id}
                      </span>
                    </>
                  )}
                </div>
              </li>
            ))
          )}
        </ul>

        <div className="sidebar-footer">
          <button
            type="button"
            className={`toggle-btn${isPaused ? ' paused' : ''}`}
            onClick={togglePropagation}
          >
            {isPaused ? <Play size={16} /> : <Pause size={16} />}
            {isPaused ? 'Resume propagation' : 'Pause propagation'}
          </button>
        </div>
      </aside>

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
        />
        <div className="visualizer-overlay">
          <span className="overlay-pill">
            {isPaused ? 'Paused' : 'Live'} · {onGlobeRendered.toLocaleString()}{' '}
            {objectTypeFilter === 'all' ? 'objects' : selectedTypeLabel.toLowerCase()}
          </span>
          {userLocation && (
            <span className="overlay-pill">
              Your location {userLocation.latitude.toFixed(1)}°,{' '}
              {userLocation.longitude.toFixed(1)}°
            </span>
          )}
          <span className="overlay-pill">Click object for details</span>
        </div>
      </main>
    </div>
  );
}

export default App;
