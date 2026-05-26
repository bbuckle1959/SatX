/** CelesTrak SATCAT OBJECT_TYPE codes. */
const OBJECT_TYPE_LABELS: Record<string, string> = {
  PAY: 'Payload',
  'R/B': 'Rocket body',
  DEB: 'Debris',
  UNKN: 'Unknown',
};

/** Common launch site codes (CelesTrak SATCAT). */
const LAUNCH_SITE_LABELS: Record<string, string> = {
  AFETR: 'Cape Canaveral / Eastern Range',
  AFWTR: 'Vandenberg',
  BOSP: 'Sea launch (Pacific)',
  FRGUI: 'Guiana Space Centre',
  HGSTR: 'Hammaguir',
  JCS: 'Tanegashima / Japan',
  JSC: 'Baykonur / Baikonur',
  KODAK: 'Kodiak',
  KSCUT: 'Satish Dhawan / Sriharikota',
  KYMTR: 'Kapustin Yar',
  NSC: 'Naro / South Korea',
  PLMSC: 'Plesetsk',
  RLLB: 'Rocket Lab LC-1',
  SADOL: 'Submarine / Barents',
  SCSLA: 'Shuang Chengzi',
  SEAL: 'Sea launch',
  SEM: 'Semnan',
  SMTS: 'Satish Dhawan',
  SNMLR: 'Sun-synchronous marine',
  SRIHP: 'Satish Dhawan',
  SXLSC: 'Shuang Chengzi',
  TNSTA: 'Taiyuan',
  TTMTR: 'Tonghae / Sohae',
  TYMSC: 'Baikonur',
  VOSTO: 'Vostochny',
  WLPIS: 'Wenchang',
  WOMRA: 'Woomera',
  WSC: 'Wenchang',
  XSC: 'Xichang',
};

export function formatSatcatObjectType(code: string): string {
  const key = code.trim().toUpperCase();
  if (!key) return '—';
  return OBJECT_TYPE_LABELS[key] ?? key;
}

export function formatLaunchSite(code: string): string {
  const key = code.trim().toUpperCase();
  if (!key) return '—';
  const label = LAUNCH_SITE_LABELS[key];
  return label ? `${label} (${key})` : key;
}

export function formatOwner(code: string): string {
  const trimmed = code.trim();
  return trimmed || '—';
}
