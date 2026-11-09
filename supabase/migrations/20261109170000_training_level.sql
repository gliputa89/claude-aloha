-- Poziom zaawansowania 1–5 zapisany w profilu + cotygodniowe generowanie kolejnego tygodnia
-- (packages/plan-engine: levels.ts, level-review.ts, generateNextWeek).
--
--   * profiles.training_level – poziom, którym liczy silnik. Ustawiany przy pierwszym planie z ankiety,
--     potem co tydzień przez przegląd poziomu (Edge Function generate-next-week) albo ręcznie w panelu.
--   * training_level_changes – historia zmian z powodem i liczbami (wgląd dla użytkownika i panelu).
--   * weeks.base_easy_min – baza objętości tygodnia (kolejny tydzień rośnie od niej, bez zaokrągleń).
--   * save_next_plan_week – dopisuje kolejny tydzień do aktywnego planu (idempotentnie).

-- ───────────────────────── profil ─────────────────────────

alter table public.profiles
  add column training_level         smallint check (training_level between 1 and 5),
  add column training_level_since   date,
  -- poziom wyliczony z ankiety przy ostatnim przeglądzie (zmiana = nowa ankieta lub wynik)
  add column training_level_survey  smallint check (training_level_survey between 1 and 5);

-- Poziom zmienia tylko backend – użytkownik nie może go ustawić sam (polityka „own profile: update”).
create or replace function public.profiles_guard_training_level()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.role()) = 'authenticated' and (
       new.training_level        is distinct from old.training_level
    or new.training_level_since  is distinct from old.training_level_since
    or new.training_level_survey is distinct from old.training_level_survey
  ) then
    raise exception 'Training level can only be changed by the backend'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_training_level
  before update on public.profiles
  for each row execute function public.profiles_guard_training_level();

-- ───────────────────────── historia zmian poziomu ─────────────────────────

create table public.training_level_changes (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  from_level   smallint check (from_level between 1 and 5),
  to_level     smallint not null check (to_level between 1 and 5),
  -- survey: pierwszy poziom z ankiety; review: przegląd co tydzień; admin: ręcznie w panelu
  source       text not null check (source in ('survey', 'review', 'admin')),
  -- kod reguły z level-review.ts (pain, break, low_completion, survey_up, survey_down, progress) albo 'initial' / 'manual'
  reason_code  text not null,
  reason       text not null check (char_length(reason) <= 500),
  stats        jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index training_level_changes_user_idx on public.training_level_changes (user_id, created_at desc);

alter table public.training_level_changes enable row level security;

create policy "own level changes: select" on public.training_level_changes
  for select to authenticated using (user_id = (select auth.uid()));

-- Zapis poziomu (service_role). Zmiana poziomu → nowy wiersz historii i nowa data „od kiedy”.
-- Bez zmiany aktualizuje tylko odczyt ankiety (training_level_survey). Zwraca true, gdy poziom się zmienił.
create or replace function public.set_training_level(
  p_user_id       uuid,
  p_level         smallint,
  p_source        text,
  p_reason_code   text,
  p_reason        text,
  p_stats         jsonb,
  p_survey_level  smallint,
  p_on            date
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old smallint;
begin
  select training_level into v_old from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'profile % not found', p_user_id;
  end if;

  if v_old is distinct from p_level then
    update public.profiles
    set training_level = p_level, training_level_since = p_on, training_level_survey = p_survey_level
    where id = p_user_id;

    insert into public.training_level_changes (user_id, from_level, to_level, source, reason_code, reason, stats)
    values (p_user_id, v_old, p_level, p_source, p_reason_code, p_reason, coalesce(p_stats, '{}'::jsonb));
    return true;
  end if;

  update public.profiles set training_level_survey = p_survey_level where id = p_user_id;
  return false;
end;
$$;

-- Ręczna zmiana poziomu w panelu (z wpisem w logu admina).
create or replace function public.admin_set_training_level(
  p_admin_id      uuid,
  p_user_id       uuid,
  p_level         smallint,
  p_reason        text,
  p_survey_level  smallint,
  p_on            date
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changed boolean;
begin
  v_changed := public.set_training_level(
    p_user_id, p_level, 'admin', 'manual', coalesce(nullif(trim(p_reason), ''), 'Ręczna zmiana w panelu'),
    '{}'::jsonb, p_survey_level, p_on
  );
  insert into ops.admin_audit_log (admin_id, action, target_type, target_id, details)
  values (p_admin_id, 'set_training_level', 'user', p_user_id::text,
          jsonb_build_object('level', p_level, 'changed', v_changed, 'reason', p_reason));
  return v_changed;
end;
$$;

-- ───────────────────────── tygodnie: baza objętości ─────────────────────────

alter table public.weeks
  add column base_easy_min numeric(6, 2) check (base_easy_min > 0);

-- Jak w 20261109150000_ai_layer.sql, plus weeks.base_easy_min (pole tygodnia baseEasyMin).
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
    insert into public.weeks (plan_id, user_id, week_index, starts_on, focus, source, ai_call_id, engine_config_version, base_easy_min)
    values (
      v_plan_id, p_user_id, (w ->> 'weekIndex')::smallint, (w ->> 'startsOn')::date, w ->> 'focus',
      coalesce(w ->> 'source', 'rules'), (w ->> 'aiCallId')::bigint, (w ->> 'engineConfigVersion')::integer,
      (w ->> 'baseEasyMin')::numeric
    )
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

-- Jak w 20261109150000_ai_layer.sql, plus weeks.base_easy_min.
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

  insert into public.weeks (plan_id, user_id, week_index, starts_on, focus, source, ai_call_id, engine_config_version, base_easy_min)
  values (
    v_plan_id, p_user_id, v_index, (p_week ->> 'startsOn')::date, p_week ->> 'focus',
    coalesce(p_week ->> 'source', 'rules'), (p_week ->> 'aiCallId')::bigint, (p_week ->> 'engineConfigVersion')::integer,
    (p_week ->> 'baseEasyMin')::numeric
  )
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
      'engine_version', p_engine_version,
      'source', coalesce(p_week ->> 'source', 'rules'),
      'ai_call_id', p_week ->> 'aiCallId'
    )
  );

  return v_week_id;
end;
$$;

-- Kolejny tydzień aktywnego planu (cotygodniowe generowanie). Idempotentnie: gdy tydzień o tym numerze
-- już jest – nic nie robi i zwraca null. Plan musi być aktywny i należeć do użytkownika.
create or replace function public.save_next_plan_week(p_user_id uuid, p_plan_id uuid, p_week jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_week_id uuid;
  v_index   smallint := (p_week ->> 'weekIndex')::smallint;
  s jsonb;
begin
  perform 1 from public.plans where id = p_plan_id and user_id = p_user_id and status = 'active' for update;
  if not found then
    raise exception 'active plan % not found for user %', p_plan_id, p_user_id;
  end if;
  if exists (select 1 from public.weeks where plan_id = p_plan_id and week_index = v_index) then
    return null;
  end if;

  insert into public.weeks (plan_id, user_id, week_index, starts_on, focus, source, ai_call_id, engine_config_version, base_easy_min)
  values (
    p_plan_id, p_user_id, v_index, (p_week ->> 'startsOn')::date, p_week ->> 'focus',
    coalesce(p_week ->> 'source', 'rules'), (p_week ->> 'aiCallId')::bigint, (p_week ->> 'engineConfigVersion')::integer,
    (p_week ->> 'baseEasyMin')::numeric
  )
  returning id into v_week_id;

  for s in select * from jsonb_array_elements(coalesce(p_week -> 'sessions', '[]'::jsonb)) loop
    insert into public.sessions
      (week_id, user_id, scheduled_on, type, duration_min, distance_m, intensity, structure)
    values (
      v_week_id, p_user_id, (s ->> 'scheduledOn')::date, s ->> 'type', (s ->> 'durationMin')::smallint,
      (s ->> 'distanceM')::integer, s ->> 'intensity', coalesce(s -> 'structure', '{}'::jsonb)
    );
  end loop;

  perform public.recompute_plan_ends_on(p_plan_id);
  return v_week_id;
end;
$$;

-- ───────────────────────── uprawnienia ─────────────────────────

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.set_training_level(uuid, smallint, text, text, text, jsonb, smallint, date)',
    'public.admin_set_training_level(uuid, uuid, smallint, text, smallint, date)',
    'public.save_generated_plan(uuid, uuid, jsonb)',
    'public.admin_save_plan_week(uuid, uuid, uuid, date, text, jsonb)',
    'public.save_next_plan_week(uuid, uuid, jsonb)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;
