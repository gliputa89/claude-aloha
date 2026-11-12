-- Zakładka „Cele”: wiele celów naraz, jeden prowadzi plan.
--
--   * kind – rodzaj celu: race (zawody), performance (wynik na dystansie), continuous (bez zatrzymania),
--            consistency (regularność: N treningów w tygodniu przez okres), volume (kilometry w okresie),
--   * role – primary (prowadzi plan, dokładnie jeden aktywny) albo secondary (śledzony obok, najwyżej 3),
--   * priority – tylko zawody: A (prowadzą plan), B (start kontrolny – plan robi z niego mocny trening), C (dla zabawy).
--
-- Kolumny type / general_focus zostają: z nich silnik planu wie, jak układać tygodnie (zawody albo cel ogólny).
-- Wylicza je funkcja goal_from_spec z rodzaju celu, więc stare odczyty (Edge Functions, panel) działają dalej.

-- ───────────────────────── kolumny ─────────────────────────

alter table public.goals
  add column kind text check (kind in ('race', 'performance', 'continuous', 'consistency', 'volume')),
  add column role text not null default 'primary' check (role in ('primary', 'secondary')),
  add column priority text check (priority in ('A', 'B', 'C')),
  -- continuous: ile minut ciągłego biegu (gdy cel liczony czasem, nie dystansem)
  add column target_minutes smallint check (target_minutes between 1 and 600),
  -- consistency: ile treningów w tygodniu
  add column sessions_per_week smallint check (sessions_per_week between 1 and 7),
  -- volume: ile kilometrów w okresie
  add column volume_km integer check (volume_km between 1 and 20000),
  -- consistency / volume: okres celu (włącznie)
  add column period_start date,
  add column period_end date,
  -- performance: do kiedy (opcjonalnie) – w tym tygodniu plan wstawia sprawdzian
  add column due_on date,
  -- wynik po zakończeniu (zawody, wynik) i kiedy cel osiągnięto / zakończono
  add column result_time_s integer check (result_time_s > 0),
  add column finished_at timestamptz,
  add constraint goal_period_order check (period_end is null or period_start is null or period_end >= period_start);

comment on column public.goals.kind is 'Rodzaj celu: race, performance, continuous, consistency, volume.';
comment on column public.goals.role is 'primary – prowadzi plan (jeden aktywny); secondary – śledzony obok (najwyżej 3).';
comment on column public.goals.priority is 'Tylko zawody: A – prowadzą plan, B – start kontrolny, C – dla zabawy (plan bez zmian).';

-- Stare cele: rodzaj z typu i nastawienia. Ogólne cele bez liczb dostają rozsądne wartości z dostępności.
update public.goals g set
  kind = case
    when g.type = 'race' then 'race'
    when g.general_focus = 'start_running' then 'continuous'
    else 'consistency'
  end,
  priority = case when g.type = 'race' then 'A' end,
  target_minutes = case when g.type <> 'race' and g.general_focus = 'start_running' then 30 end,
  sessions_per_week = case
    when g.type <> 'race' and coalesce(g.general_focus, '') <> 'start_running'
      then coalesce((select a.sessions_per_week from public.availability a where a.user_id = g.user_id), 3)
  end,
  period_start = case
    when g.type <> 'race' and coalesce(g.general_focus, '') <> 'start_running'
      then coalesce(g.plan_starts_on, g.created_at::date)
  end,
  period_end = case
    when g.type <> 'race' and coalesce(g.general_focus, '') <> 'start_running'
      then coalesce(g.plan_starts_on, g.created_at::date) + 12 * 7 - 1
  end;

alter table public.goals alter column kind set not null;

-- Komplet pól dla każdego rodzaju (not valid – starsze wiersze mogły nie mieć wszystkiego).
alter table public.goals
  add constraint goal_race_fields check (kind <> 'race' or (distance_m is not null and race_date is not null)) not valid,
  add constraint goal_performance_fields check (kind <> 'performance' or (distance_m is not null and target_time_s is not null)) not valid,
  add constraint goal_continuous_fields check (kind <> 'continuous' or distance_m is not null or target_minutes is not null) not valid,
  add constraint goal_consistency_fields
    check (kind <> 'consistency' or (sessions_per_week is not null and period_start is not null and period_end is not null)) not valid,
  add constraint goal_volume_fields
    check (kind <> 'volume' or (volume_km is not null and period_start is not null and period_end is not null)) not valid;

-- Nowy stan: „completed” – ukończony, ale bez docelowego wyniku (bez poczucia porażki, to nadal sukces).
alter table public.goals drop constraint if exists goals_status_check;
alter table public.goals
  add constraint goals_status_check check (status in ('active', 'achieved', 'completed', 'abandoned'));

-- Jeden aktywny cel prowadzący zamiast jednego aktywnego celu.
drop index if exists public.goals_one_active_idx;
create unique index goals_one_primary_idx on public.goals (user_id) where status = 'active' and role = 'primary';
create index goals_user_active_idx on public.goals (user_id) where status = 'active';

-- ───────────────────────── wspólne: cel ze specyfikacji ─────────────────────────

-- p_spec: { kind, name?, distanceM?, date?, targetTimeS?, targetMinutes?, sessionsPerWeek?, periodStart?, periodEnd?,
--           volumeKm?, priority?, focus? }
--   * date – dzień zawodów (race) albo „do kiedy” (performance),
--   * focus – nastawienie planu dla celu ogólnego (start_running / improve_fitness / run_regularly); brak → z rodzaju.
-- Wstawia cel zalogowanego użytkownika (RLS: tylko własne) i zwraca jego id.
create or replace function public.goal_from_spec(p_spec jsonb, p_role text, p_plan_starts_on date default null)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid    uuid := (select auth.uid());
  v_kind text := p_spec ->> 'kind';
  v_race boolean := v_kind = 'race';
  v_id   uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if v_kind is null or v_kind not in ('race', 'performance', 'continuous', 'consistency', 'volume') then
    raise exception 'invalid goal kind' using errcode = '22023';
  end if;
  if p_role not in ('primary', 'secondary') then
    raise exception 'invalid goal role' using errcode = '22023';
  end if;

  insert into public.goals (
    user_id, kind, role, priority, type, general_focus, distance_m, race_date, target_time_s, race_name,
    target_minutes, sessions_per_week, volume_km, period_start, period_end, due_on, plan_starts_on
  )
  values (
    uid,
    v_kind,
    p_role,
    case when v_race then case when p_role = 'primary' then 'A' else coalesce(nullif(p_spec ->> 'priority', 'A'), 'B') end end,
    case when v_race then 'race' else 'general' end,
    case when not v_race then coalesce(
      nullif(p_spec ->> 'focus', ''),
      case v_kind when 'continuous' then 'start_running' when 'performance' then 'improve_fitness' else 'run_regularly' end
    ) end,
    case when v_kind in ('race', 'performance', 'continuous') then (p_spec ->> 'distanceM')::integer end,
    case when v_race then (p_spec ->> 'date')::date end,
    case when v_kind in ('race', 'performance') then (p_spec ->> 'targetTimeS')::integer end,
    case when v_race then nullif(btrim(p_spec ->> 'name'), '') end,
    case when v_kind = 'continuous' then (p_spec ->> 'targetMinutes')::smallint end,
    case when v_kind = 'consistency' then (p_spec ->> 'sessionsPerWeek')::smallint end,
    case when v_kind = 'volume' then (p_spec ->> 'volumeKm')::integer end,
    case when v_kind in ('consistency', 'volume') then coalesce((p_spec ->> 'periodStart')::date, current_date) end,
    case when v_kind in ('consistency', 'volume') then (p_spec ->> 'periodEnd')::date end,
    case when v_kind = 'performance' then (p_spec ->> 'date')::date end,
    case when p_role = 'primary' then p_plan_starts_on end
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.goal_from_spec(jsonb, text, date) from public, anon;
grant execute on function public.goal_from_spec(jsonb, text, date) to authenticated;

-- Najwyżej 3 aktywne cele obok prowadzącego.
create or replace function public.goals_check_secondary_limit(p_user_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select count(*) from public.goals where user_id = p_user_id and status = 'active' and role = 'secondary') > 3 then
    raise exception 'too_many_goals' using errcode = 'P0001', hint = 'Najwyżej 3 cele obok celu prowadzącego.';
  end if;
end;
$$;

revoke execute on function public.goals_check_secondary_limit(uuid) from public, anon;
grant execute on function public.goals_check_secondary_limit(uuid) to authenticated;

-- ───────────────────────── ankieta startowa ─────────────────────────

drop function if exists public.complete_onboarding(
  text, text, integer, date, integer, date, text, integer, integer, smallint,
  smallint[], smallint, smallint, smallint, boolean, boolean, text, text, numeric, text
);

-- Jak poprzednio, plus p_goal (specyfikacja celu prowadzącego, patrz goal_from_spec) i p_secondary_goals (lista celów
-- obok, najwyżej 3). Bez p_goal cel prowadzący powstaje ze starych parametrów (p_goal_type, p_general_focus…).
create or replace function public.complete_onboarding(
  p_goal_type              text,
  p_general_focus          text,
  p_distance_m             integer,
  p_race_date              date,
  p_target_time_s          integer,
  p_plan_starts_on         date,
  p_level                  text,
  p_recent_distance_m      integer,
  p_recent_time_s          integer,
  p_current_runs_per_week  smallint,
  p_preferred_days         smallint[],
  p_sessions_per_week      smallint,
  p_max_minutes_weekday    smallint,
  p_max_minutes_weekend    smallint,
  p_has_contraindications  boolean,
  p_health_consent         boolean,
  p_consent_version        text,
  p_timezone               text,
  p_weekly_km              numeric default null,
  p_race_name              text default null,
  p_goal                   jsonb default null,
  p_secondary_goals        jsonb default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid  uuid := (select auth.uid());
  spec jsonb;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- Nowa ankieta = nowy zestaw celów.
  update public.goals set status = 'abandoned', finished_at = now()
  where user_id = uid and status = 'active';

  perform public.goal_from_spec(
    coalesce(
      p_goal,
      case when p_goal_type = 'race'
        then jsonb_build_object('kind', 'race', 'distanceM', p_distance_m, 'date', p_race_date, 'targetTimeS', p_target_time_s, 'name', p_race_name)
        else jsonb_build_object(
          'kind', case when p_general_focus = 'start_running' then 'continuous' else 'consistency' end,
          'focus', p_general_focus,
          'targetMinutes', case when p_general_focus = 'start_running' then 30 end,
          'sessionsPerWeek', p_sessions_per_week,
          'periodStart', p_plan_starts_on,
          'periodEnd', p_plan_starts_on + 12 * 7 - 1
        )
      end
    ),
    'primary',
    p_plan_starts_on
  );

  if p_secondary_goals is not null and jsonb_typeof(p_secondary_goals) = 'array' then
    for spec in select * from jsonb_array_elements(p_secondary_goals) limit 3 loop
      perform public.goal_from_spec(spec, 'secondary');
    end loop;
  end if;

  insert into public.availability
    (user_id, preferred_days, sessions_per_week, max_minutes_weekday, max_minutes_weekend)
  values
    (uid, p_preferred_days, p_sessions_per_week, p_max_minutes_weekday, p_max_minutes_weekend)
  on conflict (user_id) do update set
    preferred_days      = excluded.preferred_days,
    sessions_per_week   = excluded.sessions_per_week,
    max_minutes_weekday = excluded.max_minutes_weekday,
    max_minutes_weekend = excluded.max_minutes_weekend;

  update public.profiles set
    level                    = p_level,
    recent_result_distance_m = p_recent_distance_m,
    recent_result_time_s     = p_recent_time_s,
    current_runs_per_week    = p_current_runs_per_week,
    weekly_km                = p_weekly_km,
    has_contraindications    = p_has_contraindications,
    timezone                 = coalesce(nullif(p_timezone, ''), timezone),
    onboarding_completed_at  = now()
  where id = uid;

  -- Zgoda na dane zdrowotne: wyraźna, osobna. Zapisujemy tylko udzieloną (brak wpisu = brak zgody).
  if p_health_consent then
    insert into public.consents (user_id, kind, granted, version)
    values (uid, 'health_data', true, p_consent_version);
  end if;
end;
$$;

revoke execute on function public.complete_onboarding(
  text, text, integer, date, integer, date, text, integer, integer, smallint,
  smallint[], smallint, smallint, smallint, boolean, boolean, text, text, numeric, text, jsonb, jsonb
) from public, anon;
grant execute on function public.complete_onboarding(
  text, text, integer, date, integer, date, text, integer, integer, smallint,
  smallint[], smallint, smallint, smallint, boolean, boolean, text, text, numeric, text, jsonb, jsonb
) to authenticated;

-- ───────────────────────── zakładka „Cele” ─────────────────────────

-- Nowy cel. p_primary = true: nowy cel prowadzi plan, dotychczasowy prowadzący zostaje obok (zawody jako start B).
-- Po zmianie celu prowadzącego aplikacja układa plan od nowa (generate-plan) – od obecnej formy, nie od zera.
create or replace function public.add_goal(p_goal jsonb, p_primary boolean default false)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid  uuid := (select auth.uid());
  v_id uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_primary then
    update public.goals set
      role = 'secondary',
      priority = case when kind = 'race' then 'B' end
    where user_id = uid and status = 'active' and role = 'primary';
  end if;

  v_id := public.goal_from_spec(p_goal, case when p_primary then 'primary' else 'secondary' end, case when p_primary then current_date end);
  perform public.goals_check_secondary_limit(uid);
  return v_id;
end;
$$;

-- Cel obok staje się prowadzącym; dotychczasowy prowadzący zostaje obok.
create or replace function public.set_primary_goal(p_goal_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not exists (select 1 from public.goals where id = p_goal_id and user_id = uid and status = 'active') then
    raise exception 'goal not found' using errcode = 'P0002';
  end if;

  update public.goals set
    role = 'secondary',
    priority = case when kind = 'race' then 'B' end
  where user_id = uid and status = 'active' and role = 'primary' and id <> p_goal_id;

  update public.goals set
    role = 'primary',
    priority = case when kind = 'race' then 'A' end,
    plan_starts_on = current_date
  where id = p_goal_id;

  perform public.goals_check_secondary_limit(uid);
end;
$$;

-- Koniec celu: osiągnięty (achieved) albo ukończony bez docelowego wyniku (completed), z wynikiem (np. czas zawodów).
create or replace function public.finish_goal(p_goal_id uuid, p_achieved boolean, p_result_time_s integer default null)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  update public.goals set
    status = case when p_achieved then 'achieved' else 'completed' end,
    result_time_s = coalesce(p_result_time_s, result_time_s),
    finished_at = now()
  where id = p_goal_id and user_id = uid and status = 'active';
  if not found then
    raise exception 'goal not found' using errcode = 'P0002';
  end if;
end;
$$;

-- Usunięcie celu obok. Prowadzącego nie usuwamy – najpierw inny cel musi przejąć plan.
create or replace function public.remove_goal(p_goal_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  update public.goals set status = 'abandoned', finished_at = now()
  where id = p_goal_id and user_id = uid and status = 'active' and role = 'secondary';
  if not found then
    raise exception 'goal not found or primary' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.add_goal(jsonb, boolean) from public, anon;
revoke execute on function public.set_primary_goal(uuid) from public, anon;
revoke execute on function public.finish_goal(uuid, boolean, integer) from public, anon;
revoke execute on function public.remove_goal(uuid) from public, anon;
grant execute on function public.add_goal(jsonb, boolean) to authenticated;
grant execute on function public.set_primary_goal(uuid) to authenticated;
grant execute on function public.finish_goal(uuid, boolean, integer) to authenticated;
grant execute on function public.remove_goal(uuid) to authenticated;

-- ───────────────────────── panel: edycja ankiety ─────────────────────────

-- Jak w 20261109130000_admin_survey, ale edytuje cel PROWADZĄCY (aktywnych celów może być kilka)
-- i uzupełnia rodzaj celu.
create or replace function public.admin_save_survey(p_admin_id uuid, p_user_id uuid, p_survey jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_goal_id  uuid;
  v_race     boolean := p_survey ->> 'goalType' = 'race';
  v_focus    text := case when v_race then null else p_survey ->> 'generalFocus' end;
  v_kind     text := case when v_race then 'race' when p_survey ->> 'generalFocus' = 'start_running' then 'continuous' else 'consistency' end;
  v_start    date := coalesce((p_survey ->> 'planStartsOn')::date, current_date);
  v_days     smallint[];
begin
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'user not found' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(d::smallint order by d::smallint), '{}')
  into v_days
  from (select distinct jsonb_array_elements_text(coalesce(p_survey -> 'preferredDays', '[]'::jsonb)) as d) days;

  select id into v_goal_id from public.goals where user_id = p_user_id and status = 'active' and role = 'primary';

  if v_goal_id is null then
    insert into public.goals
      (user_id, kind, role, priority, type, general_focus, distance_m, race_date, target_time_s, plan_starts_on,
       target_minutes, sessions_per_week, period_start, period_end)
    values (
      p_user_id,
      v_kind,
      'primary',
      case when v_race then 'A' end,
      p_survey ->> 'goalType',
      v_focus,
      case when v_race then (p_survey ->> 'distanceM')::integer end,
      case when v_race then (p_survey ->> 'raceDate')::date end,
      case when v_race then (p_survey ->> 'targetTimeS')::integer end,
      (p_survey ->> 'planStartsOn')::date,
      case when v_kind = 'continuous' then 30 end,
      case when v_kind = 'consistency' then coalesce((p_survey ->> 'sessionsPerWeek')::smallint, 3) end,
      case when v_kind = 'consistency' then v_start end,
      case when v_kind = 'consistency' then v_start + 12 * 7 - 1 end
    )
    returning id into v_goal_id;
  else
    update public.goals set
      kind              = v_kind,
      priority          = case when v_race then 'A' end,
      type              = p_survey ->> 'goalType',
      general_focus     = v_focus,
      distance_m        = case when v_race then (p_survey ->> 'distanceM')::integer end,
      race_date         = case when v_race then (p_survey ->> 'raceDate')::date end,
      target_time_s     = case when v_race then (p_survey ->> 'targetTimeS')::integer end,
      plan_starts_on    = (p_survey ->> 'planStartsOn')::date,
      target_minutes    = case when v_kind = 'continuous' then coalesce(target_minutes, 30) end,
      sessions_per_week = case when v_kind = 'consistency' then coalesce((p_survey ->> 'sessionsPerWeek')::smallint, 3) end,
      period_start      = case when v_kind = 'consistency' then coalesce(period_start, v_start) end,
      period_end        = case when v_kind = 'consistency' then coalesce(period_end, v_start + 12 * 7 - 1) end
    where id = v_goal_id;
  end if;

  insert into public.availability
    (user_id, preferred_days, sessions_per_week, max_minutes_weekday, max_minutes_weekend)
  values (
    p_user_id,
    v_days,
    (p_survey ->> 'sessionsPerWeek')::smallint,
    (p_survey ->> 'maxMinutesWeekday')::smallint,
    (p_survey ->> 'maxMinutesWeekend')::smallint
  )
  on conflict (user_id) do update set
    preferred_days      = excluded.preferred_days,
    sessions_per_week   = excluded.sessions_per_week,
    max_minutes_weekday = excluded.max_minutes_weekday,
    max_minutes_weekend = excluded.max_minutes_weekend;

  update public.profiles set
    display_name             = coalesce(nullif(left(trim(p_survey ->> 'displayName'), 80), ''), display_name),
    level                    = p_survey ->> 'level',
    recent_result_distance_m = (p_survey ->> 'recentDistanceM')::integer,
    recent_result_time_s     = (p_survey ->> 'recentTimeS')::integer,
    current_runs_per_week    = (p_survey ->> 'currentRunsPerWeek')::smallint,
    has_contraindications    = (p_survey ->> 'hasContraindications')::boolean,
    timezone                 = coalesce(nullif(p_survey ->> 'timezone', ''), timezone),
    onboarding_completed_at  = coalesce(onboarding_completed_at, now())
  where id = p_user_id;

  insert into ops.admin_audit_log (admin_id, action, target_type, target_id, details)
  values (p_admin_id, 'tester_save_survey', 'user', p_user_id::text, jsonb_build_object('goal_id', v_goal_id));
end;
$$;

revoke execute on function public.admin_save_survey(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.admin_save_survey(uuid, uuid, jsonb) to service_role;
