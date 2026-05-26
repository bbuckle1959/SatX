import {
  degreesLat,
  degreesLong,
  eciToGeodetic,
  gstime,
  propagate,
  twoline2satrec,
  type SatRec,
} from 'satellite.js';

import {
  ORBIT_TICK_MS,
  type OrbitWorkerIn,
  type OrbitWorkerOut,
  type TlePayload,
} from './orbitCalc.protocol';

interface SatEntry {
  name: string;
  satrec: SatRec;
}

const satrecById = new Map<string, SatEntry>();
let activeIds: string[] = [];
let paused = true;
let tickTimer: ReturnType<typeof setInterval> | null = null;

function isFiniteGeodetic(lat: number, lng: number, alt: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Number.isFinite(alt) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function ingestCatalog(tles: TlePayload[]): number {
  satrecById.clear();
  let parsed = 0;

  for (const tle of tles) {
    try {
      const satrec = twoline2satrec(tle.line1, tle.line2);
      if (satrec.error !== 0) continue;
      satrecById.set(tle.id, { name: tle.name, satrec });
      parsed += 1;
    } catch {
      // skip malformed TLE
    }
  }

  return parsed;
}

function propagateActive(at: number): OrbitWorkerOut | null {
  if (paused || activeIds.length === 0) return null;

  const date = new Date(at);
  const gmst = gstime(date);
  const ids: string[] = [];
  const coords = new Float64Array(activeIds.length * 3);
  let write = 0;

  for (const id of activeIds) {
    const entry = satrecById.get(id);
    if (!entry) continue;

    try {
      const pv = propagate(entry.satrec, date);
      const eci = pv?.position;
      if (!eci) continue;

      const geodetic = eciToGeodetic(eci, gmst);
      const lat = degreesLat(geodetic.latitude);
      const lng = degreesLong(geodetic.longitude);
      const alt = geodetic.height;

      if (!isFiniteGeodetic(lat, lng, alt)) continue;

      ids.push(id);
      coords[write] = lat;
      coords[write + 1] = lng;
      coords[write + 2] = alt;
      write += 3;
    } catch {
      // degreesLat/degreesLong can throw on bad radians
    }
  }

  if (ids.length === 0) return null;

  const packed =
    write === coords.length ? coords : coords.subarray(0, write);

  return {
    type: 'positions',
    at,
    ids,
    coords: packed,
  };
}

function tick(): void {
  const at = Date.now();
  const payload = propagateActive(at);
  if (!payload || payload.type !== 'positions') return;

  const transfer = payload.coords.buffer;
  self.postMessage(payload, { transfer: [transfer] });
}

function ensureTimer(): void {
  if (tickTimer !== null) return;
  tickTimer = setInterval(tick, ORBIT_TICK_MS);
}

function stopTimer(): void {
  if (tickTimer !== null) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
}

function postReady(parsedCount: number): void {
  const out: OrbitWorkerOut = { type: 'ready', parsedCount };
  self.postMessage(out);
}

self.onmessage = (event: MessageEvent<OrbitWorkerIn>) => {
  const msg = event.data;

  switch (msg.type) {
    case 'init': {
      stopTimer();
      activeIds = [];
      paused = true;
      const parsedCount = ingestCatalog(msg.tles);
      postReady(parsedCount);
      return;
    }
    case 'set-active-ids': {
      activeIds = msg.ids;
      if (!paused && activeIds.length > 0) {
        ensureTimer();
        tick();
      } else if (activeIds.length === 0) {
        stopTimer();
      }
      return;
    }
    case 'set-paused': {
      paused = msg.paused;
      if (paused) {
        stopTimer();
      } else if (activeIds.length > 0) {
        ensureTimer();
        tick();
      }
      return;
    }
    default:
      return;
  }
};
