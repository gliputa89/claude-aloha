-- Rezygnujemy z deklaracji 18+ przy rejestracji: znika checkbox w aplikacji,
-- pole adult_confirmed w metadanych konta i kolumna profiles.adult_confirmed_at.
--
-- Aplikacja przekazuje teraz w supabase.auth.signUp({ options: { data } }):
--   display_name  – imię do powitania („Aloha, Tomek!”)
--   locale        – 'pl' | 'en'
--   terms_version – wersja zaakceptowanego regulaminu i polityki prywatności

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
  insert into public.profiles (id, locale, display_name)
  values (
    new.id,
    case when meta ->> 'locale' = 'en' then 'en' else 'pl' end,
    nullif(left(trim(meta ->> 'display_name'), 80), '')
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

alter table public.profiles drop column if exists adult_confirmed_at;
