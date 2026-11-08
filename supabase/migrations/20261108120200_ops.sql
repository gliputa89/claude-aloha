-- Schemat ops: administratorzy panelu, log działań, wywołania AI, feature flags.

create table ops.admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  role        text not null default 'admin' check (role in ('owner', 'admin', 'viewer')),
  created_at  timestamptz not null default now()
);

-- Czy zalogowany użytkownik jest administratorem (panel sprawdza po zalogowaniu).
create or replace function ops.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from ops.admins a where a.user_id = uid);
$$;

-- Log działań administratora, m.in. każdy wgląd w szczegóły danych użytkownika
-- (ARCHITECTURE.md: „wgląd tylko na wyraźną prośbę, z wpisem do logu”).
create table ops.admin_audit_log (
  id           bigint generated always as identity primary key,
  admin_id     uuid references auth.users (id) on delete set null,
  action       text not null,            -- np. 'view_user_details', 'send_beta_invite'
  target_type  text,                     -- np. 'user', 'waitlist_signup'
  target_id    text,
  details      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index admin_audit_log_created_at_idx on ops.admin_audit_log (created_at);

-- Wywołania AI: metryki i koszty. BEZ treści notatek i promptów (minimalizacja danych).
create table ops.ai_calls (
  id                 bigint generated always as identity primary key,
  user_id            uuid references auth.users (id) on delete set null,
  function_name      text not null,      -- np. 'checkin-interpret', 'plan-next-week'
  model              text not null,
  input_tokens       integer check (input_tokens >= 0),
  output_tokens      integer check (output_tokens >= 0),
  cache_read_tokens  integer check (cache_read_tokens >= 0),
  cost_usd           numeric(12, 6) check (cost_usd >= 0),
  duration_ms        integer check (duration_ms >= 0),
  -- wynik walidacji odpowiedzi AI przez silnik reguł
  validation_status  text check (validation_status in ('ok', 'corrected', 'rejected', 'fallback')),
  error              text,
  created_at         timestamptz not null default now()
);

create index ai_calls_created_at_idx on ops.ai_calls (created_at);
create index ai_calls_user_id_idx on ops.ai_calls (user_id);

create table ops.feature_flags (
  key          text primary key,
  enabled      boolean not null default false,
  description  text,
  -- np. {"percent": 20} albo {"user_ids": [...]}
  rollout      jsonb not null default '{}'::jsonb,
  updated_at   timestamptz not null default now()
);

create trigger feature_flags_updated_at
  before update on ops.feature_flags
  for each row execute function public.set_updated_at();

alter table ops.admins enable row level security;
alter table ops.admin_audit_log enable row level security;
alter table ops.ai_calls enable row level security;
alter table ops.feature_flags enable row level security;
