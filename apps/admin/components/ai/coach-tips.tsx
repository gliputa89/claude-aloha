import { coachTipsFor, type AiTip, type PlannedWeek } from '@aloha/plan-engine';

import { formatShortDate, isoWeekdayOf, SESSION_COLOR, SESSION_LABEL, weekdayShort } from '@/lib/format';

/**
 * Rady trenera z odpowiedzi modelu, przy treningach tygodnia po AI. Rada do dnia bez treningu
 * (np. po przeniesieniu) nie trafi do aplikacji – pokazujemy ją osobno jako pominiętą.
 */
export function CoachTipList({ weeks, tips }: { weeks: PlannedWeek[]; tips: AiTip[] }) {
  if (!tips.length) {
    return <p className="text-sm text-text-muted">Model nie dał rad – aplikacja pokaże rady z bazy.</p>;
  }
  const kept = coachTipsFor(weeks, tips);
  const sessions = weeks.flatMap((w) => w.sessions);
  const dropped = tips.filter((t) => kept[t.date] !== t.text);
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col divide-y divide-border rounded-card border border-border">
        {sessions.map((s) => (
          <li key={s.scheduledOn} className="grid grid-cols-[3.5rem_7rem_1fr] items-baseline gap-3 px-3 py-2 text-sm">
            <span className="text-text-muted">
              <span className="font-semibold text-text">{weekdayShort(isoWeekdayOf(s.scheduledOn))}</span>{' '}
              {formatShortDate(s.scheduledOn)}
            </span>
            <span className="flex items-center gap-2">
              <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${SESSION_COLOR[s.type] ?? 'bg-workout-rest'}`} />
              <span className="font-medium">{SESSION_LABEL[s.type] ?? s.type}</span>
            </span>
            {kept[s.scheduledOn] ? (
              <span>{kept[s.scheduledOn]}</span>
            ) : (
              <span className="text-text-muted">brak rady – aplikacja weźmie radę z bazy</span>
            )}
          </li>
        ))}
      </ul>
      {dropped.length ? (
        <p className="text-xs text-text-muted">
          Pominięte (dzień bez treningu albo druga rada na ten sam dzień):{' '}
          {dropped.map((t) => `${formatShortDate(t.date)} – „${t.text}”`).join('; ')}
        </p>
      ) : null}
    </div>
  );
}

/** Rada zapisana przy treningu w planie (z AI); brak – aplikacja bierze radę z bazy. */
export function SessionCoachTip({ tip }: { tip: string | null }) {
  if (!tip) return null;
  return (
    <p className="pl-[4.25rem] text-sm text-text-muted">
      <span className="font-semibold text-text-brand">Rada trenera:</span> {tip}
    </p>
  );
}
