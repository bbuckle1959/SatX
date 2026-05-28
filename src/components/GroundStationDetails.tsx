import { X } from 'lucide-react';
import { useMemo } from 'react';

import type { UserLocation } from '../hooks/useUserLocation';
import type { GroundStation } from '../lib/groundStationTypes';
import {
  formatDistanceKm,
  greatCircleDistanceKm,
  viewRelativeMetrics,
} from '../lib/viewMetrics';

interface GroundStationDetailsProps {
  station: GroundStation;
  userLocation: UserLocation | null;
  onClose: () => void;
}

function kindLabel(kind: GroundStation['kind']): string {
  return kind === 'gateway' ? 'Gateway earth station' : 'Point of presence (PoP)';
}

function statusLabel(status: GroundStation['status']): string {
  if (status === 'operational') return 'Operational';
  if (status === 'planned') return 'Planned';
  return '—';
}

export function GroundStationDetails({
  station,
  userLocation,
  onClose,
}: GroundStationDetailsProps) {
  const distanceMetrics = useMemo(() => {
    if (!userLocation) return null;
    return viewRelativeMetrics(
      {
        latitude: station.latitude,
        longitude: station.longitude,
        altitude: 0,
      },
      userLocation,
    );
  }, [station, userLocation]);

  const groundDistanceKm = useMemo(() => {
    if (!userLocation) return null;
    return greatCircleDistanceKm(
      userLocation.latitude,
      userLocation.longitude,
      station.latitude,
      station.longitude,
    );
  }, [station, userLocation]);

  return (
    <section
      className="satellite-details"
      aria-label="Selected ground station details"
    >
      <div className="satellite-details-header">
        <h2 className="satellite-details-title" title={station.name}>
          {station.name}
        </h2>
        <button
          type="button"
          className="satellite-details-close"
          onClick={onClose}
          aria-label="Close details"
        >
          <X size={16} />
        </button>
      </div>

      <dl className="satellite-details-grid">
        <div className="detail-row detail-row-emphasis">
          <dt>Type</dt>
          <dd>{kindLabel(station.kind)}</dd>
        </div>
        {station.kind === 'gateway' && (
          <div className="detail-row">
            <dt>Status</dt>
            <dd>{statusLabel(station.status)}</dd>
          </div>
        )}
        {station.code && (
          <div className="detail-row">
            <dt>DNS code</dt>
            <dd>{station.code}</dd>
          </div>
        )}
        {station.country && (
          <div className="detail-row">
            <dt>Country</dt>
            <dd>{station.country}</dd>
          </div>
        )}
        {distanceMetrics && (
          <>
            <div className="detail-row detail-row-emphasis">
              <dt>Slant range</dt>
              <dd>{formatDistanceKm(distanceMetrics.slantRangeKm)}</dd>
            </div>
            <div className="detail-row">
              <dt>Ground distance</dt>
              <dd>
                {groundDistanceKm !== null
                  ? formatDistanceKm(groundDistanceKm)
                  : '—'}
              </dd>
            </div>
          </>
        )}
        <div className="detail-row">
          <dt>Latitude</dt>
          <dd>{station.latitude.toFixed(4)}°</dd>
        </div>
        <div className="detail-row">
          <dt>Longitude</dt>
          <dd>{station.longitude.toFixed(4)}°</dd>
        </div>
        <div className="detail-row">
          <dt>Site ID</dt>
          <dd>{station.id}</dd>
        </div>
      </dl>

      <p className="ground-station-details-hint">
        {station.kind === 'gateway'
          ? 'Gateway sites relay Starlink traffic to the terrestrial internet.'
          : 'PoPs are internet exchange points where Starlink peers with other networks.'}
      </p>
    </section>
  );
}
