import { invoke } from '@tauri-apps/api/core';

import { fetchWithTimeout } from '../lib/fetchWithTimeout';
import { describeFetchFailure } from '../lib/networkError';
import {
  celestrakCatalogUrl,
  isTauriRuntime,
  markCelestrakUnreachable,
} from '../lib/runtime';
import {
  purgeLegacyTleLocalStorage,
  readTleCache,
  writeTleCache,
} from '../lib/tleCacheDb';
import {
  GITHUB_ACTIVE_TLE_URL,
  RETLECTOR_ACTIVE_TLE_URL,
  TLE_HTTP_HEADERS,
} from '../lib/tleSources';

const CELESTRAK_GP_PATH = '/NORAD/elements/gp.php?GROUP=active&FORMAT=tle';
const TLE_API_BASE = 'https://tle.ivanstanojevic.me/api/tle/';
const TLE_API_PAGE_SIZE = 100;
const TLE_API_CONCURRENCY = 12;

const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
let legacyStoragePurged = false;
/** Reject partial/stale caches from older builds or failed downloads. */
const MIN_CATALOG_RECORDS = 3000;

export interface TleCatalogResult {
  records: TleRecord[];
  source: string;
}

export interface TleRecord {
  name: string;
  line1: string;
  line2: string;
  id: string;
}

interface TleApiMember {
  name: string;
  line1: string;
  line2: string;
}

interface TleApiPage {
  member: TleApiMember[];
  view?: {
    last?: string;
  };
}

function celestrakGpUrl(): string {
  return celestrakCatalogUrl(CELESTRAK_GP_PATH);
}

function ensureLegacyStoragePurged(): void {
  if (legacyStoragePurged) return;
  purgeLegacyTleLocalStorage();
  legacyStoragePurged = true;
}

function isCacheFresh(fetchedAt: number): boolean {
  return Date.now() - fetchedAt < CACHE_MAX_AGE_MS;
}

/** Extract NORAD catalog number from a TLE line 1 (columns 3–7). */
function noradIdFromLine1(line1: string): string {
  return line1.length >= 7 ? line1.slice(2, 7).trim() : '';
}

/**
 * Parse raw CelesTrak TLE text (3 lines per object: name, line1, line2).
 */
export function parseTleText(text: string): TleRecord[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const records: TleRecord[] = [];

  for (let i = 0; i + 2 < lines.length; i += 3) {
    const name = lines[i];
    const line1 = lines[i + 1];
    const line2 = lines[i + 2];

    if (!line1.startsWith('1 ') || !line2.startsWith('2 ')) {
      continue;
    }

    const id = noradIdFromLine1(line1);
    if (!id) continue;

    records.push({ name, line1, line2, id });
  }

  return records;
}

function memberToRecord(member: TleApiMember): TleRecord | null {
  if (!member.line1.startsWith('1 ') || !member.line2.startsWith('2 ')) {
    return null;
  }

  const id = noradIdFromLine1(member.line1);
  if (!id) return null;

  return {
    name: member.name,
    line1: member.line1,
    line2: member.line2,
    id,
  };
}

function appendMembers(records: TleRecord[], members: TleApiMember[]): void {
  for (const member of members) {
    const record = memberToRecord(member);
    if (record) records.push(record);
  }
}

async function fetchTleFromRust(): Promise<TleRecord[]> {
  const records = await invoke<TleRecord[]>('fetch_active_tles');
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error('Rust TLE catalog returned no records');
  }
  return records;
}

async function fetchTleTextCatalog(
  url: string,
  label: string,
  timeoutMs = 90_000,
): Promise<TleRecord[]> {
  const response = await fetchWithTimeout(
    url,
    { headers: TLE_HTTP_HEADERS },
    timeoutMs,
  );
  if (!response.ok) {
    throw new Error(`${label}: HTTP ${response.status}`);
  }
  const text = await response.text();
  const records = parseTleText(text);
  if (records.length === 0) {
    throw new Error(`${label}: no parseable TLE records`);
  }
  return records;
}

async function fetchTleFromGithubMirror(): Promise<TleRecord[]> {
  return fetchTleTextCatalog(GITHUB_ACTIVE_TLE_URL, 'GitHub mirror');
}

async function fetchTleFromRetlector(): Promise<TleRecord[]> {
  return fetchTleTextCatalog(RETLECTOR_ACTIVE_TLE_URL, 'ReTLEctor mirror');
}

async function fetchTleApiPage(page: number): Promise<TleApiPage> {
  const url = `${TLE_API_BASE}?page=${page}&page-size=${TLE_API_PAGE_SIZE}`;
  const response = await fetchWithTimeout(url, {}, 45_000);

  if (!response.ok) {
    throw new Error(`TLE catalog API failed on page ${page}: ${response.status}`);
  }

  return response.json() as Promise<TleApiPage>;
}

/**
 * Browser-friendly fallback (CORS-enabled). Paginates ~25k objects from
 * https://tle.ivanstanojevic.me — used when CelesTrak blocks or rate-limits.
 */
async function fetchTleFromSatelliteApi(): Promise<TleRecord[]> {
  const firstPage = await fetchTleApiPage(1);
  const lastPage = firstPage.view?.last
    ? Number(new URL(firstPage.view.last).searchParams.get('page'))
    : 1;

  if (!Number.isFinite(lastPage) || lastPage < 1) {
    throw new Error('TLE catalog API returned an invalid page range');
  }

  const records: TleRecord[] = [];
  appendMembers(records, firstPage.member);

  for (let start = 2; start <= lastPage; start += TLE_API_CONCURRENCY) {
    const pages = Array.from(
      { length: Math.min(TLE_API_CONCURRENCY, lastPage - start + 1) },
      (_, index) => start + index,
    );

    const batch = await Promise.all(pages.map((page) => fetchTleApiPage(page)));
    for (const page of batch) {
      appendMembers(records, page.member);
    }
  }

  if (records.length === 0) {
    throw new Error('TLE catalog API returned no parseable records');
  }

  return records;
}

function formatFetchError(status: number, body: string): string {
  if (status === 403 || body.includes('GP data has not updated')) {
    return 'CelesTrak rate-limited this request; using alternate catalog.';
  }

  return `CelesTrak TLE fetch failed: ${status}${body ? ` — ${body.slice(0, 120)}` : ''}`;
}

async function fetchTleFromCelesTrak(): Promise<TleRecord[]> {
  const url = celestrakGpUrl();
  let response: Response;

  try {
    response = await fetchWithTimeout(
      url,
      {
        headers: {
          Accept: 'text/plain,*/*',
        },
      },
      12_000,
    );
  } catch (cause) {
    markCelestrakUnreachable();
    throw new Error(describeFetchFailure(cause, 'CelesTrak'));
  }

  const text = await response.text();

  if (!response.ok) {
    throw new Error(formatFetchError(response.status, text));
  }

  const records = parseTleText(text);

  if (records.length === 0) {
    throw new Error(
      text.includes('GP data has not updated')
        ? formatFetchError(403, text)
        : 'CelesTrak TLE response contained no parseable records',
    );
  }

  return records;
}

const MIRROR_SOURCES: Array<{
  label: string;
  load: () => Promise<TleRecord[]>;
}> = [
  { label: 'GitHub mirror (active.tle)', load: fetchTleFromGithubMirror },
  { label: 'ReTLEctor mirror', load: fetchTleFromRetlector },
  { label: 'TLE API (ivanstanojevic.me)', load: fetchTleFromSatelliteApi },
];

/** Same mirror order in desktop and browser so catalog counts match. */
function catalogSources(): Array<{
  label: string;
  load: () => Promise<TleRecord[]>;
}> {
  const sources = [...MIRROR_SOURCES];
  if (isTauriRuntime()) {
    sources.push({
      label: 'Desktop catalog (Rust)',
      load: fetchTleFromRust,
    });
  } else {
    sources.push({ label: 'CelesTrak', load: fetchTleFromCelesTrak });
  }
  return sources;
}

async function fetchTleFromNetwork(): Promise<TleCatalogResult> {
  const failures: string[] = [];
  for (const { label, load } of catalogSources()) {
    try {
      const records = await load();
      if (records.length < MIN_CATALOG_RECORDS) {
        failures.push(`${label}: only ${records.length} records`);
        continue;
      }
      return { records, source: label };
    } catch (err) {
      failures.push(describeFetchFailure(err, label));
    }
  }

  throw new Error(
    `Could not load satellite catalog.${failures.length ? ` ${failures.join(' · ')}` : ''}`,
  );
}

/**
 * Returns active satellite TLEs, using a 24-hour IndexedDB cache (too large for localStorage).
 * On network failure, returns stale cache if available.
 */
export async function fetchActiveTles(): Promise<TleCatalogResult> {
  ensureLegacyStoragePurged();

  const cached = await readTleCache();
  const validCache =
    cached &&
    cached.records.length >= MIN_CATALOG_RECORDS &&
    isCacheFresh(cached.fetchedAt)
      ? cached
      : null;

  if (validCache) {
    return { records: validCache.records, source: validCache.source };
  }

  try {
    const result = await fetchTleFromNetwork();
    await writeTleCache({
      records: result.records,
      fetchedAt: Date.now(),
      source: result.source,
    });
    return result;
  } catch (error) {
    if (cached && cached.records.length >= MIN_CATALOG_RECORDS) {
      return { records: cached.records, source: cached.source };
    }
    throw error;
  }
}
