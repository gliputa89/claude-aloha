-- Warstwa AI planu (docs/PROJECT.md 5, wariant B: silnik robi szkic, Claude go poprawia operacjami).
--
--   * ops.ai_prompts         – wersje promptów (model, effort, treść) edytowane w panelu; jedna aktywna na funkcję,
--   * ops.engine_configs     – wersje parametrów silnika reguł; jedna aktywna (brak = wartości wbudowane w kod),
--   * ops.ai_calls           – + wersje promptu i parametrów, ponowienia, źródło, cena z chwili wywołania,
--   * ops.ai_call_payloads   – pełne wejście i wyjście modelu; prawdziwi użytkownicy: usuwane po 30 dniach,
--                              konta testowe: bez limitu. Metryki i koszt w ops.ai_calls zostają na zawsze.
--   * public.weeks           – skąd tydzień (reguły / AI), które wywołanie AI i która wersja parametrów.
--
-- Schemat ops nie jest wystawiony w API, więc wszystko idzie przez funkcje w public (tylko service_role).
-- Do Claude nie wysyłamy identyfikatorów użytkownika – user_id zostaje u nas, żeby liczyć koszt na osobę.

-- ───────────────────────── prompty ─────────────────────────

create table ops.ai_prompts (
  id             bigint generated always as identity primary key,
  function_name  text not null,                 -- np. 'plan-weeks'
  version        integer not null check (version > 0),
  status         text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  model          text not null,
  effort         text check (effort in ('low', 'medium', 'high', 'xhigh', 'max')),
  max_tokens     integer not null check (max_tokens between 256 and 64000),
  system_prompt  text not null check (length(system_prompt) between 1 and 60000),
  note           text,
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  activated_at   timestamptz,
  unique (function_name, version)
);

create unique index ai_prompts_one_active_idx on ops.ai_prompts (function_name) where status = 'active';

-- ───────────────────────── parametry silnika ─────────────────────────

create table ops.engine_configs (
  id            bigint generated always as identity primary key,
  version       integer not null unique check (version > 0),
  status        text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  -- EngineParams z packages/plan-engine (granice sprawdza kod przed zapisem i przy każdym użyciu)
  params        jsonb not null,
  note          text,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  activated_at  timestamptz
);

create unique index engine_configs_one_active_idx on ops.engine_configs (status) where status = 'active';

alter table ops.ai_prompts enable row level security;
alter table ops.engine_configs enable row level security;

-- ───────────────────────── wywołania AI ─────────────────────────

alter table ops.ai_calls
  add column source                 text not null default 'app' check (source in ('app', 'tester')),
  add column is_test                boolean not null default false,
  add column attempt                smallint not null default 1 check (attempt >= 1),
  add column parent_call_id         bigint references ops.ai_calls (id) on delete set null,
  add column prompt_id              bigint references ops.ai_prompts (id) on delete set null,
  add column prompt_version         integer,          -- null = prompt wbudowany w kod
  add column engine_config_id       bigint references ops.engine_configs (id) on delete set null,
  add column engine_config_version  integer,          -- 0 = parametry wbudowane w kod
  add column engine_version         text,
  add column request_id             text,             -- id wiadomości z Claude API
  add column stop_reason            text,
  add column cache_write_tokens     integer check (cache_write_tokens >= 0),
  -- cennik z chwili wywołania (USD / 1 mln tokenów): późniejsza zmiana cen nie przekłamie historii
  add column price                  jsonb;

create index ai_calls_function_created_idx on ops.ai_calls (function_name, created_at);
create index ai_calls_parent_idx on ops.ai_calls (parent_call_id);

create table ops.ai_call_payloads (
  call_id     bigint primary key references ops.ai_calls (id) on delete cascade,
  request     jsonb not null,               -- prompt systemowy, wiadomości, schemat odpowiedzi, parametry
  response    jsonb,                        -- surowa odpowiedź modelu (albo błąd)
  result      jsonb,                        -- szkic silnika, operacje, walidacja, wynik po walidacji
  expires_at  timestamptz,                  -- null = bez limitu (konta testowe)
  created_at  timestamptz not null default now()
);

create index ai_call_payloads_expires_idx on ops.ai_call_payloads (expires_at) where expires_at is not null;

alter table ops.ai_call_payloads enable row level security;

-- Usunięcie konta (user_id → null przez FK) usuwa też treści jego wywołań; koszt zostaje bez przypisania.
create or replace function ops.ai_calls_drop_payload_on_user_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  delete from ops.ai_call_payloads where call_id = new.id;
  return new;
end;
$$;

create trigger ai_calls_drop_payload_on_user_delete
  after update of user_id on ops.ai_calls
  for each row
  when (old.user_id is not null and new.user_id is null)
  execute function ops.ai_calls_drop_payload_on_user_delete();

-- ───────────────────────── tygodnie planu ─────────────────────────

alter table public.weeks
  add column source                 text not null default 'rules' check (source in ('rules', 'ai')),
  add column ai_call_id             bigint references ops.ai_calls (id) on delete set null,
  add column engine_config_version  integer;

-- ───────────────────────── zapis wywołania ─────────────────────────

-- p_call: pola ops.ai_calls (snake_case), p_payload: { request, response, result }.
-- Przy okazji usuwa przeterminowane treści (retencja bez osobnego crona).
create or replace function public.log_ai_call(p_call jsonb, p_payload jsonb, p_retention_days integer default 30)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
  v_is_test boolean := coalesce((p_call ->> 'is_test')::boolean, false);
begin
  insert into ops.ai_calls (
    user_id, function_name, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
    cost_usd, duration_ms, validation_status, error, source, is_test, attempt, parent_call_id,
    prompt_id, prompt_version, engine_config_id, engine_config_version, engine_version,
    request_id, stop_reason, price
  )
  values (
    (p_call ->> 'user_id')::uuid,
    p_call ->> 'function_name',
    p_call ->> 'model',
    (p_call ->> 'input_tokens')::integer,
    (p_call ->> 'output_tokens')::integer,
    (p_call ->> 'cache_read_tokens')::integer,
    (p_call ->> 'cache_write_tokens')::integer,
    (p_call ->> 'cost_usd')::numeric,
    (p_call ->> 'duration_ms')::integer,
    p_call ->> 'validation_status',
    p_call ->> 'error',
    coalesce(p_call ->> 'source', 'app'),
    v_is_test,
    coalesce((p_call ->> 'attempt')::smallint, 1),
    (p_call ->> 'parent_call_id')::bigint,
    (p_call ->> 'prompt_id')::bigint,
    (p_call ->> 'prompt_version')::integer,
    (p_call ->> 'engine_config_id')::bigint,
    (p_call ->> 'engine_config_version')::integer,
    p_call ->> 'engine_version',
    p_call ->> 'request_id',
    p_call ->> 'stop_reason',
    p_call -> 'price'
  )
  returning id into v_id;

  if p_payload is not null then
    insert into ops.ai_call_payloads (call_id, request, response, result, expires_at)
    values (
      v_id,
      coalesce(p_payload -> 'request', '{}'::jsonb),
      p_payload -> 'response',
      p_payload -> 'result',
      case when v_is_test then null else now() + make_interval(days => greatest(p_retention_days, 1)) end
    );
  end if;

  delete from ops.ai_call_payloads where expires_at < now();

  return v_id;
end;
$$;

-- Status walidacji ustalany po zapisie (np. pierwsza próba → 'corrected', gdy ponowienie coś poprawiło).
create or replace function public.update_ai_call_result(p_id bigint, p_validation_status text, p_result jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  update ops.ai_calls set validation_status = coalesce(p_validation_status, validation_status) where id = p_id;
  update ops.ai_call_payloads set result = coalesce(p_result, result) where call_id = p_id;
$$;

-- ───────────────────────── konfiguracja w czasie działania ─────────────────────────

-- Prompt: wskazana wersja albo aktywna dla funkcji; null = użyj wbudowanego w kod.
create or replace function public.get_ai_prompt(p_function text, p_id bigint default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select to_jsonb(p) from ops.ai_prompts p
  where p.function_name = p_function
    and (case when p_id is null then p.status = 'active' else p.id = p_id end)
  limit 1;
$$;

-- Parametry silnika: wskazana wersja albo aktywna; null = wartości wbudowane w kod.
create or replace function public.get_engine_config(p_id bigint default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select to_jsonb(c) from ops.engine_configs c
  where (case when p_id is null then c.status = 'active' else c.id = p_id end)
  limit 1;
$$;

-- ───────────────────────── panel: prompty ─────────────────────────

create or replace function public.admin_ai_prompts(p_function text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(p) order by p.version desc), '[]'::jsonb)
  from ops.ai_prompts p where p.function_name = p_function;
$$;

create or replace function public.admin_create_ai_prompt(
  p_admin_id uuid, p_function text, p_model text, p_effort text, p_max_tokens integer, p_system_prompt text, p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row ops.ai_prompts;
begin
  -- jedna wersja naraz – numer liczony pod blokadą
  perform pg_advisory_xact_lock(hashtext('ai_prompts:' || p_function));
  insert into ops.ai_prompts (function_name, version, model, effort, max_tokens, system_prompt, note, created_by)
  values (
    p_function,
    coalesce((select max(version) from ops.ai_prompts where function_name = p_function), 0) + 1,
    p_model, p_effort, p_max_tokens, p_system_prompt, nullif(trim(p_note), ''), p_admin_id
  )
  returning * into v_row;

  insert into ops.admin_audit_log (admin_id, action, target_type, target_id, details)
  values (p_admin_id, 'ai_prompt_create', 'ai_prompt', v_row.id::text,
          jsonb_build_object('function', p_function, 'version', v_row.version, 'model', p_model));
  return to_jsonb(v_row);
end;
$$;

-- p_id = null → wyłącza aktywną wersję (wraca prompt wbudowany w kod).
create or replace function public.admin_activate_ai_prompt(p_admin_id uuid, p_function text, p_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_id is not null and not exists (select 1 from ops.ai_prompts where id = p_id and function_name = p_function) then
    raise exception 'prompt not found' using errcode = 'P0002';
  end if;
  update ops.ai_prompts set status = 'archived' where function_name = p_function and status = 'active';
  if p_id is not null then
    update ops.ai_prompts set status = 'active', activated_at = now() where id = p_id;
  end if;
  insert into ops.admin_audit_log (admin_id, action, target_type, target_id, details)
  values (p_admin_id, 'ai_prompt_activate', 'ai_prompt', coalesce(p_id::text, 'builtin'),
          jsonb_build_object('function', p_function));
end;
$$;

-- ───────────────────────── panel: parametry silnika ─────────────────────────

create or replace function public.admin_engine_configs()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(c) order by c.version desc), '[]'::jsonb) from ops.engine_configs c;
$$;

create or replace function public.admin_create_engine_config(p_admin_id uuid, p_params jsonb, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row ops.engine_configs;
begin
  perform pg_advisory_xact_lock(hashtext('engine_configs'));
  insert into ops.engine_configs (version, params, note, created_by)
  values (coalesce((select max(version) from ops.engine_configs), 0) + 1, p_params, nullif(trim(p_note), ''), p_admin_id)
  returning * into v_row;

  insert into ops.admin_audit_log (admin_id, action, target_type, target_id, details)
  values (p_admin_id, 'engine_config_create', 'engine_config', v_row.id::text, jsonb_build_object('version', v_row.version));
  return to_jsonb(v_row);
end;
$$;

-- p_id = null → wyłącza aktywną wersję (wracają wartości wbudowane w kod).
create or replace function public.admin_activate_engine_config(p_admin_id uuid, p_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_id is not null and not exists (select 1 from ops.engine_configs where id = p_id) then
    raise exception 'engine config not found' using errcode = 'P0002';
  end if;
  update ops.engine_configs set status = 'archived' where status = 'active';
  if p_id is not null then
    update ops.engine_configs set status = 'active', activated_at = now() where id = p_id;
  end if;
  insert into ops.admin_audit_log (admin_id, action, target_type, target_id, details)
  values (p_admin_id, 'engine_config_activate', 'engine_config', coalesce(p_id::text, 'builtin'), '{}'::jsonb);
end;
$$;

-- ───────────────────────── panel: wywołania i koszty ─────────────────────────

create or replace function public.admin_ai_calls(
  p_limit integer default 50,
  p_offset integer default 0,
  p_user_id uuid default null,
  p_function text default null,
  p_status text default null
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with filtered as (
    select c.* from ops.ai_calls c
    where (p_user_id is null or c.user_id = p_user_id)
      and (p_function is null or c.function_name = p_function)
      and (p_status is null or c.validation_status = p_status)
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'cost_usd', (select coalesce(sum(cost_usd), 0) from filtered),
    'rows', coalesce((
      select jsonb_agg(r order by r.created_at desc, r.id desc) from (
        select f.id, f.created_at, f.user_id, u.email, f.is_test, f.function_name, f.model, f.source,
               f.attempt, f.parent_call_id, f.prompt_version, f.engine_config_version,
               f.input_tokens, f.output_tokens, f.cache_read_tokens, f.cache_write_tokens,
               f.cost_usd, f.duration_ms, f.validation_status, f.error,
               exists (select 1 from ops.ai_call_payloads p where p.call_id = f.id) as has_payload
        from filtered f left join auth.users u on u.id = f.user_id
        order by f.created_at desc, f.id desc
        limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0)
      ) r
    ), '[]'::jsonb)
  );
$$;

-- Jedno wywołanie z treścią, poprzednikiem i ponowieniami. Wgląd w treść prawdziwego użytkownika → log admina.
create or replace function public.admin_ai_call(p_admin_id uuid, p_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_call jsonb;
  v_is_test boolean;
  v_has_payload boolean;
begin
  select to_jsonb(c) || jsonb_build_object('email', u.email), c.is_test
  into v_call, v_is_test
  from ops.ai_calls c left join auth.users u on u.id = c.user_id
  where c.id = p_id;
  if v_call is null then return null; end if;

  v_has_payload := exists (select 1 from ops.ai_call_payloads where call_id = p_id);
  if v_has_payload and not v_is_test then
    insert into ops.admin_audit_log (admin_id, action, target_type, target_id, details)
    values (p_admin_id, 'ai_call_view_payload', 'ai_call', p_id::text,
            jsonb_build_object('user_id', v_call ->> 'user_id'));
  end if;

  return jsonb_build_object(
    'call', v_call,
    'payload', (select to_jsonb(p) - 'call_id' from ops.ai_call_payloads p where p.call_id = p_id),
    'related', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'attempt', r.attempt, 'validation_status', r.validation_status, 'cost_usd', r.cost_usd,
        'created_at', r.created_at) order by r.attempt)
      from ops.ai_calls r
      where r.id <> p_id
        and (r.id = (v_call ->> 'parent_call_id')::bigint
             or r.parent_call_id = p_id
             or (v_call ->> 'parent_call_id' is not null and r.parent_call_id = (v_call ->> 'parent_call_id')::bigint))
    ), '[]'::jsonb)
  );
end;
$$;

-- Podsumowanie kosztów: dziś / 7 dni / bieżący miesiąc / razem, podział na model i funkcję, 30 dni dzień po dniu.
-- p_include_test = false → bez kont testowych (koszt „prawdziwy”).
create or replace function public.admin_ai_cost_summary(p_include_test boolean default true)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with c as (
    select * from ops.ai_calls where p_include_test or not is_test
  ),
  agg as (
    select
      coalesce(sum(cost_usd) filter (where created_at >= date_trunc('day', now())), 0) as today,
      coalesce(sum(cost_usd) filter (where created_at >= now() - interval '7 days'), 0) as last7,
      coalesce(sum(cost_usd) filter (where created_at >= date_trunc('month', now())), 0) as month,
      coalesce(sum(cost_usd), 0) as total,
      count(*) as calls,
      count(*) filter (where created_at >= date_trunc('month', now())) as month_calls,
      count(distinct user_id) filter (where created_at >= date_trunc('month', now())) as month_users
    from c
  )
  select jsonb_build_object(
    'today', a.today, 'last7', a.last7, 'month', a.month, 'total', a.total,
    'calls', a.calls, 'month_calls', a.month_calls, 'month_users', a.month_users,
    'by_model', coalesce((
      select jsonb_agg(jsonb_build_object('model', model, 'calls', n, 'cost_usd', cost) order by cost desc)
      from (select model, count(*) n, coalesce(sum(cost_usd), 0) cost from c
            where created_at >= date_trunc('month', now()) group by model) m
    ), '[]'::jsonb),
    'by_function', coalesce((
      select jsonb_agg(jsonb_build_object('function_name', function_name, 'calls', n, 'cost_usd', cost) order by cost desc)
      from (select function_name, count(*) n, coalesce(sum(cost_usd), 0) cost from c
            where created_at >= date_trunc('month', now()) group by function_name) f
    ), '[]'::jsonb),
    'by_status', coalesce((
      select jsonb_object_agg(coalesce(validation_status, 'none'), n)
      from (select validation_status, count(*) n from c
            where created_at >= date_trunc('month', now()) group by validation_status) s
    ), '{}'::jsonb),
    'by_day', coalesce((
      select jsonb_agg(jsonb_build_object('day', d::date, 'cost_usd', coalesce(x.cost, 0), 'calls', coalesce(x.n, 0)) order by d)
      from generate_series(date_trunc('day', now()) - interval '29 days', date_trunc('day', now()), interval '1 day') d
      left join (select date_trunc('day', created_at) as day_at, sum(cost_usd) as cost, count(*) as n from c group by 1) x on x.day_at = d
    ), '[]'::jsonb)
  )
  from agg a;
$$;

-- Koszt na użytkownika (najdrożsi pierwsi). p_user_id → tylko ten jeden.
create or replace function public.admin_ai_cost_by_user(p_limit integer default 50, p_user_id uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(r order by r.cost_usd desc), '[]'::jsonb) from (
    select c.user_id, u.email, bool_or(c.is_test) as is_test,
           count(*) as calls,
           coalesce(sum(c.cost_usd), 0) as cost_usd,
           coalesce(sum(c.cost_usd) filter (where c.created_at >= date_trunc('month', now())), 0) as month_cost_usd,
           count(*) filter (where c.created_at >= date_trunc('month', now())) as month_calls,
           max(c.created_at) as last_at
    from ops.ai_calls c left join auth.users u on u.id = c.user_id
    where c.user_id is not null and (p_user_id is null or c.user_id = p_user_id)
    group by c.user_id, u.email
    order by coalesce(sum(c.cost_usd), 0) desc
    limit least(greatest(p_limit, 1), 500)
  ) r;
$$;

-- ───────────────────────── zapis planu: źródło tygodnia ─────────────────────────

-- Jak w 20261108170000_plan_generation.sql, plus opcjonalne pola tygodnia:
--   source ('rules' | 'ai'), aiCallId, engineConfigVersion.
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
    insert into public.weeks (plan_id, user_id, week_index, starts_on, focus, source, ai_call_id, engine_config_version)
    values (
      v_plan_id, p_user_id, (w ->> 'weekIndex')::smallint, (w ->> 'startsOn')::date, w ->> 'focus',
      coalesce(w ->> 'source', 'rules'), (w ->> 'aiCallId')::bigint, (w ->> 'engineConfigVersion')::integer
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

-- Jak w 20261109120000_admin_plan_tester.sql, plus źródło tygodnia (source, aiCallId, engineConfigVersion).
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

  insert into public.weeks (plan_id, user_id, week_index, starts_on, focus, source, ai_call_id, engine_config_version)
  values (
    v_plan_id, p_user_id, v_index, (p_week ->> 'startsOn')::date, p_week ->> 'focus',
    coalesce(p_week ->> 'source', 'rules'), (p_week ->> 'aiCallId')::bigint, (p_week ->> 'engineConfigVersion')::integer
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

-- ───────────────────────── uprawnienia ─────────────────────────

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.log_ai_call(jsonb, jsonb, integer)',
    'public.update_ai_call_result(bigint, text, jsonb)',
    'public.get_ai_prompt(text, bigint)',
    'public.get_engine_config(bigint)',
    'public.admin_ai_prompts(text)',
    'public.admin_create_ai_prompt(uuid, text, text, text, integer, text, text)',
    'public.admin_activate_ai_prompt(uuid, text, bigint)',
    'public.admin_engine_configs()',
    'public.admin_create_engine_config(uuid, jsonb, text)',
    'public.admin_activate_engine_config(uuid, bigint)',
    'public.admin_ai_calls(integer, integer, uuid, text, text)',
    'public.admin_ai_call(uuid, bigint)',
    'public.admin_ai_cost_summary(boolean)',
    'public.admin_ai_cost_by_user(integer, uuid)',
    'public.save_generated_plan(uuid, uuid, jsonb)',
    'public.admin_save_plan_week(uuid, uuid, uuid, date, text, jsonb)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;
