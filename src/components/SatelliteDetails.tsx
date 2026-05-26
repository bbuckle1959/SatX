import { X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type { SatelliteCoordinates } from '../hooks/useSatellitePropagation';
import { getObjectTypeLabel, type ObjectType } from '../lib/objectTypes';
import {
  formatLaunchSite,
  formatOwner,
  formatSatcatObjectType,
} from '../lib/satcatLabels';
import {
  formatTleMetadataValue,
  parseTleMetadata,
  type TleMetadata,
} from '../lib/tleMetadata';
import { fetchSatcatByNoradId, type SatcatEntry } from '../services/satcat';
import type { UserLocation } from '../hooks/useUserLocation';
import type { TleRecord } from '../services/spaceTrack';
import {
  formatDistanceKm,
  formatHeightKm,
  viewRelativeMetrics,
} from '../lib/viewMetrics';

const ORBITAL_ROWS: { key: keyof TleMetadata; label: string }[] = [
  { key: 'internationalDesignator', label: 'Intl. designator' },
  { key: 'classificationLabel', label: 'Classification' },
  { key: 'elementSetNumber', label: 'Element set no.' },
  { key: 'epochUtc', label: 'Element epoch (UTC)' },
  { key: 'orbitRegime', label: 'SGP4 regime' },
  { key: 'inclinationDeg', label: 'Inclination' },
  { key: 'raanDeg', label: 'RAAN' },
  { key: 'eccentricity', label: 'Eccentricity' },
  { key: 'argOfPerigeeDeg', label: 'Arg. of perigee' },
  { key: 'meanAnomalyDeg', label: 'Mean anomaly' },
  { key: 'meanMotionRevPerDay', label: 'Mean motion' },
  { key: 'orbitalPeriodMin', label: 'Orbital period' },
  { key: 'semiMajorAxisKm', label: 'Semi-major axis' },
  { key: 'perigeeAltitudeKm', label: 'Perigee alt.' },
  { key: 'apogeeAltitudeKm', label: 'Apogee alt.' },
  { key: 'bstar', label: 'B* drag term' },
  { key: 'meanMotionFirstDerivative', label: 'Mean motion 1st deriv.' },
  { key: 'revolutionNumberAtEpoch', label: 'Rev. at epoch' },
];

interface SatelliteDetailsProps {
  satellite: SatelliteCoordinates;
  userLocation: UserLocation | null;
  tle: TleRecord | undefined;
  satcat: SatcatEntry | undefined;
  objectType: ObjectType | undefined;
  onClose: () => void;
}

function formatLaunchDate(isoDate: string): string {
  if (!isoDate) return '—';
  const parsed = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function SatelliteDetails({
  satellite,
  userLocation,
  tle,
  satcat: satcatProp,
  objectType,
  onClose,
}: SatelliteDetailsProps) {
  const typeLabel = objectType ? getObjectTypeLabel(objectType) : 'Unknown';
  const distanceMetrics = useMemo(
    () =>
      userLocation ? viewRelativeMetrics(satellite, userLocation) : null,
    [satellite, userLocation],
  );
  const orbital = useMemo(
    () => (tle ? parseTleMetadata(tle) : null),
    [tle],
  );

  const [satcatFetched, setSatcatFetched] = useState<SatcatEntry | null>(null);
  const [satcatLoading, setSatcatLoading] = useState(false);
  const satcat = satcatProp ?? satcatFetched;

  useEffect(() => {
    setSatcatFetched(null);
    if (satcatProp) {
      setSatcatLoading(false);
      return;
    }

    let cancelled = false;
    setSatcatLoading(true);
    fetchSatcatByNoradId(satellite.id)
      .then((entry) => {
        if (!cancelled && entry) setSatcatFetched(entry);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSatcatLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [satellite.id, satcatProp]);

  const catalogRows = satcat
    ? [
        { label: 'Launch date', value: formatLaunchDate(satcat.launchDate) },
        { label: 'Launch site', value: formatLaunchSite(satcat.launchSite) },
        { label: 'Owner', value: formatOwner(satcat.owner) },
        {
          label: 'Catalog type',
          value: formatSatcatObjectType(satcat.objectType),
        },
        {
          label: 'Intl. designator',
          value: satcat.objectId || '—',
        },
        ...(satcat.decayDate
          ? [
              {
                label: 'Decay date',
                value: formatLaunchDate(satcat.decayDate),
              },
            ]
          : []),
      ]
    : null;

  return (
    <section className="satellite-details" aria-label="Selected object details">
      <div className="satellite-details-header">
        <h2 className="satellite-details-title" title={satellite.name}>
          {satellite.name}
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
        {distanceMetrics ? (
          <>
            <div className="detail-row detail-row-emphasis">
              <dt>Slant range</dt>
              <dd>{formatDistanceKm(distanceMetrics.slantRangeKm)}</dd>
            </div>
            <div className="detail-row detail-row-emphasis">
              <dt>Height</dt>
              <dd>{formatHeightKm(distanceMetrics.heightKm)}</dd>
            </div>
            <div className="detail-row">
              <dt>Ground distance</dt>
              <dd>{formatDistanceKm(distanceMetrics.groundDistanceKm)}</dd>
            </div>
          </>
        ) : (
          <div className="detail-row">
            <dt>Altitude</dt>
            <dd>{satellite.altitude.toFixed(2)} km</dd>
          </div>
        )}
        <div className="detail-row">
          <dt>NORAD ID</dt>
          <dd>{satellite.id}</dd>
        </div>
        <div className="detail-row">
          <dt>Object type</dt>
          <dd>{typeLabel}</dd>
        </div>
        {satcat?.launchDate && (
          <div className="detail-row">
            <dt>Launch date</dt>
            <dd>{formatLaunchDate(satcat.launchDate)}</dd>
          </div>
        )}
        <div className="detail-row">
          <dt>Latitude</dt>
          <dd>{satellite.latitude.toFixed(4)}°</dd>
        </div>
        <div className="detail-row">
          <dt>Longitude</dt>
          <dd>{satellite.longitude.toFixed(4)}°</dd>
        </div>
      </dl>

      {catalogRows ? (
        <>
          <h3 className="details-section-heading">Catalog (SATCAT)</h3>
          <dl className="satellite-details-grid">
            {catalogRows.map(({ label, value }) => (
              <div className="detail-row" key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : (
        satcatLoading && (
          <p className="details-loading-hint">Loading catalog data…</p>
        )
      )}

      {orbital && (
        <>
          <h3 className="details-section-heading">Orbital elements (TLE)</h3>
          <dl className="satellite-details-grid">
            {ORBITAL_ROWS.map(({ key, label }) => (
              <div className="detail-row" key={key}>
                <dt>{label}</dt>
                <dd>
                  {key === 'meanMotionRevPerDay'
                    ? `${formatTleMetadataValue(key, orbital)} rev/day`
                    : formatTleMetadataValue(key, orbital)}
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}

      {tle && (
        <div className="tle-block">
          <h3 className="tle-heading">Two-line element set</h3>
          <pre className="tle-lines">
            {tle.name}
            {'\n'}
            {tle.line1}
            {'\n'}
            {tle.line2}
          </pre>
        </div>
      )}
    </section>
  );
}
