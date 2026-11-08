-- Generowanie planu po ankiecie (Edge Function generate-plan + packages/plan-engine).

-- Marsz-bieg to osobny typ jednostki (docs/PROJECT.md 4.3).
alter table public.sessions drop constraint if exists sessions_type_check;
alter table public.sessions
  add constraint sessions_type_check
    check (type in ('walk_run', 'easy', 'long', 'intervals', 'tempo', 'recovery', 'race', 'rest'));

-- Zapis wygenerowanego planu w jednej transakcji: archiwizuje aktywny plan użytkownika,
-- zakłada nowy z tygodniami i treningami. Wywołuje tylko backend (service_role) –
-- użytkownik planu nie zapisuje (RLS: plany i tygodnie tylko do odczytu).
--
-- p_plan (z packages/plan-engine, GeneratedPlan):
--   { engineVersion, startsOn, endsOn,
--     weeks: [{ weekIndex, startsOn, focus,
--               sessions: [{ scheduledOn, type, durationMin, distanceM, intensity, structure }] }] }
create or replace function public.save_generated_plan(p_user_id uuid, p_goal_id uuid, p_plan jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan_id uuid;
  v_week_id uuid;
  w jsonb;
  s jsonb;
begin
  update public.plans set status = 'archived'
  where user_id = p_user_id and status = 'active';

  insert into public.plans (user_id, goal_id, starts_on, ends_on, engine_version)
  values (
    p_user_id,
    p_goal_id,
    (p_plan ->> 'startsOn')::date,
    (p_plan ->> 'endsOn')::date,
    p_plan ->> 'engineVersion'
  )
  returning id into v_plan_id;

  for w in select * from jsonb_array_elements(p_plan -> 'weeks') loop
    insert into public.weeks (plan_id, user_id, week_index, starts_on, focus)
    values (v_plan_id, p_user_id, (w ->> 'weekIndex')::smallint, (w ->> 'startsOn')::date, w ->> 'focus')
    returning id into v_week_id;

    for s in select * from jsonb_array_elements(w -> 'sessions') loop
      insert into public.sessions
        (week_id, user_id, scheduled_on, type, duration_min, distance_m, intensity, structure)
      values (
        v_week_id,
        p_user_id,
        (s ->> 'scheduledOn')::date,
        s ->> 'type',
        (s ->> 'durationMin')::smallint,
        (s ->> 'distanceM')::integer,
        s ->> 'intensity',
        coalesce(s -> 'structure', '{}'::jsonb)
      );
    end loop;
  end loop;

  return v_plan_id;
end;
$$;

revoke execute on function public.save_generated_plan(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_generated_plan(uuid, uuid, jsonb) to service_role;
