// Prognoza czasu na zawody – reguły (bez AI). Trzy składniki:
//
//  1. STAN OBECNY – tabele Danielsa (VDOT): wynik z jednego dystansu → równoważny czas na innym.
//     To „status quo”: zakłada, że biegacz jest na docelowy dystans równie dobrze przygotowany jak na ten,
//     z którego pochodzi wynik.
//  2. OBJĘTOŚĆ – równoważność z tabel spełnia się dopiero przy kilometrażu, którego wymaga dystans
//     (maraton ok. 70 km tygodniowo, 5 km ok. 25). Im mniej biegacz biega względem tej potrzeby, tym gorzej
//     przenosi szybkość na długi dystans – i tym większa kara, największa w maratonie.
//  3. POPRAWA DO STARTU – z malejącymi przyrostami: trudność rośnie wykładniczo z poziomem, więc początkujący
//     zyska w cyklu kilka punktów VDOT, a biegacz z VDOT 55 – ułamek punktu.
//
// Wynik to widełki dla prognozy liczonej przez model (ai/race-forecast.ts) i wartość awaryjna, gdy AI nie odpowie.

import type { Level, RaceDistanceM } from './goal.ts';

// ───────────────────────── tabele Danielsa (VDOT) ─────────────────────────

/** Koszt tlenowy biegu z prędkością `v` (m/min) – wzór Danielsa–Gilberta. */
const vo2At = (v: number) => -4.6 + 0.182258 * v + 0.000104 * v * v;
/** Jaką część VO2max da się utrzymać przez `t` minut. */
const fractionFor = (t: number) => 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t);

/** VDOT z wyniku (dystans w metrach, czas w sekundach); `null`, gdy wynik jest nierealny. */
export function vdotFromResult(distanceM: number, timeS: number): number | null {
  if (!(distanceM >= 1000) || !(timeS > 0)) return null;
  const minutes = timeS / 60;
  const vdot = vo2At(distanceM / minutes) / fractionFor(minutes);
  return vdot >= 20 && vdot <= 90 ? vdot : null;
}

/** Czas (s) na dystansie przy danym VDOT – odwrócenie wzoru bisekcją (czas rośnie, gdy VDOT maleje). */
export function timeForVdot(vdot: number, distanceM: number): number {
  let lo = distanceM / 600; // 10 m/s – szybciej się nie da
  let hi = distanceM / 50; // 0,83 m/s – wolny marsz
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const value = vo2At(distanceM / mid) / fractionFor(mid);
    if (value > vdot) lo = mid;
    else hi = mid;
  }
  return ((lo + hi) / 2) * 60;
}

/** Równoważny czas na innym dystansie wg tabel Danielsa (ten sam VDOT). */
export function danielsEquivalentS(result: { distanceM: number; timeS: number }, distanceM: number): number | null {
  const vdot = vdotFromResult(result.distanceM, result.timeS);
  return vdot === null ? null : timeForVdot(vdot, distanceM);
}

// ───────────────────────── objętość potrzebna do startu ─────────────────────────

export type RaceVolume = {
  /** Kilometraż tygodniowy w szczycie przygotowań, przy którym wynik z tabel jest realny. */
  fullKm: number;
  /** Poniżej tego start jest na ukończenie, nie na wynik. */
  minKm: number;
  /** Najdłuższy bieg w przygotowaniach (km), bez którego końcówka dystansu się „rozsypuje”. */
  longRunKm: number;
  /** O ile procent wolniej niż z tabel biegnie ktoś zupełnie bez objętości pod ten dystans. */
  maxPenaltyPct: number;
};

/**
 * Wymagania objętości wg dystansu. Dla krótkich dystansów szybkość z treningu przenosi się niemal wprost,
 * w maratonie decyduje wytrzymałość – stąd rosnąca kara. Wartości dla amatora; zawodnik z VDOT 60+ potrzebuje więcej.
 */
export const RACE_VOLUME: Record<RaceDistanceM, RaceVolume> = {
  5000: { fullKm: 25, minKm: 10, longRunKm: 8, maxPenaltyPct: 3 },
  10000: { fullKm: 35, minKm: 18, longRunKm: 12, maxPenaltyPct: 5 },
  21097: { fullKm: 50, minKm: 28, longRunKm: 18, maxPenaltyPct: 10 },
  42195: { fullKm: 70, minKm: 42, longRunKm: 30, maxPenaltyPct: 18 },
};

/** Najwyższy bezpieczny przyrost kilometrażu z tygodnia na tydzień i ostatnie tygodnie (taper), które już nie budują. */
const VOLUME_GROWTH = 1.08;
const TAPER_WEEKS = 2;
/** Ile razy może urosnąć kilometraż w jednym cyklu (albo o ile km, gdy start jest bardzo niski). */
const MAX_VOLUME_MULTIPLE = 2.5;
const MIN_VOLUME_STEP_KM = 20;
/** Bez znanego kilometrażu: tyle km na jeden bieg w tygodniu (ostrożnie). */
const KM_PER_RUN = 6;

/** Kara za brak objętości (ułamek czasu): 0 przy pełnym kilometrażu, `maxPenaltyPct` przy zerowym. */
export function volumePenalty(distanceM: RaceDistanceM, weeklyKm: number): number {
  const need = RACE_VOLUME[distanceM];
  const gap = Math.min(1, Math.max(0, 1 - weeklyKm / need.fullKm));
  // Braki blisko pełnej objętości kosztują mało, duże – nieproporcjonalnie dużo.
  return (need.maxPenaltyPct / 100) * gap ** 1.5;
}

// ───────────────────────── poprawa formy ─────────────────────────

/**
 * Ile punktów VDOT można realnie zyskać w cyklu `weeks` tygodni. Zysk maleje wykładniczo z poziomem
 * (każdy kolejny punkt kosztuje więcej) i nasyca się z czasem (większość przychodzi w pierwszych 12 tygodniach).
 */
export function vdotGain(vdot: number, weeks: number): number {
  const headroom = 8 * Math.exp(-(vdot - 30) / 12);
  return Math.max(0, headroom * (1 - Math.exp(-Math.max(0, weeks) / 12)));
}

// ───────────────────────── prognoza ─────────────────────────

export type ForecastInput = {
  distanceM: RaceDistanceM;
  /** Pełne tygodnie do startu. */
  weeks: number;
  level: Level;
  recent: { distanceM: number; timeS: number };
  /** Obecny kilometraż tygodniowy (np. ze Stravy); `null` – szacujemy z liczby biegów. */
  weeklyKm: number | null;
  runsPerWeek: number;
  /** Najdłuższy bieg z ostatnich tygodni (km) – jeśli znamy. */
  longestRunKm?: number | null;
  /** Ile czasu w tygodniu biegacz ma na treningi (z ankiety) – ogranicza kilometraż, do którego dojdzie. */
  weeklyMinutesCap?: number | null;
};

export type RaceForecast = {
  vdot: number;
  /** Czas z tabel Danielsa przy obecnym VDOT, bez poprawek („status quo” na papierze). */
  danielsS: number;
  /** Realnie dziś: tabele + kara za obecną objętość. */
  todayS: number;
  /** Realnie na start: poprawa VDOT z cyklu + objętość, do której biegacz zdąży dojść. */
  raceDayS: number;
  /** Widełki dla prognozy modelu: szybciej / wolniej się nie zgodzimy. */
  fastestS: number;
  slowestS: number;
  volume: { currentKm: number; projectedKm: number; neededKm: number; minKm: number; longRunKm: number; known: boolean };
};

/** Prognoza z reguł. `null`, gdy z wyniku nie da się policzyć VDOT. */
export function forecastRace(input: ForecastInput): RaceForecast | null {
  const vdot = vdotFromResult(input.recent.distanceM, input.recent.timeS);
  if (vdot === null) return null;
  const need = RACE_VOLUME[input.distanceM];
  const known = input.weeklyKm !== null && input.weeklyKm >= 0;
  const currentKm = known ? (input.weeklyKm as number) : Math.max(0, input.runsPerWeek) * KM_PER_RUN;

  // Dokąd dojdzie kilometraż: przyrost ≤ 8% tygodniowo przez tygodnie budowania, nie więcej niż potrzeba
  // i nie więcej, niż mieści się w czasie z ankiety (spokojne tempo ≈ tempo maratońskie z tabel + 15%).
  const buildWeeks = Math.max(0, input.weeks - TAPER_WEEKS);
  const easyPaceSPerKm = (timeForVdot(vdot, 42195) / 42.195) * 1.15;
  const capKm = input.weeklyMinutesCap ? (input.weeklyMinutesCap * 60) / easyPaceSPerKm : Number.POSITIVE_INFINITY;
  const grownKm = Math.max(currentKm, 8) * VOLUME_GROWTH ** buildWeeks;
  // Jeden cykl nie zrobi z 20 km tygodniowo siedemdziesięciu: organizm przyjmie najwyżej ok. 2,5× obecnej objętości.
  const adaptableKm = Math.max(currentKm * MAX_VOLUME_MULTIPLE, currentKm + MIN_VOLUME_STEP_KM);
  const projectedKm = Math.max(currentKm, Math.min(need.fullKm, capKm, grownKm, adaptableKm));

  const danielsS = timeForVdot(vdot, input.distanceM);
  const todayS = danielsS * (1 + volumePenalty(input.distanceM, currentKm));
  const improved = timeForVdot(vdot + vdotGain(vdot, input.weeks), input.distanceM);
  const raceDayS = Math.min(todayS, improved * (1 + volumePenalty(input.distanceM, projectedKm)));

  return {
    vdot: Math.round(vdot * 10) / 10,
    danielsS: Math.round(danielsS),
    todayS: Math.round(todayS),
    raceDayS: Math.round(raceDayS),
    // Szybciej niż „pełna poprawa bez żadnej kary” nie będzie; wolniej niż dzisiejszy stan + 6% – też nie.
    fastestS: Math.round(improved * 0.995),
    slowestS: Math.round(todayS * 1.06),
    volume: {
      currentKm: Math.round(currentKm),
      projectedKm: Math.round(projectedKm),
      neededKm: need.fullKm,
      minKm: need.minKm,
      longRunKm: need.longRunKm,
      known,
    },
  };
}
