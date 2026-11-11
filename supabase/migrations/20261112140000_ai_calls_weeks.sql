-- Wywołania AI: ilu tygodni planu dotyczyło wywołanie funkcji 'plan-weeks'.
--
-- Po ankiecie model dostaje szkic 2 tygodni, przy cotygodniowym generowaniu – jednego; tester w panelu może ułożyć
-- dłuższy plan porcjami. Sama nazwa funkcji tego nie mówi, a treść wywołania (ops.ai_call_payloads) wygasa po
-- 30 dniach – dlatego liczba tygodni szkicu trafia do wiersza wywołania. Dla pozostałych funkcji AI zostaje null.

alter table ops.ai_calls
  add column if not exists weeks smallint check (weeks between 1 and 60);

comment on column ops.ai_calls.weeks is 'plan-weeks: liczba tygodni szkicu w tym wywołaniu; inne funkcje – null.';

-- Dotychczasowe wywołania: z zapisanego szkicu, dopóki treść jeszcze nie wygasła.
update ops.ai_calls c
set weeks = jsonb_array_length(p.result -> 'draft')
from ops.ai_call_payloads p
where p.call_id = c.id
  and c.function_name = 'plan-weeks'
  and c.weeks is null
  and jsonb_typeof(p.result -> 'draft') = 'array'
  and jsonb_array_length(p.result -> 'draft') between 1 and 60;

-- Zapis wywołania: jak dotąd + pole `weeks` z rekordu (brak = null).
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
    request_id, stop_reason, price, weeks
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
    p_call -> 'price',
    (p_call ->> 'weeks')::smallint
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

-- Lista w panelu: jak dotąd + kolumna `weeks`.
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
        select f.id, f.created_at, f.user_id, u.email, f.is_test, f.function_name, f.model, f.source, f.weeks,
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
