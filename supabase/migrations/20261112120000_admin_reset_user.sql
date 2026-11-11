-- Reset użytkownika z panelu admina: konto wraca do stanu „tuż po rejestracji”, żeby przejść ankietę od nowa
-- (np. test podpowiedzi ze Stravy w onboardingu). Wszystko w jednej transakcji.
--
-- Usuwa: cel i dostępność (ankieta), plany → tygodnie → treningi (kaskadą też pogoda, oceny treningów i wątki
-- czatu przy treningach), check-iny, zmiany planu, historię poziomu, notki dnia, rozmowy z trenerem i przypisanie
-- trenera, pobrane biegi ze Stravy, wywołania AI z treściami oraz zgodę na dane zdrowotne (ankieta pyta o nią od nowa).
-- W profilu czyści odpowiedzi z ankiety, poziom i znacznik ukończenia onboardingu.
--
-- Zostaje: konto i logowanie, imię, język, strefa czasowa, pakiet, zgody na regulamin i prywatność oraz
-- połączenie ze Stravą (tokeny) – bez znaczników synchronizacji, więc biegi pobiorą się na nowo.

create or replace function public.admin_reset_user(p_admin_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email     text;
  v_counts    jsonb;
  v_ai_calls  integer;
begin
  select email into v_email from auth.users where id = p_user_id for update;
  if not found then
    raise exception 'Nie ma takiego użytkownika' using errcode = 'P0002';
  end if;

  -- Liczby do logu (zanim je usuniemy).
  select jsonb_build_object(
    'plans',             (select count(*) from public.plans where user_id = p_user_id),
    'sessions',          (select count(*) from public.sessions where user_id = p_user_id),
    'check_ins',         (select count(*) from public.check_ins where user_id = p_user_id),
    'chat_messages',     (select count(*) from public.chat_messages where user_id = p_user_id),
    'strava_activities', (select count(*) from public.strava_activities where user_id = p_user_id),
    'strava_connected',  exists (select 1 from public.strava_connections where user_id = p_user_id)
  ) into v_counts;

  delete from public.chat_messages          where user_id = p_user_id;
  delete from public.chat_threads           where user_id = p_user_id;
  delete from public.coach_assignments      where user_id = p_user_id;
  delete from public.day_notes              where user_id = p_user_id;
  delete from public.strava_activities      where user_id = p_user_id;
  delete from public.adjustments            where user_id = p_user_id;
  delete from public.check_ins              where user_id = p_user_id;
  -- Plan → tygodnie → treningi → pogoda i oceny treningów (kaskada).
  delete from public.plans                  where user_id = p_user_id;
  delete from public.goals                  where user_id = p_user_id;
  delete from public.availability           where user_id = p_user_id;
  delete from public.training_level_changes where user_id = p_user_id;
  delete from public.consents               where user_id = p_user_id and kind = 'health_data';

  -- Wywołania AI (treści w ai_call_payloads idą kaskadą).
  delete from ops.ai_calls where user_id = p_user_id;
  get diagnostics v_ai_calls = row_count;

  update public.profiles set
    level                    = null,
    recent_result_distance_m = null,
    recent_result_time_s     = null,
    weekly_km                = null,
    current_runs_per_week    = null,
    has_contraindications    = null,
    training_level           = null,
    training_level_since     = null,
    training_level_survey    = null,
    onboarding_completed_at  = null
  where id = p_user_id;

  -- Połączenie ze Stravą zostaje; czyścimy tylko znaczniki, żeby pierwsza synchronizacja po ankiecie poszła od razu.
  update public.strava_connections set last_synced_at = null, last_manual_sync_at = null
  where user_id = p_user_id;

  v_counts := v_counts || jsonb_build_object('ai_calls', v_ai_calls);

  insert into ops.admin_audit_log (admin_id, action, target_type, target_id, details)
  values (p_admin_id, 'reset_user', 'user', p_user_id::text, jsonb_build_object('email', v_email, 'deleted', v_counts));

  return v_counts;
end;
$$;

revoke execute on function public.admin_reset_user(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_reset_user(uuid, uuid) to service_role;
