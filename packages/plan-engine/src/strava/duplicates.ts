// Ten sam bieg z dwóch źródeł: Apple Watch zapisuje trening w Apple Zdrowie i zwykle wysyła go też do Stravy.
// Bez tej reguły trening dostałby oba biegi i podwójny dystans. Zostaje wersja ze Stravy (dotychczasowe zachowanie,
// link „Zobacz w Stravie”), bieg z Apple Zdrowie odkładamy.

export type ActivitySource = 'strava' | 'apple_health';

export type SourcedActivity = {
  id: number;
  source: ActivitySource;
  /** Początek (UTC, ISO). */
  startedAt: string;
  elapsedTimeS: number;
};

export const DUPLICATE_RULES = {
  /** Starty różnią się najwyżej o tyle sekund… */
  startToleranceS: 300,
  /** …a czas trwania najwyżej o tyle sekund albo o taki ułamek dłuższego biegu (co większe). */
  durationToleranceS: 300,
  durationToleranceRatio: 0.15,
} as const;

/** Identyfikatory biegów z Apple Zdrowie, które są kopią biegu ze Stravy. */
export function duplicateActivityIds(activities: readonly SourcedActivity[]): Set<number> {
  const strava = activities.filter((a) => a.source === 'strava');
  const out = new Set<number>();
  for (const a of activities) {
    if (a.source !== 'apple_health') continue;
    const start = Date.parse(a.startedAt);
    const twin = strava.some((s) => {
      const startDiff = Math.abs(Date.parse(s.startedAt) - start) / 1000;
      const longer = Math.max(s.elapsedTimeS, a.elapsedTimeS);
      const tolerance = Math.max(DUPLICATE_RULES.durationToleranceS, longer * DUPLICATE_RULES.durationToleranceRatio);
      return startDiff <= DUPLICATE_RULES.startToleranceS && Math.abs(s.elapsedTimeS - a.elapsedTimeS) <= tolerance;
    });
    if (twin) out.add(a.id);
  }
  return out;
}
