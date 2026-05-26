import { fetchWithTimeout } from '../lib/fetchWithTimeout';
import {
  celestrakCatalogUrl,
  markCelestrakUnreachable,
  shouldSkipCelestrakNetwork,
} from '../lib/runtime';

const SATCAT_PATH =
  '/satcat/records.php?GROUP=active&ONORBIT=1&FORMAT=JSON';

const CACHE_KEY = 'satx:celestrak:active-satcat';
const CACHE_TIMESTAMP_KEY = 'satx:celestrak:active-satcat:timestamp';
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface SatcatEntry {
  noradId: string;
  objectName: string;
  objectId: string;
  objectType: string;
  owner: string;
  launchDate: string;
  launchSite: string;
  decayDate: string;
}

interface SatcatCachePayload {
  entries: SatcatEntry[];
  fetchedAt: number;
}

interface SatcatJsonRecord {
  OBJECT_NAME?: string;
  OBJECT_ID?: string;
  NORAD_CAT_ID?: number;
  OBJECT_TYPE?: string;
  OWNER?: string;
  LAUNCH_DATE?: string;
  LAUNCH_SITE?: string;
  DECAY_DATE?: string;
}

function satcatUrl(): string {
  return celestrakCatalogUrl(SATCAT_PATH);
}

function readCache(): SatcatCachePayload | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const timestampRaw = localStorage.getItem(CACHE_TIMESTAMP_KEY);
    if (!raw || !timestampRaw) return null;

    const fetchedAt = Number(timestampRaw);
    if (!Number.isFinite(fetchedAt)) return null;

    const entries = JSON.parse(raw) as SatcatEntry[];
    if (!Array.isArray(entries)) return null;

    return { entries, fetchedAt };
  } catch {
    return null;
  }
}

function writeCache(entries: SatcatEntry[]): void {
  const fetchedAt = Date.now();
  localStorage.setItem(CACHE_KEY, JSON.stringify(entries));
  localStorage.setItem(CACHE_TIMESTAMP_KEY, String(fetchedAt));
}

function isCacheFresh(fetchedAt: number): boolean {
  return Date.now() - fetchedAt < CACHE_MAX_AGE_MS;
}

function entryFromCache(noradId: string): SatcatEntry | null {
  const cached = readCache();
  if (!cached) return null;
  return cached.entries.find((e) => e.noradId === noradId) ?? null;
}

function recordToEntry(record: SatcatJsonRecord): SatcatEntry | null {
  const noradId = record.NORAD_CAT_ID;
  if (noradId === undefined || noradId === null) return null;

  return {
    noradId: String(noradId),
    objectName: record.OBJECT_NAME?.trim() ?? '',
    objectId: record.OBJECT_ID?.trim() ?? '',
    objectType: record.OBJECT_TYPE?.trim() ?? '',
    owner: record.OWNER?.trim() ?? '',
    launchDate: record.LAUNCH_DATE?.trim() ?? '',
    launchSite: record.LAUNCH_SITE?.trim() ?? '',
    decayDate: record.DECAY_DATE?.trim() ?? '',
  };
}

async function fetchSatcatFromNetwork(): Promise<SatcatEntry[]> {
  const response = await fetchWithTimeout(satcatUrl(), {}, 10_000);
  if (!response.ok) {
    throw new Error(`SATCAT request failed: ${response.status}`);
  }

  const records = (await response.json()) as SatcatJsonRecord[];
  if (!Array.isArray(records)) {
    throw new Error('SATCAT response was not an array');
  }

  const entries: SatcatEntry[] = [];
  for (const record of records) {
    const entry = recordToEntry(record);
    if (entry) entries.push(entry);
  }

  if (entries.length === 0) {
    throw new Error('SATCAT returned no usable records');
  }

  return entries;
}

export function buildSatcatById(
  entries: ReadonlyArray<SatcatEntry>,
): Map<string, SatcatEntry> {
  const map = new Map<string, SatcatEntry>();
  for (const entry of entries) {
    map.set(entry.noradId, entry);
  }
  return map;
}

/**
 * CelesTrak SATCAT for the active catalog (launch date, site, owner, etc.).
 * Cached 24h; non-fatal if unavailable.
 */
export async function fetchActiveSatcat(): Promise<Map<string, SatcatEntry>> {
  const cached = readCache();
  if (cached && isCacheFresh(cached.fetchedAt)) {
    return buildSatcatById(cached.entries);
  }

  if (shouldSkipCelestrakNetwork()) {
    return cached ? buildSatcatById(cached.entries) : new Map();
  }

  try {
    const entries = await fetchSatcatFromNetwork();
    writeCache(entries);
    return buildSatcatById(entries);
  } catch {
    markCelestrakUnreachable();
    return cached ? buildSatcatById(cached.entries) : new Map();
  }
}

/** Per-object lookup when bulk SATCAT missed an ID (cache only if CelesTrak is skipped). */
export async function fetchSatcatByNoradId(
  noradId: string,
): Promise<SatcatEntry | null> {
  const cachedHit = entryFromCache(noradId);
  if (cachedHit) return cachedHit;

  if (shouldSkipCelestrakNetwork()) {
    return null;
  }

  const path = `/satcat/records.php?CATNR=${encodeURIComponent(noradId)}&FORMAT=JSON`;
  const url = celestrakCatalogUrl(path);

  try {
    const response = await fetchWithTimeout(url, {}, 8_000);
    if (!response.ok) return null;

    const records = (await response.json()) as SatcatJsonRecord[];
    if (!Array.isArray(records) || records.length === 0) return null;

    return recordToEntry(records[0]);
  } catch {
    markCelestrakUnreachable();
    return null;
  }
}
