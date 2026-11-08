-- Ankieta: użytkownik wybiera, od kiedy zaczyna plan. Data należy do celu –
-- backend generuje plan (public.plans.starts_on) od tego dnia.

alter table public.goals
  add column plan_starts_on date;

alter table public.goals
  add constraint plan_starts_before_race
    check (race_date is null or plan_starts_on is null or plan_starts_on < race_date) not valid;

-- Nowy parametr zmienia sygnaturę funkcji – usuwamy starą wersję, żeby nie było dwóch.
drop function if exists public.complete_onboarding(
  text, text, integer, date, integer, text, integer, integer, smallint,
  smallint[], smallint, smallint, smallint, boolean, boolean, text, text
);

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
  p_timezone               text
)
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

  update public.goals set status = 'abandoned'
  where user_id = uid and status = 'active';

  insert into public.goals (user_id, type, general_focus, distance_m, race_date, target_time_s, plan_starts_on)
  values (
    uid,
    p_goal_type,
    case when p_goal_type = 'general' then p_general_focus end,
    case when p_goal_type = 'race' then p_distance_m end,
    case when p_goal_type = 'race' then p_race_date end,
    case when p_goal_type = 'race' then p_target_time_s end,
    p_plan_starts_on
  );

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
  smallint[], smallint, smallint, smallint, boolean, boolean, text, text
) from public, anon;
grant execute on function public.complete_onboarding(
  text, text, integer, date, integer, date, text, integer, integer, smallint,
  smallint[], smallint, smallint, smallint, boolean, boolean, text, text
) to authenticated;
