import { formatPace, METERS_PER_MILE } from '@aloha/plan-engine';
import { useMemo } from 'react';

import { useLocale } from '@/hooks/use-t';
import { useUnits, type Units } from '@/lib/locale-preference';

// Dane w aplikacji i na serwerze są zawsze metryczne (metry, s/km, °C, km/h).
// Na mile i °F zamieniamy tylko to, co widać na ekranie, i to, co biegacz wpisuje.

export function unitFormat(units: Units, locale: 'pl' | 'en') {
  const imperial = units === 'imperial';
  const tag = locale === 'en' ? (imperial ? 'en-US' : 'en-GB') : 'pl-PL';
  const metersPerUnit = imperial ? METERS_PER_MILE : 1000;
  /** „km” albo „mi” – skrót jednostki dystansu. */
  const unit = imperial ? 'mi' : 'km';
  const number = (n: number, digits = 1) => n.toLocaleString(tag, { maximumFractionDigits: digits });

  return {
    units,
    unit,
    /** Dystans w jednostkach biegacza (liczba), np. 5000 m → 5 albo 3,1. */
    fromMeters: (m: number) => m / metersPerUnit,
    /** Wpisana liczba (km albo mile) → metry. */
    toMeters: (n: number) => n * metersPerUnit,
    /** Sama liczba, np. „6,5” – do tekstów, w których jednostka stoi osobno. */
    number: (m: number, digits = 1) => number(m / metersPerUnit, digits),
    /** „6,5 km” / „4 mi”. */
    distance: (m: number, digits = 1) => `${number(m / metersPerUnit, digits)} ${unit}`,
    /** Przybliżony dystans, co pół jednostki (poniżej jednej – z jedną cyfrą po przecinku): „ok. 6,5 km”, „~4 mi”. */
    approxDistance: (m: number) => {
      const v = m / metersPerUnit;
      const rounded = v < 1 ? Math.round(v * 10) / 10 : Math.round(v * 2) / 2;
      return locale === 'en' ? `~${number(rounded)} ${unit}` : `ok. ${number(rounded)} ${unit}`;
    },
    /** Tempo z s/km na „m:ss” na km albo milę. */
    pace: (sPerKm: number) => formatPace((sPerKm * metersPerUnit) / 1000),
    /** „/km” albo „/mi” – przy tempie. */
    paceUnit: `/${unit}`,
    /** Różnica tempa w sekundach na jednostkę (np. „o 12 s/km szybciej” → „o 19 s/mi”). */
    paceDelta: (sPerKm: number) => Math.round((sPerKm * metersPerUnit) / 1000),
    /** Tempo z dystansu i czasu; null, gdy nie ma z czego policzyć. */
    paceOf: (distanceM: number | null, durationS: number | null) =>
      distanceM && durationS ? formatPace(Math.round(durationS / (distanceM / metersPerUnit))) : null,
    /** Stopnie w skali biegacza (°C albo °F), zaokrąglone. */
    temp: (c: number) => Math.round(imperial ? (c * 9) / 5 + 32 : c),
    /** Wiatr w km/h albo mph, zaokrąglony. */
    speed: (kmh: number) => Math.round(imperial ? (kmh * 1000) / METERS_PER_MILE : kmh),
    speedUnit: imperial ? 'mph' : 'km/h',
  };
}

export type UnitFormat = ReturnType<typeof unitFormat>;

/** Formatowanie dystansu, tempa, temperatury i wiatru w jednostkach wybranych w Profilu. */
export function useUnitFormat(): UnitFormat {
  const units = useUnits();
  const locale = useLocale();
  return useMemo(() => unitFormat(units, locale), [units, locale]);
}
