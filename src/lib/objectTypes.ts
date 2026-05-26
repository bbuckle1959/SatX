/** CelesTrak-style categories inferred from satellite names in the active catalog. */
export type ObjectType =
  | 'stations'
  | 'starlink'
  | 'navigation'
  | 'weather'
  | 'communications'
  | 'scientific'
  | 'amateur'
  | 'debris'
  | 'military'
  | 'other';

export type ObjectTypeFilter = 'all' | ObjectType;

export interface ObjectTypeOption {
  value: ObjectTypeFilter;
  label: string;
}

export const OBJECT_TYPE_OPTIONS: readonly ObjectTypeOption[] = [
  { value: 'all', label: 'All objects' },
  { value: 'stations', label: 'Space stations' },
  { value: 'starlink', label: 'Starlink' },
  { value: 'navigation', label: 'Navigation (GPS, Galileo, …)' },
  { value: 'weather', label: 'Weather & Earth observation' },
  { value: 'communications', label: 'Communications' },
  { value: 'scientific', label: 'Scientific & research' },
  { value: 'amateur', label: 'Amateur & educational' },
  { value: 'debris', label: 'Debris & rocket bodies' },
  { value: 'military', label: 'Military & defense' },
  { value: 'other', label: 'Other' },
] as const;

export function classifyObjectType(name: string): ObjectType {
  const n = name.toUpperCase();

  if (
    /\bISS\b|ZARYA|TIANGONG|CSS |CHINESE STATION|SPACE STATION|SKYLAB|OLYMPUS/i.test(
      name,
    )
  ) {
    return 'stations';
  }

  if (/STARLINK/i.test(n)) return 'starlink';

  if (
    /\bDEB\b|DEBRIS|ROCKET BODY|\bR\/B\b|SL-\d+ R|CZ-\d+ R|FREGAT R|SYLDA/i.test(
      n,
    )
  ) {
    return 'debris';
  }

  if (
    /GPS|NAVSTAR|GLONASS|GALILEO|BEIDOU|COMPASS|QZSS|IRNSS|SBAS|COSMOS \d+ \(MK|GLOBAL POSITIONING/i.test(
      n,
    )
  ) {
    return 'navigation';
  }

  if (
    /NOAA|GOES|METEOSAT|METOP|AQUA|TERRA|LANDSAT|SENTINEL|SUOMI|NPP|JPSS|DMSP|WEATHER|FENGYUN|GAOFEN|RESURS|SPOT-|WORLDVIEW|RAPIDEYE/i.test(
      n,
    )
  ) {
    return 'weather';
  }

  if (
    /AMSAT|AO-\d|SO-\d|CUBESAT|CUBE SAT|FUNcube|FO-\d|FOX-|JULES|GRIFEX|HAMSAT/i.test(
      n,
    )
  ) {
    return 'amateur';
  }

  if (
    /SCIENT|RESEARCH|SWARM|CLUSTER|XMM|INTEGRAL|HUBBLE|CHANDRA|SPIREX|TESS|KEPLER|JWST|WEBB|PLANCK|HERSCHEL/i.test(
      n,
    )
  ) {
    return 'scientific';
  }

  if (
    /ONEWEB|KUIPER|INTELSAT|EUTELSAT|DIRECTV|VIASAT|SES-|GEESAT|ORBCOMM|GLOBALSTAR|IRIDIUM|GALAXY|ANIK |TELSTAR|SYRACUSE|MILSTAR|WGS |AEHF|DSCS/i.test(
      n,
    )
  ) {
    return 'communications';
  }

  if (
    /USA \d+|NROL-|NRO |LACROSSE|MENTOR|KEYHOLE|KH-|MILSTAR|DSP |SBIRS|DELTA 4|ATLAS V.*USA|FIA |MILITARY|DEFENSE|NAVY|USAF/i.test(
      n,
    )
  ) {
    return 'military';
  }

  return 'other';
}

export function buildTypeById(
  tles: ReadonlyArray<{ id: string; name: string }>,
): Map<string, ObjectType> {
  const map = new Map<string, ObjectType>();
  for (const tle of tles) {
    map.set(tle.id, classifyObjectType(tle.name));
  }
  return map;
}

export function matchesObjectTypeFilter(
  satelliteId: string,
  filter: ObjectTypeFilter,
  typeById: ReadonlyMap<string, ObjectType>,
): boolean {
  if (filter === 'all') return true;
  return typeById.get(satelliteId) === filter;
}

export function getObjectTypeLabel(filter: ObjectTypeFilter): string {
  return (
    OBJECT_TYPE_OPTIONS.find((opt) => opt.value === filter)?.label ?? filter
  );
}
