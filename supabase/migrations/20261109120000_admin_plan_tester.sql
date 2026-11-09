-- Panel: logowanie admina i tester generowania planów (apps/admin, /tester).
--
-- Schemat ops nie jest wystawiony w API Supabase, więc panel korzysta z cienkich funkcji w public:
--   * public.is_admin()              – zalogowany użytkownik sprawdza, czy jest adminem (po logowaniu),
--   * public.admin_save_plan_week()  – zapis / podmiana jednego tygodnia planu (tylko service_role),
--   * public.admin_delete_plan_week()– usunięcie tygodnia (tylko service_role),
--   * public.admin_log()             – wpis do ops.admin_audit_log (tylko service_role).
-- Każda zmiana planu z panelu trafia do logu działań administratora.

-- ───────────────────────── admin ─────────────────────────

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select ops.is_admin((select auth.uid()));
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

create or replace function public.admin_log(
  p_admin_id    uuid,
  p_action      text,
  p_target_type text,
  p_target_id   text,
  p_details     jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into ops.admin_audit_log (admin_id, action, target_type, target_id, details)
  values (p_admin_id, p_action, p_target_type, p_target_id, coalesce(p_details, '{}'::jsonb));
$$;

revoke execute on function public.admin_log(uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.admin_log(uuid, text, text, text, jsonb) to service_role;

-- ───────────────────────── tester planów ─────────────────────────

-- Koniec planu = niedziela ostatniego tygodnia (tydzień 0 może zaczynać się w środku tygodnia).
create or replace function public.recompute_plan_ends_on(p_plan_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.plans p
  set ends_on = coalesce(
    (select max(w.starts_on + (7 - extract(isodow from w.starts_on))::int)
     from public.weeks w where w.plan_id = p.id),
    p.starts_on
  )
  where p.id = p_plan_id;
$$;

revoke execute on function public.recompute_plan_ends_on(uuid) from public, anon, authenticated;
grant execute on function public.recompute_plan_ends_on(uuid) to service_role;

-- Zapisuje jeden tydzień (PlannedWeek z packages/plan-engine) do aktywnego planu użytkownika.
-- Brak aktywnego planu → zakłada nowy od p_plan_starts_on. Tydzień o tym samym numerze jest
-- podmieniany razem z treningami (check-iny zostają, tracą powiązanie z treningiem).
--
-- p_week: { weekIndex, startsOn, focus,
--           sessions: [{ scheduledOn, type, durationMin, distanceM, intensity, structure }] }
create or replace function public.admin_save_plan_week(
  p_admin_id        uuid,
  p_user_id         uuid,
  p_goal_id         uuid,
  p_plan_starts_on  date,
  p_engine_version  text,
  p_week            jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan_id   uuid;
  v_week_id   uuid;
  v_index     smallint := (p_week ->> 'weekIndex')::smallint;
  v_replaced  integer := 0;
  s jsonb;
begin
  select id into v_plan_id from public.plans
  where user_id = p_user_id and status = 'active';

  if v_plan_id is null then
    insert into public.plans (user_id, goal_id, starts_on, ends_on, engine_version)
    values (p_user_id, p_goal_id, p_plan_starts_on, p_plan_starts_on, p_engine_version)
    returning id into v_plan_id;
  else
    update public.plans set engine_version = p_engine_version where id = v_plan_id;
  end if;

  delete from public.weeks where plan_id = v_plan_id and week_index = v_index;
  get diagnostics v_replaced = row_count;

  insert into public.weeks (plan_id, user_id, week_index, starts_on, focus)
  values (v_plan_id, p_user_id, v_index, (p_week ->> 'startsOn')::date, p_week ->> 'focus')
  returning id into v_week_id;

  for s in select * from jsonb_array_elements(coalesce(p_week -> 'sessions', '[]'::jsonb)) loop
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

  perform public.recompute_plan_ends_on(v_plan_id);

  insert into ops.admin_audit_log (admin_id, action, target_type, target_id, details)
  values (
    p_admin_id, 'tester_generate_week', 'user', p_user_id::text,
    jsonb_build_object(
      'plan_id', v_plan_id, 'week_index', v_index, 'replaced', v_replaced > 0,
      'sessions', jsonb_array_length(coalesce(p_week -> 'sessions', '[]'::jsonb)),
      'engine_version', p_engine_version
    )
  );

  return v_week_id;
end;
$$;

revoke execute on function public.admin_save_plan_week(uuid, uuid, uuid, date, text, jsonb) from public, anon, authenticated;
grant execute on function public.admin_save_plan_week(uuid, uuid, uuid, date, text, jsonb) to service_role;

-- Usuwa tydzień (z treningami) z planu użytkownika. Plan zostaje, nawet pusty.
create or replace function public.admin_delete_plan_week(p_admin_id uuid, p_user_id uuid, p_week_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan_id  uuid;
  v_index    smallint;
  v_sessions integer;
begin
  select w.plan_id, w.week_index into v_plan_id, v_index
  from public.weeks w where w.id = p_week_id and w.user_id = p_user_id;

  if v_plan_id is null then
    raise exception 'week not found' using errcode = 'P0002';
  end if;

  select count(*) into v_sessions from public.sessions where week_id = p_week_id;
  delete from public.weeks where id = p_week_id;
  perform public.recompute_plan_ends_on(v_plan_id);

  insert into ops.admin_audit_log (admin_id, action, target_type, target_id, details)
  values (
    p_admin_id, 'tester_delete_week', 'user', p_user_id::text,
    jsonb_build_object('plan_id', v_plan_id, 'week_index', v_index, 'sessions', v_sessions)
  );
end;
$$;

revoke execute on function public.admin_delete_plan_week(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_plan_week(uuid, uuid, uuid) to service_role;
