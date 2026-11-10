-- Twarde usunięcie użytkownika z panelu admina – wszystko, w jednej transakcji.
--
-- Usunięcie wiersza auth.users kasuje kaskadowo: logowanie (identities, sesje, tokeny w schemacie auth),
-- profil, zgody, cel i dostępność (ankieta), plan → tygodnie → treningi (kalendarz), check-iny, zmiany planu,
-- historię poziomu (training_level_changes). Tabele, które przy usunięciu konta tylko odpinają użytkownika
-- (on delete set null), czyścimy tu jawnie: wywołania AI z treściami oraz wpisy z listy oczekujących i zaproszenia.
-- Zostaje tylko wpis w ops.admin_audit_log (kto, kiedy, ile wierszy) – bez danych użytkownika poza e-mailem.
--
-- Nie usuwa: samego siebie ani innego admina (najpierw odebrać rolę w ops.admins).

create or replace function public.admin_delete_user(p_admin_id uuid, p_user_id uuid)
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
  if p_user_id = p_admin_id then
    raise exception 'Nie można usunąć własnego konta' using errcode = '42501';
  end if;
  if exists (select 1 from ops.admins where user_id = p_user_id) then
    raise exception 'To konto ma rolę admina – najpierw odbierz rolę' using errcode = '42501';
  end if;

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

  -- Wywołania AI (treści w ai_call_payloads idą kaskadą).
  delete from ops.ai_calls where user_id = p_user_id;
  get diagnostics v_ai_calls = row_count;

  -- Lista oczekujących i zaproszenia – po koncie albo po e-mailu.
  delete from marketing.beta_invites
  where user_id = p_user_id or (v_email is not null and email = v_email::extensions.citext);
  get diagnostics v_invites = row_count;
  delete from marketing.waitlist_signups
  where user_id = p_user_id or (v_email is not null and email = v_email::extensions.citext);
  get diagnostics v_waitlist = row_count;

  -- Konto i wszystko, co od niego zależy (kaskada).
  delete from auth.users where id = p_user_id;

  v_counts := v_counts || jsonb_build_object('ai_calls', v_ai_calls, 'waitlist', v_waitlist, 'beta_invites', v_invites);

  insert into ops.admin_audit_log (admin_id, action, target_type, target_id, details)
  values (p_admin_id, 'delete_user', 'user', p_user_id::text, jsonb_build_object('email', v_email, 'deleted', v_counts));

  return v_counts;
end;
$$;

revoke execute on function public.admin_delete_user(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_user(uuid, uuid) to service_role;
