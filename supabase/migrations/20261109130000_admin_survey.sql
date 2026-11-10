-- Panel / tester: szybka edycja ankiety użytkownika i ankiety kont testowych.
--
-- W odróżnieniu od complete_onboarding (wołanej przez użytkownika, zakłada nowy cel):
--   * aktywny cel jest edytowany w miejscu – plan dalej wskazuje ten sam goal_id,
--   * ankieta zostaje oznaczona jako ukończona (pierwsza data ukończenia się nie zmienia),
--   * zgód nie dotyka,
--   * zmiana trafia do ops.admin_audit_log.
--
-- p_survey:
--   { displayName?, goalType: 'general'|'race', generalFocus?, distanceM?, raceDate?, targetTimeS?,
--     planStartsOn?, level, recentDistanceM?, recentTimeS?, currentRunsPerWeek?,
--     preferredDays: int[], sessionsPerWeek, maxMinutesWeekday?, maxMinutesWeekend?,
--     hasContraindications, timezone? }
create or replace function public.admin_save_survey(p_admin_id uuid, p_user_id uuid, p_survey jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_goal_id  uuid;
  v_race     boolean := p_survey ->> 'goalType' = 'race';
  v_days     smallint[];
begin
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'user not found' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(d::smallint order by d::smallint), '{}')
  into v_days
  from (select distinct jsonb_array_elements_text(coalesce(p_survey -> 'preferredDays', '[]'::jsonb)) as d) days;

  select id into v_goal_id from public.goals where user_id = p_user_id and status = 'active';

  if v_goal_id is null then
    insert into public.goals
      (user_id, type, general_focus, distance_m, race_date, target_time_s, plan_starts_on)
    values (
      p_user_id,
      p_survey ->> 'goalType',
      case when v_race then null else p_survey ->> 'generalFocus' end,
      case when v_race then (p_survey ->> 'distanceM')::integer end,
      case when v_race then (p_survey ->> 'raceDate')::date end,
      case when v_race then (p_survey ->> 'targetTimeS')::integer end,
      (p_survey ->> 'planStartsOn')::date
    )
    returning id into v_goal_id;
  else
    update public.goals set
      type           = p_survey ->> 'goalType',
      general_focus  = case when v_race then null else p_survey ->> 'generalFocus' end,
      distance_m     = case when v_race then (p_survey ->> 'distanceM')::integer end,
      race_date      = case when v_race then (p_survey ->> 'raceDate')::date end,
      target_time_s  = case when v_race then (p_survey ->> 'targetTimeS')::integer end,
      plan_starts_on = (p_survey ->> 'planStartsOn')::date
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
