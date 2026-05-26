const DB_NAME = 'satx';
const DB_VERSION = 1;
const STORE_NAME = 'tle-catalog';
const ENTRY_ID = 'active-v3';

export interface TleCacheEntry {
  records: Array<{
    name: string;
    line1: string;
    line2: string;
    id: string;
  }>;
  fetchedAt: number;
  source: string;
}

const LEGACY_LOCAL_STORAGE_KEYS = [
  'satx:celestrak:active-tle',
  'satx:celestrak:active-tle:timestamp',
  'satx:tle-cache:v3',
  'satx:tle-cache:v3:timestamp',
  'satx:tle-cache:v3:source',
];

/** Free quota from pre-IndexedDB builds that stored the full catalog in localStorage. */
export function purgeLegacyTleLocalStorage(): void {
  for (const key of LEGACY_LOCAL_STORAGE_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      reject(request.error ?? new Error('IndexedDB open failed'));
    };
  });
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        const request = run(store);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
          reject(request.error ?? new Error('IndexedDB request failed'));
        };

        tx.oncomplete = () => db.close();
        tx.onerror = () => {
          reject(tx.error ?? new Error('IndexedDB transaction failed'));
        };
      }),
  );
}

export async function readTleCache(): Promise<TleCacheEntry | null> {
  try {
    const entry = await runTransaction('readonly', (store) =>
      store.get(ENTRY_ID),
    );
    if (!entry || typeof entry !== 'object') return null;
    const cached = entry as TleCacheEntry;
    if (!Array.isArray(cached.records)) return null;
    return cached;
  } catch {
    return null;
  }
}

export async function writeTleCache(entry: TleCacheEntry): Promise<void> {
  try {
    await runTransaction('readwrite', (store) => store.put(entry, ENTRY_ID));
  } catch {
    // Non-fatal: app still works without persistence.
  }
}
