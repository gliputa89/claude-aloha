"use client";

import { useState } from "react";
import type { Content, WorkoutKind } from "@/lib/content";

const kindColor: Record<WorkoutKind, string> = {
  easy: "bg-workout-easy",
  long: "bg-workout-long",
  intervals: "bg-workout-intervals",
  rest: "bg-workout-rest",
};

/** Tydzień planu: słupek = długość treningu, kolor = typ. Wybrany dzień pokazuje szczegóły. */
export function WeekStrip({ week }: { week: Content["week"] }) {
  const [selected, setSelected] = useState(3);
  const day = week.days[selected];
  const longest = Math.max(...week.days.map((d) => d.minutes));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-10">
      <div>
        <div role="tablist" aria-label={week.hint} className="grid grid-cols-7 gap-1.5 sm:gap-3">
          {week.days.map((d, index) => {
            const active = index === selected;
            return (
              <button
                key={d.short}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls="week-panel"
                aria-label={`${d.name}: ${d.title}`}
                onClick={() => setSelected(index)}
                className={`group flex h-64 flex-col justify-end rounded-card p-1.5 text-left transition-colors duration-150 sm:h-80 sm:p-2.5 ${
                  active ? "bg-surface shadow-[0_1px_0_var(--color-border-strong)]" : "hover:bg-surface/60"
                }`}
              >
                <span
                  className={`w-full rounded-md ${kindColor[d.kind]} ${
                    active ? "" : "opacity-55 group-hover:opacity-80"
                  } transition-opacity duration-150`}
                  style={{ height: d.minutes ? `${18 + (d.minutes / longest) * 62}%` : "6px" }}
                />
                <span
                  className={`mt-3 block text-sm font-bold sm:text-base ${
                    active ? "text-text" : "text-text-muted"
                  }`}
                >
                  {d.short}
                </span>
                <span className="block h-4 text-xs text-text-muted tabular-nums">
                  {d.minutes ? `${d.minutes}′` : ""}
                </span>
              </button>
            );
          })}
        </div>
        <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-text-muted">
          {(Object.keys(week.legend) as WorkoutKind[]).map((kind) => (
            <li key={kind} className="flex items-center gap-2">
              <span className={`size-2.5 rounded-pill ${kindColor[kind]}`} />
              {week.legend[kind]}
            </li>
          ))}
        </ul>
      </div>

      <div
        id="week-panel"
        role="tabpanel"
        aria-live="polite"
        className="rounded-card bg-surface p-6 sm:p-8"
      >
        <p className="text-sm font-semibold text-text-muted">{day.name}</p>
        <h3 className="mt-1 flex items-center gap-3 text-3xl font-extrabold tracking-tight">
          <span className={`size-3.5 shrink-0 rounded-pill ${kindColor[day.kind]}`} />
          {day.title}
        </h3>
        <p className="mt-1 text-text-muted">{day.meta}</p>

        {day.steps.length > 0 && (
          <ol className="mt-6 space-y-2.5 border-l-2 border-border pl-4">
            {day.steps.map((step) => (
              <li key={step} className="leading-snug">
                {step}
              </li>
            ))}
          </ol>
        )}

        <dl className="mt-6 space-y-4">
          {day.weather && (
            <div>
              <dt className="text-sm font-semibold text-text-brand">{week.weatherLabel}</dt>
              <dd className="mt-0.5 leading-snug">{day.weather}</dd>
            </div>
          )}
          <div className="rounded-md bg-surface-accent-soft p-4 text-text-on-accent">
            <dt className="text-sm font-semibold">{week.coachLabel}</dt>
            <dd className="mt-0.5 leading-snug">{day.coach}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
