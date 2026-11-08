-- Rejestracja w aplikacji: profil i zgody zapisywane od razu przy zakładaniu konta.
--
-- Aplikacja przekazuje w supabase.auth.signUp({ options: { data } }):
--   display_name    – imię do powitania („Aloha, Tomek!”)
--   locale          – 'pl' | 'en'
--   adult_confirmed – deklaracja 18+ (checkbox przy rejestracji)
--   terms_version   – wersja zaakceptowanego regulaminu i polityki prywatności
--
-- Robimy to w triggerze, bo przy włączonym potwierdzaniu e-maila użytkownik nie ma
-- jeszcze sesji i nie może sam dopisać wiersza do public.consents.
-- Zgoda na dane zdrowotne ('health_data') NIE jest tu zapisywana – to osobny checkbox w onboardingu.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta          jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  terms_version text  := nullif(left(trim(meta ->> 'terms_version'), 40), '');
begin
  insert into public.profiles (id, locale, display_name, adult_confirmed_at)
  values (
    new.id,
    case when meta ->> 'locale' = 'en' then 'en' else 'pl' end,
    nullif(left(trim(meta ->> 'display_name'), 80), ''),
    case when meta ->> 'adult_confirmed' = 'true' then now() end
  );

  if terms_version is not null then
    insert into public.consents (user_id, kind, granted, version)
    values
      (new.id, 'terms',   true, terms_version),
      (new.id, 'privacy', true, terms_version);
  end if;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
