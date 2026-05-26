import { Activity, Filter, Pause, Play, Radio, Satellite, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  StarlinkPanel,
  type StarlinkAlignment,
} from './StarlinkPanel';
import { SatelliteDetails } from './SatelliteDetails';
import type { SatelliteCoordinates } from '../hooks/useSatellitePropagation';
import type { UserLocation } from '../hooks/useUserLocation';
import {
  getObjectTypeLabel,
  OBJECT_TYPE_OPTIONS,
  type ObjectType,
  type ObjectTypeFilter,
} from '../lib/objectTypes';
import type { SatcatEntry } from '../services/satcat';
import type { TleRecord } from '../services/spaceTrack';
import {
  formatDistanceKm,
  formatHeightKm,
  viewRelativeMetrics,
} from '../lib/viewMetrics';
import type { DishSite } from '../lib/dishSite';

export interface SidebarListItem {
  sat: SatelliteCoordinates;
  metrics: ReturnType<typeof viewRelativeMetrics> | null;
}

export interface AppSidebarProps {
  propagationFps: number;
  renderFps: number;
  activeCount: number;
  onGlobeRendered: number;
  catalogParsedCount: number;
  objectTypeFilter: ObjectTypeFilter;
  catalogSource: string | null;
  globeCapActive: boolean;
  tlesCount: number;
  onAlignmentChange: (data: StarlinkAlignment | null) => void;
  servicingSatelliteName: string | null;
  dishSite: DishSite | null;
  loading: boolean;
  isParsing: boolean;
  error: string | null;
  selectedSatellite: SatelliteCoordinates | null;
  userLocation: UserLocation | null;
  tleById: Map<string, TleRecord>;
  satcatById: Map<string, SatcatEntry>;
  typeById: Map<string, ObjectType>;
  onCloseDetails: () => void;
  objectTypeFilterValue: ObjectTypeFilter;
  onObjectTypeFilterChange: (value: ObjectTypeFilter) => void;
  listItems: SidebarListItem[];
  filteredCount: number;
  selectedId: string | null;
  onSelectSatellite: (id: string) => void;
  isPaused: boolean;
  onTogglePropagation: () => void;
}

export function AppSidebar({
  propagationFps,
  renderFps,
  activeCount,
  onGlobeRendered,
  catalogParsedCount,
  objectTypeFilter,
  catalogSource,
  globeCapActive,
  tlesCount,
  onAlignmentChange,
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
  onCloseDetails,
  objectTypeFilterValue,
  onObjectTypeFilterChange,
  listItems,
  filteredCount,
  selectedId,
  onSelectSatellite,
  isPaused,
  onTogglePropagation,
}: AppSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const selectedTypeLabel = getObjectTypeLabel(objectTypeFilter);

  const filteredListItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return listItems;
    return listItems.filter(
      ({ sat }) =>
        sat.name.toLowerCase().includes(q) || sat.id.includes(q),
    );
  }, [listItems, searchQuery]);

  return (
    <>
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
          <div className="metric-value">{onGlobeRendered.toLocaleString()}</div>
        </div>
      </div>

      {tlesCount > 0 && (
        <p className="catalog-meta">
          Catalog {catalogParsedCount.toLocaleString()} parsed
          {objectTypeFilter !== 'all' ? ` · filter: ${selectedTypeLabel}` : ''}
          {catalogSource ? ` · ${catalogSource}` : ''}
          {globeCapActive
            ? ` · globe draws first ${onGlobeRendered.toLocaleString()}`
            : ''}
        </p>
      )}

      <StarlinkPanel
        onAlignmentChange={onAlignmentChange}
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
          onClose={onCloseDetails}
        />
      )}

      <div className="search-wrap">
        <label className="search-label" htmlFor="satellite-search">
          <Search size={14} aria-hidden />
          Search satellites
        </label>
        <input
          id="satellite-search"
          type="search"
          className="search-input"
          placeholder="Name or NORAD ID…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoComplete="off"
          enterKeyHint="search"
        />
      </div>

      <div className="filter-wrap">
        <label className="filter-label" htmlFor="object-type-filter">
          <Filter size={14} aria-hidden />
          Object type
        </label>
        <select
          id="object-type-filter"
          className="filter-select"
          value={objectTypeFilterValue}
          onChange={(e) =>
            onObjectTypeFilterChange(e.target.value as ObjectTypeFilter)
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
        Showing {filteredListItems.length.toLocaleString()} of{' '}
        {filteredCount.toLocaleString()} matches
        {objectTypeFilter !== 'all' ? ` · ${selectedTypeLabel}` : ''}
        {searchQuery.trim() ? ' · search filtered' : ''}
        <span className="list-meta-sub">
          {userLocation
            ? 'Sorted by slant range from your location'
            : 'Allow location access to sort by slant range from you'}
        </span>
      </div>

      <ul className="satellite-list">
        {filteredListItems.length === 0 ? (
          <li className="empty-state">
            {loading
              ? 'Waiting for catalog…'
              : searchQuery.trim()
                ? 'No satellites match your search.'
                : 'No satellites match this filter.'}
          </li>
        ) : (
          filteredListItems.map(({ sat, metrics }) => (
            <li
              key={sat.id}
              className={selectedId === sat.id ? 'selected' : undefined}
              onClick={() => onSelectSatellite(sat.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectSatellite(sat.id);
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
          onClick={onTogglePropagation}
        >
          {isPaused ? <Play size={16} /> : <Pause size={16} />}
          {isPaused ? 'Resume propagation' : 'Pause propagation'}
        </button>
      </div>
    </>
  );
}
