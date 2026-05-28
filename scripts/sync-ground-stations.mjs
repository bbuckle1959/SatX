/**
 * Fetch juliensimon/starlink-ground-stations from Hugging Face Datasets Server
 * and write src/data/ground-stations.json for offline/desktop use.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, '../src/data/ground-stations.json');

const HF_DATASET = 'juliensimon/starlink-ground-stations';
const HF_ROWS =
  'https://datasets-server.huggingface.co/rows';
const PAGE_SIZE = 100;

function slugId(prefix, raw) {
  const base = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${prefix}-${base || 'unknown'}`;
}

async function fetchAllRows(config) {
  const rows = [];
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const url = new URL(HF_ROWS);
    url.searchParams.set('dataset', HF_DATASET);
    url.searchParams.set('config', config);
    url.searchParams.set('split', 'train');
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('length', String(PAGE_SIZE));

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HF rows ${config} failed: ${res.status} ${res.statusText}`);
    }

    const body = await res.json();
    total = body.num_rows_total ?? offset + (body.rows?.length ?? 0);

    for (const entry of body.rows ?? []) {
      rows.push(entry.row);
    }

    offset += body.rows?.length ?? 0;
    if (!body.rows?.length) break;
  }

  return rows;
}

function normalizeGateways(records) {
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

function normalizePops(records) {
  return records.map((row) => {
    const code = row.code?.trim() || null;
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

async function main() {
  console.log('Fetching gateways…');
  const gateways = await fetchAllRows('gateways');
  console.log(`  ${gateways.length} gateways`);

  console.log('Fetching PoPs…');
  const pops = await fetchAllRows('pops');
  console.log(`  ${pops.length} PoPs`);

  const stations = [...normalizeGateways(gateways), ...normalizePops(pops)];
  const operational = gateways.filter((g) => g.status === 'operational').length;
  const planned = gateways.filter((g) => g.status === 'planned').length;

  const payload = {
    source: HF_DATASET,
    syncedAt: new Date().toISOString(),
    counts: {
      gateways: gateways.length,
      operational,
      planned,
      pops: pops.length,
      total: stations.length,
    },
    stations,
  };

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${stations.length} stations to ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
