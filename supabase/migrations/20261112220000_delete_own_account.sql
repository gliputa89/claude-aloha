-- Usunięcie konta przez samego użytkownika (Profil → Usuń konto) – wymóg Google Play i App Store.
--
-- Ta sama logika co przy usuwaniu z panelu admina (20261110110000_admin_delete_user), wyjęta do jednej funkcji
-- ops.delete_user_account, z której korzystają obie ścieżki:
--   • public.admin_delete_user(admin, user) – panel admina, jak dotąd (te same sprawdzenia i wpis w admin_audit_log),
--   • public.delete_own_account(user)       – Edge Function delete-account; użytkownika bierze z tokenu
--                                             (tylko własne konto), przed usunięciem cofa dostęp Stravy i Apple.
--
-- Zostaje wyłącznie zapis o usunięciu konta w ops.account_deletions (adres e-mail i data, polityka prywatności
-- pkt „Jak długo przechowujemy dane”: do 6 lat). Bez klucza obcego – wiersz ma przetrwać usunięcie konta.

create table if not exists ops.account_deletions (
  id          bigint generated always as identity primary key,
  user_id     uuid not null,
  email       text,
  source      text not null check (source in ('self', 'admin')),
  deleted_at  timestamptz not null default now()
);

create index if not exists account_deletions_deleted_at_idx on ops.account_deletions (deleted_at);

-- Tylko service_role (panel, funkcje) – bez polityk dla aplikacji.
alter table ops.account_deletions enable row level security;

comment on table ops.account_deletions is
  'Zapis o usunięciu konta (e-mail i data) – przechowywany do 6 lat, na wypadek roszczeń i jako dowód spełnienia żądania.';

-- Wspólna część: usuwa konto i wszystkie powiązane dane, zapisuje ślad usunięcia, zwraca liczby wierszy.
create or replace function ops.delete_user_account(p_user_id uuid, p_source text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email     text;
  v_counts    jsonb;
  v_ai_calls  integer;
  v_waitlist  integer;
  v_invites   integer;
begin
  select email into v_email from auth.users where id = p_user_id for update;
  if not found then
    raise exception 'Nie ma takiego użytkownika' using errcode = 'P0002';
  end if;

  -- Liczby do logu (zanim kaskada je usunie).
  select jsonb_build_object(
    'weeks',            (select count(*) from public.weeks where user_id = p_user_id),
    'sessions',         (select count(*) from public.sessions where user_id = p_user_id),
    'check_ins',        (select count(*) from public.check_ins where user_id = p_user_id),
    'plans',            (select count(*) from public.plans where user_id = p_user_id),
    'level_changes',    (select count(*) from public.training_level_changes where user_id = p_user_id)
  ) into v_counts;

  -- Wywołania AI (treści w ai_call_payloads idą kaskadą) – przy usunięciu konta byłyby tylko odpięte.
  delete from ops.ai_calls where user_id = p_user_id;
  get diagnostics v_ai_calls = row_count;

  -- Lista oczekujących i zaproszenia – po koncie albo po e-mailu.
  delete from marketing.beta_invites
  where user_id = p_user_id or (v_email is not null and email = v_email::extensions.citext);
  get diagnostics v_invites = row_count;
  delete from marketing.waitlist_signups
  where user_id = p_user_id or (v_email is not null and email = v_email::extensions.citext);
  get diagnostics v_waitlist = row_count;

  -- Konto i wszystko, co od niego zależy (kaskada: logowanie, profil, zgody, cel, ankieta, plan, treningi,
  -- check-iny, zmiany planu, notki dnia, oceny treningów, rozmowy z trenerem, Strava – połączenie i biegi).
  delete from auth.users where id = p_user_id;

  insert into ops.account_deletions (user_id, email, source) values (p_user_id, v_email, p_source);

  return v_counts || jsonb_build_object('ai_calls', v_ai_calls, 'waitlist', v_waitlist, 'beta_invites', v_invites);
end;
$$;

revoke execute on function ops.delete_user_account(uuid, text) from public, anon, authenticated;
grant execute on function ops.delete_user_account(uuid, text) to service_role;

-- Panel admina: bez zmian w zachowaniu, logika usuwania ze wspólnej funkcji.
create or replace function public.admin_delete_user(p_admin_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email   text;
  v_counts  jsonb;
begin
  if p_user_id = p_admin_id then
    raise exception 'Nie można usunąć własnego konta' using errcode = '42501';
  end if;
  if exists (select 1 from ops.admins where user_id = p_user_id) then
    raise exception 'To konto ma rolę admina – najpierw odbierz rolę' using errcode = '42501';
  end if;

  select email into v_email from auth.users where id = p_user_id;
  v_counts := ops.delete_user_account(p_user_id, 'admin');

  insert into ops.admin_audit_log (admin_id, action, target_type, target_id, details)
  values (p_admin_id, 'delete_user', 'user', p_user_id::text, jsonb_build_object('email', v_email, 'deleted', v_counts));

  return v_counts;
end;
$$;

revoke execute on function public.admin_delete_user(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_user(uuid, uuid) to service_role;

-- Usunięcie własnego konta. Wywołuje je tylko Edge Function delete-account (service_role), która bierze
-- p_user_id z tokenu zalogowanego użytkownika – aplikacja nie może wskazać cudzego konta.
-- Konto admina usuwa się z panelu (najpierw odebranie roli), nie z aplikacji.
create or replace function public.delete_own_account(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from ops.admins where user_id = p_user_id) then
    raise exception 'admin_account' using errcode = '42501';
  end if;
  return ops.delete_user_account(p_user_id, 'self');
end;
$$;

revoke execute on function public.delete_own_account(uuid) from public, anon, authenticated;
grant execute on function public.delete_own_account(uuid) to service_role;
