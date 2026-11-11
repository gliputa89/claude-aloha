// Notka trenera AI na dzień bez treningu (funkcja 'day-note') – ekran „Dzisiaj”, gdy w planie jest wolne
// albo nic nie ma. Model dostaje tylko kontekst treningowy: ostatni trening, następny, regularność.
// Wywołanie i log jak w review-note.ts; brak notki = aplikacja pokazuje tekst ze słownika.

import type { ReviewVerdict } from '../review/review.ts';

/** Prompt prosi o 200 znaków, ale model bywa rozwlekły – odrzucamy dopiero powyżej limitu z bazy (400). */
export const DAY_NOTE_MAX_LENGTH = 400;

export type DayNoteContext = {
  locale: string;
  /** Dzień tygodnia, 1 = poniedziałek. */
  weekday: number;
  /** rest – dzień wolny zapisany w planie; none – na dziś nic nie ma w planie. */
  kind: 'rest' | 'none';
  /** Ostatni zrobiony trening (z oceną, jeśli jest). */
  lastWorkout: { type: string; daysAgo: number; verdict: ReviewVerdict | null } | null;
  /** Następny trening w planie. */
  next: { type: string; inDays: number } | null;
  /** Regularność: treningi z planu w ostatnich 14 dniach i ile z nich zrobione. */
  recent: { planned: number; done: number };
  /** Ostatnie notki na dni wolne (najnowsza pierwsza) – nie wolno ich powtarzać. */
  previousNotes: string[];
};

export const dayNoteUserMessage = (ctx: DayNoteContext) => JSON.stringify(ctx, null, 2);
