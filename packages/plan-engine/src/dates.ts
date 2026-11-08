// Daty jako `YYYY-MM-DD` liczone w UTC – bez stref czasowych i przesunięć DST.

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseIsoDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function formatIsoDate(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDaysIso(iso: string, days: number) {
  return formatIsoDate(parseIsoDate(iso) + days * DAY_MS);
}

/** Dzień tygodnia ISO: 1 = poniedziałek … 7 = niedziela. */
export function isoWeekday(iso: string) {
  return ((new Date(parseIsoDate(iso)).getUTCDay() + 6) % 7) + 1;
}

export function daysBetween(fromIso: string, toIso: string) {
  return Math.round((parseIsoDate(toIso) - parseIsoDate(fromIso)) / DAY_MS);
}
