import type { Content, GoalItem, GoalKind } from "@/lib/content";

/** Ikony celów – te same znaczenia co w aplikacji (Phosphor: Flag, Timer, PersonSimpleRun, CalendarCheck, ChartLineUp). */
const iconPaths: Record<GoalKind | "achieved", string> = {
  race: "M5 21V4m0 0h12l-2.5 4L17 12H5",
  performance: "M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm0-12v4l2.5 2.5M9.5 2.5h5",
  continuous: "M14.5 5.5a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5ZM6 21l3.5-6.5 3 2.5V21m-3-6.5 1.5-6 3.5 3.5H19M6.5 11l3-3h4",
  consistency: "M4 6h16v15H4zM4 10.5h16M8.5 3v4.5m7-4.5v4.5M9 15.5l2 2 4-4",
  volume: "M3 20.5h18M4.5 16l5-5 4 3.5L20 8m-5 0h5v5",
  achieved: "M8 4h8v5.5a4 4 0 0 1-8 0V4Zm0 2H4.5a3.5 3.5 0 0 0 3.8 4.4M16 6h3.5a3.5 3.5 0 0 1-3.8 4.4M12 13.5V17m-4 4h8m-6-4h4",
};

export function GoalIcon({ kind, className = "size-6" }: { kind: GoalKind | "achieved"; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={iconPaths[kind]} />
    </svg>
  );
}

/** Przykładowa zakładka „Cele” – układ jak w aplikacji: cel prowadzący, cele obok, osiągnięte. */
export function GoalsBoard({ board }: { board: Content["goals"]["board"] }) {
  const { lead } = board;
  return (
    <figure aria-label={board.alt} className="rounded-card bg-background p-4 shadow-[0_1px_0_var(--color-border-strong)] sm:p-6">
      <div className="flex items-center justify-between">
        <p className="text-3xl font-extrabold tracking-tight">{board.title}</p>
        <span title={board.add} className="grid size-11 place-items-center rounded-pill bg-surface-brand text-white">
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
      </div>

      <div className="mt-5 rounded-card bg-surface-brand p-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <p className="pt-1 text-xs font-bold tracking-wider text-white/85 uppercase">{lead.label}</p>
          <span className="shrink-0 rounded-pill bg-accent px-3 py-1 text-sm font-bold whitespace-nowrap text-text-on-accent">
            {lead.badge}
          </span>
        </div>
        <p className="mt-2 text-3xl font-extrabold tracking-tight">{lead.title}</p>
        <p className="mt-0.5 text-white/80">{lead.meta}</p>
        <div className="mt-4 h-2 overflow-hidden rounded-pill bg-deep/40">
          <div className="h-full rounded-pill bg-accent" style={{ width: `${Math.round(lead.progress * 100)}%` }} />
        </div>
        <p className="mt-3 text-sm font-semibold">{lead.week}</p>
        <dl className="mt-4 grid grid-cols-2 gap-2.5">
          {lead.tiles.map(([label, value]) => (
            <div key={label} className="rounded-md bg-white/10 px-3 py-2.5">
              <dt className="text-xs text-white/75">{label}</dt>
              <dd className="mt-0.5 text-xl font-extrabold tracking-tight tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <p className="mt-6 text-sm font-semibold text-text-muted">{board.alsoTitle}</p>
      <ul className="mt-2.5 space-y-2.5">
        {board.also.map((goal) => (
          <GoalRow key={goal.title + goal.line} goal={goal} />
        ))}
      </ul>

      <p className="mt-6 text-sm font-semibold text-text-muted">{board.achievedTitle}</p>
      <ul className="mt-2.5 space-y-2.5">
        {board.achieved.map((goal) => (
          <GoalRow key={goal.title} goal={goal} achieved />
        ))}
      </ul>
    </figure>
  );
}

function GoalRow({ goal, achieved = false }: { goal: GoalItem; achieved?: boolean }) {
  return (
    <li className="flex items-center gap-3.5 rounded-card border border-border bg-surface p-3.5">
      <span
        className={`grid size-11 shrink-0 place-items-center rounded-md ${
          achieved ? "bg-surface-accent-soft text-text-accent-strong" : "bg-surface-brand-soft text-text-brand"
        }`}
      >
        <GoalIcon kind={achieved ? "achieved" : goal.kind} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold tracking-tight">{goal.title}</p>
        {goal.weeks && (
          <span className="mt-1.5 flex gap-1" aria-hidden="true">
            {Array.from({ length: goal.weeks[1] }, (_, index) => (
              <span
                key={index}
                className={`h-1.5 flex-1 rounded-pill ${index < goal.weeks![0] ? "bg-accent" : "bg-border"}`}
              />
            ))}
          </span>
        )}
        <p className="mt-1 text-sm text-text-muted">{goal.line}</p>
      </div>
      {goal.badge && (
        <span className="grid size-8 shrink-0 place-items-center rounded-pill bg-surface-accent-soft text-sm font-extrabold text-text-accent-strong">
          {goal.badge}
        </span>
      )}
    </li>
  );
}
