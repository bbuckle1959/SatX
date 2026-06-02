import { invoke, isTauri } from '@tauri-apps/api/core';
import { AlertTriangle, Loader2, Radio, RefreshCw } from 'lucide-react';
import { useCallback, useState } from 'react';

import { MIN_SERVICING_SATELLITE_ELEVATION_DEG } from '../lib/starlinkPointing';

export interface StarlinkAlignment {
  azimuth_deg: number;
  elevation_deg: number;
  is_aligned: boolean;
}

function formatDegrees(value: number): string {
  return `${value.toFixed(1)}°`;
}

export interface ServicingCandidateUi {
  id: string;
  name: string;
  rank: number;
}

interface StarlinkPanelProps {
  alignment: StarlinkAlignment | null;
  onAlignmentChange: (data: StarlinkAlignment | null) => void;
  servicingCandidates?: ReadonlyArray<ServicingCandidateUi>;
  onSelectServicing?: (id: string) => void;
  selectedId?: string | null;
  hasDishSite?: boolean;
  dishSite?: { latitude: number; longitude: number } | null;
}

export function StarlinkPanel({
  alignment,
  onAlignmentChange,
  servicingCandidates = [],
  onSelectServicing,
  selectedId = null,
  hasDishSite = false,
  dishSite = null,
}: StarlinkPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAlignment = useCallback(async () => {
    if (!isTauri()) return;

    setLoading(true);
    setError(null);

    try {
      const data = await invoke<StarlinkAlignment>('get_dish_alignment');
      onAlignmentChange(data);
    } catch (err) {
      onAlignmentChange(null);
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
  }, [onAlignmentChange]);

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
              : alignment
                ? 'Refresh alignment'
                : 'Fetch alignment'
          }
        >
          {loading ? (
            <Loader2 size={12} className="animate-spin" aria-hidden />
          ) : (
            <RefreshCw size={12} aria-hidden />
          )}
          <span>{loading ? '…' : alignment ? 'Refresh' : 'Fetch'}</span>
        </button>
      </div>

      {alignment && (
        <p className="starlink-strip-data">
          <span className="starlink-strip-mono">
            Az {formatDegrees(alignment.azimuth_deg)}
          </span>
          <span className="starlink-strip-sep" aria-hidden>
            ·
          </span>
          <span className="starlink-strip-mono">
            El {formatDegrees(alignment.elevation_deg)}
          </span>
          <span className="starlink-strip-sep" aria-hidden>
            ·
          </span>
          <span
            className={
              alignment.is_aligned
                ? 'starlink-strip-ok'
                : 'starlink-strip-warn'
            }
          >
            {alignment.is_aligned ? 'Aligned' : 'Adjusting'}
          </span>
        </p>
      )}

      {alignment && !alignment.is_aligned && (
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

      {!desktopOnly && !alignment && !error && !loading && (
        <p className="starlink-strip-hint">On Starlink LAN — fetch boresight.</p>
      )}

      {alignment && !hasDishSite && (
        <p className="starlink-strip-hint">
          Allow location access (red marker) to link dish boresight to a
          satellite.
        </p>
      )}

      {alignment && hasDishSite && dishSite && (
        <p className="starlink-strip-hint">
          Dish site {dishSite.latitude.toFixed(2)}°, {dishSite.longitude.toFixed(2)}°
          (your location)
        </p>
      )}

      {alignment && hasDishSite && servicingCandidates.length === 0 && (
        <p className="starlink-strip-hint" role="status">
          No in-beam satellite ≥{MIN_SERVICING_SATELLITE_ELEVATION_DEG}° above the
          horizon at the dish (low targets ignored for obstructions).
        </p>
      )}

      {alignment &&
        hasDishSite &&
        servicingCandidates.map((candidate) => {
          const label =
            candidate.rank === 0
              ? `Servicing: ${candidate.name}`
              : `Candidate ${candidate.rank + 1}: ${candidate.name}`;
          return (
            <button
              key={candidate.id}
              type="button"
              className={`starlink-strip-hint starlink-strip-servicing starlink-strip-servicing-btn${selectedId === candidate.id ? ' starlink-strip-servicing-btn--selected' : ''}`}
              onClick={() => onSelectServicing?.(candidate.id)}
            >
              {label}
              {selectedId === candidate.id
                ? ' · selected'
                : ' · tap to select'}
            </button>
          );
        })}
    </section>
  );
}
