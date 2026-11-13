-- Język tekstów od AI zapisanych przy treningu: rada trenera (sessions.coach_tip) i notka do oceny
-- (session_reviews.note). Po zmianie języka w aplikacji tekst w starym języku nie jest pokazywany –
-- aplikacja bierze radę z bazy rad w nowym języku, a notkę do oceny serwer pisze od nowa przy synchronizacji.
-- (Notka dnia – public.day_notes – ma kolumnę locale od początku; pogoda – session_weather.advice_locale.)

alter table public.sessions
  add column coach_tip_locale text check (coach_tip_locale in ('pl', 'en'));

alter table public.session_reviews
  add column note_locale text check (note_locale in ('pl', 'en'));

comment on column public.sessions.coach_tip_locale is
  'Język rady coach_tip (pl/en). Inny niż język biegacza → aplikacja pokazuje radę z bazy coach_tips.';
comment on column public.session_reviews.note_locale is
  'Język notki note (pl/en). Inny niż język biegacza → notka jest pisana od nowa przy synchronizacji.';

-- Istniejące teksty: język po polskich znakach (krótkie polskie zdania prawie zawsze je mają).
-- Pomyłka działa bezpiecznie: polski tekst bez znaków uznany za angielski zostaje zastąpiony radą z bazy
-- albo nową notką, angielski nigdy nie zostanie uznany za polski.
update public.sessions
set coach_tip_locale = case when coach_tip ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]' then 'pl' else 'en' end
where coach_tip is not null;

update public.session_reviews
set note_locale = case when note ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]' then 'pl' else 'en' end
where note is not null;

-- Rady od AI dostają język biegacza z profilu (w nim pisze je model przy układaniu tygodni).
create or replace function public.set_session_coach_tips(p_user_id uuid, p_tips jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_locale text;
begin
  if p_tips is null or jsonb_typeof(p_tips) <> 'object' then
    return 0;
  end if;

  select locale into v_locale from public.profiles where id = p_user_id;

  update public.sessions s
  set coach_tip = left(btrim(t.value), 300),
      coach_tip_locale = coalesce(v_locale, 'pl')
  from jsonb_each_text(p_tips) t,
       public.weeks w,
       public.plans p
  where s.user_id = p_user_id
    and s.type <> 'rest'
    and s.scheduled_on = t.key::date
    and btrim(t.value) <> ''
    and w.id = s.week_id
    and p.id = w.plan_id
    and p.status = 'active';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.set_session_coach_tips(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.set_session_coach_tips(uuid, jsonb) to service_role;
