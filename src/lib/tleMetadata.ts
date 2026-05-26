import {
  constants,
  invjday,
  radiansToDegrees,
  twoline2satrec,
} from 'satellite.js';

import type { TleRecord } from '../services/spaceTrack';

export interface TleMetadata {
  internationalDesignator: string;
  classification: string;
  classificationLabel: string;
  elementSetNumber: string;
  epochUtc: string;
  meanMotionRevPerDay: number;
  orbitalPeriodMin: number;
  inclinationDeg: number;
  raanDeg: number;
  eccentricity: number;
  argOfPerigeeDeg: number;
  meanAnomalyDeg: number;
  revolutionNumberAtEpoch: string;
  apogeeAltitudeKm: number;
  perigeeAltitudeKm: number;
  semiMajorAxisKm: number;
  bstar: number;
  meanMotionFirstDerivative: number;
  orbitRegime: string;
}

const CLASSIFICATION_LABELS: Record<string, string> = {
  U: 'Unclassified',
  C: 'Classified',
  S: 'Secret',
};

function padLine(line: string, minLen: number): string {
  return line.length >= minLen ? line : line.padEnd(minLen);
}

function formatInternationalDesignator(line1: string): string {
  const raw = padLine(line1, 17).slice(9, 17).trim();
  if (raw.length < 3) return raw || '—';
  const year = raw.slice(0, 2);
  const launch = raw.slice(2, 5);
  const piece = raw.slice(5).trim();
  return piece ? `${year}-${launch}${piece}` : `${year}-${launch}`;
}

function formatClassification(code: string): {
  classification: string;
  classificationLabel: string;
} {
  const c = code.trim().toUpperCase() || '—';
  const label = CLASSIFICATION_LABELS[c] ?? (c === '—' ? 'Unknown' : c);
  return { classification: c, classificationLabel: label };
}

function formatEpochUtc(jdsatepoch: number): string {
  const date = invjday(jdsatepoch);
  return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
}

function formatScientific(value: number, digits = 4): string {
  if (!Number.isFinite(value)) return '—';
  return value.toExponential(digits);
}

export function parseTleMetadata(tle: TleRecord): TleMetadata | null {
  try {
    const line1 = padLine(tle.line1, 69);
    const line2 = padLine(tle.line2, 69);

    const satrec = twoline2satrec(line1, line2);
    if (satrec.error !== 0) return null;

    const meanMotionRevPerDay = parseFloat(line2.slice(52, 63));
    if (!Number.isFinite(meanMotionRevPerDay) || meanMotionRevPerDay <= 0) {
      return null;
    }

    const { classification, classificationLabel } = formatClassification(
      line1[7] ?? '',
    );

    const apogeeAltitudeKm = satrec.alta * constants.earthRadius;
    const perigeeAltitudeKm = satrec.altp * constants.earthRadius;

    return {
      internationalDesignator: formatInternationalDesignator(line1),
      classification,
      classificationLabel,
      elementSetNumber: line1.slice(64, 68).trim() || '—',
      epochUtc: formatEpochUtc(satrec.jdsatepoch),
      meanMotionRevPerDay,
      orbitalPeriodMin: constants.minutesPerDay / meanMotionRevPerDay,
      inclinationDeg: radiansToDegrees(satrec.inclo),
      raanDeg: radiansToDegrees(satrec.nodeo),
      eccentricity: satrec.ecco,
      argOfPerigeeDeg: radiansToDegrees(satrec.argpo),
      meanAnomalyDeg: radiansToDegrees(satrec.mo),
      revolutionNumberAtEpoch: line2.slice(63, 68).trim() || '—',
      apogeeAltitudeKm,
      perigeeAltitudeKm,
      semiMajorAxisKm: satrec.a * constants.earthRadius,
      bstar: satrec.bstar,
      meanMotionFirstDerivative: satrec.ndot,
      orbitRegime: satrec.method === 'd' ? 'Deep space' : 'Near Earth',
    };
  } catch {
    return null;
  }
}

export function formatTleMetadataValue(
  key: keyof TleMetadata,
  meta: TleMetadata,
): string {
  switch (key) {
    case 'eccentricity':
      return meta.eccentricity.toFixed(7);
    case 'meanMotionRevPerDay':
      return meta.meanMotionRevPerDay.toFixed(8);
    case 'orbitalPeriodMin':
      return meta.orbitalPeriodMin.toFixed(2);
    case 'inclinationDeg':
    case 'raanDeg':
    case 'argOfPerigeeDeg':
    case 'meanAnomalyDeg':
      return `${meta[key].toFixed(4)}°`;
    case 'apogeeAltitudeKm':
    case 'perigeeAltitudeKm':
    case 'semiMajorAxisKm':
      return `${meta[key].toFixed(2)} km`;
    case 'bstar':
      return formatScientific(meta.bstar);
    case 'meanMotionFirstDerivative':
      return formatScientific(meta.meanMotionFirstDerivative);
    default:
      return String(meta[key]);
  }
}
