import bundled from '../data/ground-stations.json';
import { fetchWithTimeout } from '../lib/fetchWithTimeout';
import type {
  GroundStation,
  GroundStationsBundle,
  GroundStationsSummary,
} from '../lib/groundStationTypes';
import { summarizeGroundStations } from '../lib/groundStationTypes';

const HF_DATASET = 'juliensimon/starlink-ground-stations';
const HF_ROWS = 'https://datasets-server.huggingface.co/rows';
const PAGE_SIZE = 100;

const CACHE_KEY = 'satx:ground-stations:bundle';
const CACHE_TIMESTAMP_KEY = 'satx:ground-stations:timestamp';
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const bundledPayload = bundled as GroundStationsBundle;

interface HfRow<T> {
  row: T;
}

interface HfGatewayRow {
  name: string;
  lat: number;
  lon: number;
  status: string;
}

interface HfPopRow {
  code: string | null;
  city: string;
  country: string;
  lat: number;
  lon: number;
}

interface HfRowsResponse<T> {
  rows: HfRow<T>[];
  num_rows_total: number;
}

interface GroundStationsCachePayload {
  bundle: GroundStationsBundle;
  fetchedAt: number;
}

function slugId(prefix: string, raw: string): string {
  const base = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${prefix}-${base || 'unknown'}`;
}

function normalizeGateways(records: HfGatewayRow[]): GroundStation[] {
  return records.map((row) => {
    const status =
      row.status === 'operational' || row.status === 'planned'
        ? row.status
        : undefined;
    return {
      id: slugId('gw', row.name),
      kind: 'gateway',
      name: row.name,
      latitude: row.lat,
      longitude: row.lon,
      ...(status ? { status } : {}),
    };
  });
}

function normalizePops(records: HfPopRow[]): GroundStation[] {
  return records.map((row) => {
    const code = row.code?.trim() || undefined;
    const city = row.city?.trim() || 'Unknown';
    const country = row.country?.trim() || '';
    const name = country ? `${city}, ${country}` : city;
    const id = code ? slugId('pop', code) : slugId('pop', `${city}-${country}`);

    return {
      id,
      kind: 'pop',
      name,
      latitude: row.lat,
      longitude: row.lon,
      ...(country ? { country } : {}),
      ...(code ? { code } : {}),
    };
  });
}

function buildBundle(stations: GroundStation[]): GroundStationsBundle {
  const summary = summarizeGroundStations(stations);
  return {
    source: HF_DATASET,
    syncedAt: new Date().toISOString(),
    counts: {
      gateways: summary.gateways,
      operational: summary.operational,
      planned: summary.planned,
      pops: summary.pops,
      total: stations.length,
    },
    stations,
  };
}

function readCache(): GroundStationsCachePayload | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const timestampRaw = localStorage.getItem(CACHE_TIMESTAMP_KEY);
    if (!raw || !timestampRaw) return null;

    const fetchedAt = Number(timestampRaw);
    if (!Number.isFinite(fetchedAt)) return null;

    const bundle = JSON.parse(raw) as GroundStationsBundle;
    if (!bundle?.stations || !Array.isArray(bundle.stations)) return null;

    return { bundle, fetchedAt };
  } catch {
    return null;
  }
}

function writeCache(bundle: GroundStationsBundle): void {
  const fetchedAt = Date.now();
  localStorage.setItem(CACHE_KEY, JSON.stringify(bundle));
  localStorage.setItem(CACHE_TIMESTAMP_KEY, String(fetchedAt));
}

function isCacheFresh(fetchedAt: number): boolean {
  return Date.now() - fetchedAt < CACHE_MAX_AGE_MS;
}

async function fetchConfigRows<T>(config: 'gateways' | 'pops'): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const url = new URL(HF_ROWS);
    url.searchParams.set('dataset', HF_DATASET);
    url.searchParams.set('config', config);
    url.searchParams.set('split', 'train');
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('length', String(PAGE_SIZE));

    const response = await fetchWithTimeout(url.toString(), {}, 12_000);
    if (!response.ok) {
      throw new Error(`Ground stations ${config}: HTTP ${response.status}`);
    }

    const body = (await response.json()) as HfRowsResponse<T>;
    total = body.num_rows_total ?? offset + (body.rows?.length ?? 0);

    for (const entry of body.rows ?? []) {
      rows.push(entry.row);
    }

    offset += body.rows?.length ?? 0;
    if (!body.rows?.length) break;
  }

  return rows;
}

async function fetchFromHuggingFace(): Promise<GroundStationsBundle> {
  const [gateways, pops] = await Promise.all([
    fetchConfigRows<HfGatewayRow>('gateways'),
    fetchConfigRows<HfPopRow>('pops'),
  ]);
  const stations = [...normalizeGateways(gateways), ...normalizePops(pops)];
  return buildBundle(stations);
}

/** Bundled snapshot shipped with the app (offline-safe). */
export function getBundledGroundStations(): GroundStationsBundle {
  return bundledPayload;
}

export function getBundledGroundStationSummary(): GroundStationsSummary {
  return summarizeGroundStations(bundledPayload.stations);
}

/**
 * Load ground stations: fresh HF cache when possible, else bundled JSON.
 * Non-fatal — always returns a usable station list.
 */
export async function loadGroundStations(): Promise<GroundStationsBundle> {
  const cached = readCache();
  if (cached && isCacheFresh(cached.fetchedAt)) {
    return cached.bundle;
  }

  try {
    const bundle = await fetchFromHuggingFace();
    writeCache(bundle);
    return bundle;
  } catch {
    if (cached) return cached.bundle;
    return bundledPayload;
  }
}

export function filterVisibleGroundStations(
  stations: ReadonlyArray<GroundStation>,
  showGateways: boolean,
  showPops: boolean,
): GroundStation[] {
  return stations.filter((station) => {
    if (station.kind === 'gateway') return showGateways;
    if (station.kind === 'pop') return showPops;
    return false;
  });
}
