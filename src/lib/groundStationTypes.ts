export type GroundStationKind = 'gateway' | 'pop';
export type GroundStationStatus = 'operational' | 'planned';

export interface GroundStation {
  id: string;
  kind: GroundStationKind;
  name: string;
  latitude: number;
  longitude: number;
  status?: GroundStationStatus;
  country?: string;
  code?: string;
}

export interface GroundStationsBundle {
  source: string;
  syncedAt: string;
  counts: {
    gateways: number;
    operational: number;
    planned: number;
    pops: number;
    total: number;
  };
  stations: GroundStation[];
}

export interface GroundStationsSummary {
  gateways: number;
  operational: number;
  planned: number;
  pops: number;
}

export function summarizeGroundStations(
  stations: ReadonlyArray<GroundStation>,
): GroundStationsSummary {
  let gateways = 0;
  let operational = 0;
  let planned = 0;
  let pops = 0;

  for (const station of stations) {
    if (station.kind === 'pop') {
      pops += 1;
      continue;
    }
    gateways += 1;
    if (station.status === 'operational') operational += 1;
    else if (station.status === 'planned') planned += 1;
  }

  return { gateways, operational, planned, pops };
}
