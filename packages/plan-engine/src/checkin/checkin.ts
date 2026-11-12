// Check-in „Jak się dziś czujesz?” → łagodna propozycja zmiany dzisiejszego treningu. Czyste reguły, bez AI:
// check-in to jedno tapnięcie na karcie „Dzisiaj”, a nie rozmowa – do rozmowy jest czat z trenerem.
//
//   * 3–5 bez podpowiedzi → nic nie proponujemy (trening wg planu),
//   * 1–2 → lżejsza wersja: mocna jednostka (interwały, tempo) staje się spokojnym biegiem, spokojna – krótszym,
//   * „mało czasu” → trening skrócony do bezpiecznego minimum (ok. 25 min), przy każdej ocenie,
//   * „mało snu” → traktujemy jak ocenę o jeden niższą,
//   * „coś boli” → reguły niczego nie proponują; aplikacja kieruje do czatu z trenerem.
//
// Propozycja ma kształt zmiany z czatu (ChatChange), więc sprawdza ją i wykonuje ten sam kod (chat/chat.ts).
// Zawodów nie ruszamy nigdy.

import type { ChatChange } from '../chat/chat.ts';
import { round5 } from '../plan/plan.ts';

export const CHECKIN_TAGS = ['little_time', 'little_sleep', 'pain'] as const;
export type CheckInTag = (typeof CHECKIN_TAGS)[number];

export const CHECKIN_RULES = {
  /** Od tej oceny w dół proponujemy lżejszą wersję. */
  lowWellbeing: 2,
  /** „Mało czasu” bez podanych minut: tyle zostaje z treningu. */
  littleTimeMin: 25,
  /** Ocena 2: spokojny bieg krótszy o tyle; mocna jednostka zamieniona na spokojny bieg tej długości. */
  easierFactor: 0.75,
  /** Ocena 1: połowa spokojnego biegu; zamiast mocnej jednostki najwyżej tyle minut spokojnie. */
  easiestFactor: 0.5,
  easiestQualityMin: 30,
} as const;

/** Co się zmienia – do zbudowania zdania na karcie propozycji po stronie aplikacji. */
export type CheckInReason = 'easier' | 'shorter' | 'little_time';

export type CheckInProposal = {
  change: ChatChange;
  reason: CheckInReason;
  /** Skala zmian z PROJECT.md 4.5: 1 – drobna korekta, 2 – wyraźnie lżejszy trening. */
  level: 1 | 2;
};

export type CheckInSession = { date: string; type: string; durationMin: number | null };

const isQuality = (type: string) => type === 'intervals' || type === 'tempo';

/**
 * Propozycja po check-inie albo `null`, gdy trening zostaje bez zmian. `minSessionMin` – najkrótszy trening
 * dla poziomu biegacza (poniżej niego nie skracamy).
 */
export function proposeFromCheckIn(input: {
  session: CheckInSession;
  wellbeing: number;
  tags: readonly string[];
  minSessionMin: number;
}): CheckInProposal | null {
  const R = CHECKIN_RULES;
  const { session, tags } = input;
  const duration = session.durationMin;
  if (session.type === 'race' || session.type === 'rest' || !duration || duration <= 0) return null;
  if (tags.includes('pain')) return null;

  const wellbeing = tags.includes('little_sleep') ? Math.max(1, input.wellbeing - 1) : input.wellbeing;
  const low = wellbeing <= R.lowWellbeing;
  const floor = Math.max(input.minSessionMin, 10);
  const clamp = (minutes: number) => Math.max(floor, round5(minutes));

  let type = session.type;
  let target = duration;
  let reason: CheckInReason | null = null;

  if (low) {
    if (isQuality(session.type)) {
      // Słabszy dzień to nie dzień na mocne odcinki – zostaje sam ruch.
      type = 'easy';
      target = wellbeing <= 1 ? Math.min(duration * R.easiestFactor, R.easiestQualityMin) : duration * R.easierFactor;
      reason = 'easier';
    } else {
      target = duration * (wellbeing <= 1 ? R.easiestFactor : R.easierFactor);
      reason = 'shorter';
    }
  }
  if (tags.includes('little_time') && target > R.littleTimeMin) {
    target = R.littleTimeMin;
    // Przy słabszym dniu i mocnej jednostce ważniejsze jest „lżej” niż „krócej”.
    if (reason !== 'easier') reason = 'little_time';
  }
  if (!reason) return null;

  const durationMin = clamp(target);
  if (type === session.type && durationMin >= duration) return null;
  return {
    change: {
      op: type === session.type ? 'set_duration' : 'set_type',
      date: session.date,
      toDate: null,
      type: type === session.type ? null : 'easy',
      durationMin,
      summary: reason,
    },
    reason,
    level: wellbeing <= 1 || type !== session.type ? 2 : 1,
  };
}
