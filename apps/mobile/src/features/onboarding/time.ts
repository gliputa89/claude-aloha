/** Czas w formacie `h:mm:ss` albo `mm:ss` → sekundy. Puste lub błędne → `null`. */
export function parseDuration(input: string): number | null {
  const parts = input.trim().split(/[:.]/);
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d{1,2}$/.test(p))) return null;
  const nums = parts.map(Number);
  const [h, m, s] = nums.length === 3 ? nums : [0, ...nums];
  if (m === undefined || s === undefined || h === undefined) return null;
  if (m > 59 || s > 59) return null;
  const total = h * 3600 + m * 60 + s;
  return total > 0 ? total : null;
}

/** Sekundy → `h:mm:ss` (od godziny wzwyż) albo `mm:ss`. */
export function formatDuration(totalS: number) {
  const s = Math.round(totalS);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** Dzisiejsza data w strefie urządzenia, `YYYY-MM-DD`. */
export function todayIso(now = new Date()) {
  return toIsoDate(now);
}

export function toIsoDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromIsoDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function addDays(d: Date, days: number) {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}
