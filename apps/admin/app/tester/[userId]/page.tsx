import { planInputFromSurvey } from '@aloha/plan-engine';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { SurveyPanel } from '@/components/tester/survey-form';
import { DeleteTestUserButton, RegeneratePlanButton } from '@/components/tester/user-actions';
import { GenerateWeekForm, WeekActions } from '@/components/tester/week-controls';
import { requireAdmin } from '@/lib/auth';
import {
  describeStructure,
  formatDate,
  formatDistance,
  formatDuration,
  formatShortDate,
  FOCUS_LABEL,
  INTENSITY_LABEL,
  isoWeekdayOf,
  LEVEL_LABEL,
  SESSION_COLOR,
  SESSION_LABEL,
  STATUS_LABEL,
  weekdayShort,
  WEEK_FOCUS_LABEL,
} from '@/lib/format';
import { loadTesterUser, todayIn, type TesterUser, type TesterWeek } from '@/lib/plan-tester';
import { createServiceClient } from '@/lib/supabase/server';
import { surveyValuesFromRows } from '@/lib/survey';

export default function TesterUserPage({ params }: PageProps<'/tester/[userId]'>) {
  return (
    <Suspense fallback={<p className="text-text-muted">Wczytuję…</p>}>
      <UserDetail params={params} />
    </Suspense>
  );
}

async function UserDetail({ params }: Pick<PageProps<'/tester/[userId]'>, 'params'>) {
  const admin = await requireAdmin();
  const { userId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(userId)) notFound();
  const user = await loadTesterUser(userId);
  if (!user) notFound();

  // Wgląd w ankietę (w tym flagę przeciwwskazań) zostawia ślad w logu admina.
  await createServiceClient().rpc('admin_log', {
    p_admin_id: admin.id,
    p_action: 'tester_view_user',
    p_target_type: 'user',
    p_target_id: userId,
  });

  const nextIndex = user.plan?.weeks.length ? Math.max(...user.plan.weeks.map((w) => w.week_index)) + 1 : 0;
  const canGenerate = !!(user.profile?.onboarding_completed_at && user.profile.level && user.goal && user.availability);
  const today = todayIn(user.profile?.timezone ?? 'Europe/Warsaw');

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 font-display text-2xl font-semibold tracking-tight">
            {user.profile?.display_name || user.email || 'Użytkownik'}
            {user.isTest ? (
              <span className="rounded-pill bg-surface-accent-soft px-2 py-0.5 text-xs font-semibold text-text-accent-strong">
                TEST
              </span>
            ) : null}
          </h1>
          {user.isTest ? <DeleteTestUserButton userId={user.id} /> : null}
        </div>
        <p className="flex flex-wrap gap-x-3 text-sm text-text-muted">
          {user.email ? <span>{user.email}</span> : null}
          <span>konto od {formatDate(user.createdAt)}</span>
          <span>dziś u niego: {formatDate(today)}</span>
          <code className="text-xs">{user.id}</code>
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <SurveyPanel
          userId={user.id}
          initial={surveyValuesFromRows(
            { displayName: user.profile?.display_name ?? null, profile: user.profile, goal: user.goal, availability: user.availability },
            today,
          )}
        >
          <SurveyCard user={user} />
        </SurveyPanel>
        <EngineInputCard user={user} />
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-xl font-semibold">Plan</h2>
            {user.plan ? (
              <p className="text-sm text-text-muted">
                start {formatDate(user.plan.starts_on)} · koniec {formatDate(user.plan.ends_on)} · silnik{' '}
                {user.plan.engine_version ?? '–'} · {user.plan.weeks.length} tyg.
              </p>
            ) : (
              <p className="text-sm text-text-muted">Brak aktywnego planu – pierwszy wygenerowany tydzień go założy.</p>
            )}
          </div>
          {canGenerate ? (
            <div className="flex flex-col items-end gap-2">
              <GenerateWeekForm userId={user.id} defaultWeek={nextIndex + 1} />
              <RegeneratePlanButton userId={user.id} hasPlan={!!user.plan} />
            </div>
          ) : (
            <p className="rounded-md bg-surface-accent-soft px-3 py-2 text-sm text-text-accent-strong">
              Ankieta nieukończona – silnik nie ma danych.
            </p>
          )}
        </div>

        {user.plan?.weeks.length ? (
          <ol className="flex flex-col gap-3">
            {user.plan.weeks.map((week) => (
              <WeekCard key={week.week_index} userId={user.id} week={week} today={today} canGenerate={canGenerate} />
            ))}
          </ol>
        ) : null}
      </section>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-1.5 text-sm last:border-b-0">
      <dt className="text-text-muted">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

function SurveyCard({ user }: { user: TesterUser }) {
  const { profile, goal, availability } = user;
  return (
      <dl className="flex flex-col">
        <Row label="Ukończona">{profile?.onboarding_completed_at ? formatDate(profile.onboarding_completed_at) : 'nie'}</Row>
        <Row label="Cel">
          {!goal
            ? '–'
            : goal.type === 'race'
              ? `zawody: ${formatDistance(goal.distance_m)}, ${formatDate(goal.race_date)}`
              : (FOCUS_LABEL[goal.general_focus ?? ''] ?? 'ogólny')}
        </Row>
        {goal?.type === 'race' ? <Row label="Czas docelowy">{formatDuration(goal.target_time_s)}</Row> : null}
        <Row label="Start planu (ankieta)">{formatDate(goal?.plan_starts_on)}</Row>
        <Row label="Poziom">{profile?.level ? LEVEL_LABEL[profile.level] : '–'}</Row>
        <Row label="Ostatni wynik">
          {profile?.recent_result_distance_m
            ? `${formatDistance(profile.recent_result_distance_m)} w ${formatDuration(profile.recent_result_time_s)}`
            : '–'}
        </Row>
        <Row label="Biega obecnie">
          {profile?.current_runs_per_week != null ? `${profile.current_runs_per_week}× / tydz.` : '–'}
        </Row>
        <Row label="Dni">
          {availability?.preferred_days?.length
            ? [...availability.preferred_days].sort().map(weekdayShort).join(' ')
            : '–'}
        </Row>
        <Row label="Treningów w tygodniu">{availability?.sessions_per_week ?? '–'}</Row>
        <Row label="Limit: dzień roboczy / weekend">
          {availability
            ? `${availability.max_minutes_weekday ?? '–'} / ${availability.max_minutes_weekend ?? '–'} min`
            : '–'}
        </Row>
        <Row label="Przeciwwskazania">
          {profile?.has_contraindications == null ? '–' : profile.has_contraindications ? 'tak (tryb łagodny)' : 'nie'}
        </Row>
        <Row label="Strefa czasowa">{profile?.timezone ?? '–'}</Row>
      </dl>
  );
}

function EngineInputCard({ user }: { user: TesterUser }) {
  const { profile, goal, availability } = user;
  const input =
    profile?.level && goal && availability
      ? planInputFromSurvey({ profile: { ...profile, level: profile.level }, goal, availability }, user.plan?.starts_on ?? '(start z ankiety)')
      : null;
  return (
    <section className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5">
      <h2 className="font-semibold">Wejście silnika</h2>
      <p className="text-sm text-text-muted">
        Dokładnie to dostaje <code>generatePlanWeek</code> – z tych samych funkcji korzysta Edge Function{' '}
        <code>generate-plan</code>.
      </p>
      <pre className="overflow-x-auto rounded-md bg-background p-3 text-xs leading-relaxed">
        {input ? JSON.stringify(input, null, 2) : 'Brak danych – ankieta nieukończona.'}
      </pre>
    </section>
  );
}

function WeekCard({
  userId,
  week,
  today,
  canGenerate,
}: {
  userId: string;
  week: TesterWeek;
  today: string;
  canGenerate: boolean;
}) {
  const minutes = week.sessions.reduce((sum, s) => sum + (s.duration_min ?? 0), 0);
  const touched = week.sessions.filter((s) => s.status !== 'planned').length;
  const endsOn = week.sessions.at(-1)?.scheduled_on;
  const current = week.starts_on <= today && (!endsOn || today <= endsOn || week.sessions.length === 0);
  return (
    <li className={`flex flex-col gap-3 rounded-card border bg-surface p-4 ${current ? 'border-action' : 'border-border'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="font-semibold">Tydzień {week.week_index + 1}</h3>
          <span className="text-sm text-text-muted">od {formatDate(week.starts_on)}</span>
          <span className="rounded-pill bg-surface-brand-soft px-2 py-0.5 text-xs font-medium text-text-brand">
            {WEEK_FOCUS_LABEL[week.focus ?? ''] ?? week.focus ?? '–'}
          </span>
          <span className="text-sm text-text-muted">
            {week.sessions.length} tren. · {minutes} min
          </span>
          {touched ? <span className="text-xs text-text-accent-strong">{touched} z realizacją</span> : null}
        </div>
        <WeekActions
          userId={userId}
          weekId={week.id}
          weekIndex={week.week_index}
          touchedSessions={touched}
          canGenerate={canGenerate}
        />
      </div>
      {week.sessions.length ? (
        <ul className="flex flex-col divide-y divide-border">
          {week.sessions.map((s) => (
            <li key={s.id} className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 py-2 text-sm">
              <span className="text-text-muted">
                <span className="font-semibold text-text">{weekdayShort(isoWeekdayOf(s.scheduled_on))}</span>{' '}
                {formatShortDate(s.scheduled_on)}
              </span>
              <span className="flex min-w-0 items-center gap-2">
                <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${SESSION_COLOR[s.type] ?? 'bg-workout-rest'}`} />
                <span className="font-medium">{SESSION_LABEL[s.type] ?? s.type}</span>
                <span className="truncate text-text-muted">{describeStructure(s.structure)}</span>
              </span>
              <span className="flex items-center gap-3 text-right">
                {s.status !== 'planned' ? (
                  <span className="text-xs text-text-accent-strong">{STATUS_LABEL[s.status]}</span>
                ) : null}
                <span className="text-xs text-text-muted">{s.intensity ? INTENSITY_LABEL[s.intensity] : ''}</span>
                <span className="w-14 font-semibold">
                  {s.duration_min ? `${s.duration_min} min` : formatDistance(s.distance_m)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-text-muted">Brak treningów w tym tygodniu (np. niepełny tydzień bez wolnych dni).</p>
      )}
    </li>
  );
}
