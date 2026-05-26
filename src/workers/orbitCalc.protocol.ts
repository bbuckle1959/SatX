/** Serializable TLE row posted from the main thread once per catalog load. */
export interface TlePayload {
  id: string;
  name: string;
  line1: string;
  line2: string;
}

export const ORBIT_TICK_MS = 250;

export type OrbitWorkerIn =
  | { type: 'init'; tles: TlePayload[] }
  | { type: 'set-active-ids'; ids: string[] }
  | { type: 'set-paused'; paused: boolean };

export type OrbitWorkerOut =
  | { type: 'ready'; parsedCount: number }
  | {
      type: 'positions';
      /** Worker clock (ms) for the propagation sample. */
      at: number;
      ids: string[];
      /** Packed [lat, lng, alt, lat, lng, alt, …] aligned with `ids`. */
      coords: Float64Array;
    };
