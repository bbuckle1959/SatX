import { invoke, isTauri } from '@tauri-apps/api/core';
import { AlertTriangle, Loader2, Radio, RefreshCw } from 'lucide-react';
import { useCallback, useState } from 'react';

export interface StarlinkAlignment {
  azimuth_deg: number;
  elevation_deg: number;
  is_aligned: boolean;
}

function formatDegrees(value: number): string {
  return `${value.toFixed(1)}°`;
}

interface StarlinkPanelProps {
  onAlignmentChange?: (data: StarlinkAlignment | null) => void;
  servicingSatelliteName?: string | null;
  hasDishSite?: boolean;
  /** Browser geolocation used for boresight matching (same as light blue globe marker). */
  dishSite?: { latitude: number; longitude: number } | null;
}

export function StarlinkPanel({
  onAlignmentChange,
  servicingSatelliteName,
  hasDishSite = false,
  dishSite = null,
}: StarlinkPanelProps = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alignmentData, setAlignmentData] = useState<StarlinkAlignment | null>(
    null,
  );

  const fetchAlignment = useCallback(async () => {
    if (!isTauri()) return;

    setLoading(true);
    setError(null);

    try {
      const data = await invoke<StarlinkAlignment>('get_dish_alignment');
      setAlignmentData(data);
      onAlignmentChange?.(data);
    } catch (err) {
      setAlignmentData(null);
      onAlignmentChange?.(null);
      const message =
        typeof err === 'string'
          ? err
          : err instanceof Error
            ? err.message
            : 'Failed to fetch dish alignment';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const desktopOnly = !isTauri();

  return (
    <section
      className="starlink-strip"
      aria-labelledby="starlink-panel-title"
    >
      <div className="starlink-strip-row">
        <h2 id="starlink-panel-title" className="starlink-strip-title">
          <Radio size={12} aria-hidden />
          Starlink
        </h2>
        <button
          type="button"
          onClick={() => void fetchAlignment()}
          disabled={loading || desktopOnly}
          className="starlink-strip-btn"
          title={
            desktopOnly
              ? 'Requires SatX desktop app on Starlink LAN'
              : alignmentData
                ? 'Refresh alignment'
                : 'Fetch alignment'
          }
        >
          {loading ? (
            <Loader2 size={12} className="animate-spin" aria-hidden />
          ) : (
            <RefreshCw size={12} aria-hidden />
          )}
          <span>{loading ? '…' : alignmentData ? 'Refresh' : 'Fetch'}</span>
        </button>
      </div>

      {alignmentData && (
        <p className="starlink-strip-data">
          <span className="starlink-strip-mono">
            Az {formatDegrees(alignmentData.azimuth_deg)}
          </span>
          <span className="starlink-strip-sep" aria-hidden>
            ·
          </span>
          <span className="starlink-strip-mono">
            El {formatDegrees(alignmentData.elevation_deg)}
          </span>
          <span className="starlink-strip-sep" aria-hidden>
            ·
          </span>
          <span
            className={
              alignmentData.is_aligned
                ? 'starlink-strip-ok'
                : 'starlink-strip-warn'
            }
          >
            {alignmentData.is_aligned ? 'Aligned' : 'Adjusting'}
          </span>
        </p>
      )}

      {alignmentData && !alignmentData.is_aligned && (
        <p className="starlink-strip-hint" role="status">
          <AlertTriangle size={11} aria-hidden />
          Dish is still adjusting boresight.
        </p>
      )}

      {error && (
        <p role="alert" className="starlink-strip-error" title={error}>
          {error}
        </p>
      )}

      {desktopOnly && (
        <p className="starlink-strip-hint">
          Dish alignment needs the SatX desktop app on your Starlink network (not
          this browser view).
        </p>
      )}

      {!desktopOnly && !alignmentData && !error && !loading && (
        <p className="starlink-strip-hint">On Starlink LAN — fetch boresight.</p>
      )}

      {alignmentData && !hasDishSite && (
        <p className="starlink-strip-hint">
          Allow location access (light blue marker) to link dish boresight to a
          satellite.
        </p>
      )}

      {alignmentData && hasDishSite && dishSite && (
        <p className="starlink-strip-hint">
          Dish site {dishSite.latitude.toFixed(2)}°, {dishSite.longitude.toFixed(2)}°
          (your location)
        </p>
      )}

      {alignmentData && hasDishSite && servicingSatelliteName && (
        <p className="starlink-strip-hint starlink-strip-servicing">
          Servicing: {servicingSatelliteName}
        </p>
      )}
    </section>
  );
}
