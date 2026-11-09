-- Rady trenera w szczegółach treningu.
--
--   * public.sessions.coach_tip – rada dopasowana do osoby i treningu, pisana przez Claude przy układaniu tygodni
--                                 (pole tips w odpowiedzi 'plan-weeks', w tym samym wywołaniu – bez dodatkowych zapytań),
--   * public.coach_tips         – baza gotowych rad wg rodzaju treningu i języka: zapas, gdy rady od AI nie ma
--                                 (plan z samych reguł, błąd API). Aplikacja wybiera z niej radę stałą dla danego
--                                 treningu, ale różną między treningami,
--   * public.set_session_coach_tips – dopisuje rady od AI do zapisanych treningów (tylko service_role).

-- ───────────────────────── rada w treningu ─────────────────────────

alter table public.sessions
  add column coach_tip text check (coach_tip is null or length(coach_tip) between 1 and 300);

-- Dopisuje rady do treningów aktywnego planu: p_tips = { "YYYY-MM-DD": "tekst", ... }.
-- Wywoływana po zapisie planu / tygodnia. Zwraca liczbę uzupełnionych treningów.
create or replace function public.set_session_coach_tips(p_user_id uuid, p_tips jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_tips is null or jsonb_typeof(p_tips) <> 'object' then
    return 0;
  end if;

  update public.sessions s
  set coach_tip = left(btrim(t.value), 300)
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

-- ───────────────────────── baza rad ─────────────────────────

create table public.coach_tips (
  id            bigint generated always as identity primary key,
  session_type  text not null
                  check (session_type in ('walk_run', 'easy', 'recovery', 'long', 'intervals', 'tempo', 'race', 'rest')),
  locale        text not null check (locale in ('pl', 'en')),
  text          text not null check (length(text) between 1 and 300),
  -- opcjonalny zakres poziomów zaawansowania (1–5); null = dla każdego
  min_level     smallint check (min_level between 1 and 5),
  max_level     smallint check (max_level between 1 and 5),
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  check (min_level is null or max_level is null or min_level <= max_level)
);

create index coach_tips_lookup_idx on public.coach_tips (session_type, locale) where active;

alter table public.coach_tips enable row level security;

-- Treść rad nie jest wrażliwa – czyta każdy zalogowany, zmienia tylko service_role (panel).
create policy "coach tips: read active" on public.coach_tips
  for select to authenticated using (active);

grant select on public.coach_tips to authenticated;

insert into public.coach_tips (session_type, locale, text) values
  -- marsz-bieg
  ('walk_run', 'pl', 'Biegnij tak wolno, żeby dało się rozmawiać. Marsz to część planu, nie porażka.'),
  ('walk_run', 'pl', 'Odcinki biegu mają być lekkie. Jeśli pod koniec sapiesz – następnym razem zwolnij.'),
  ('walk_run', 'pl', 'Marsz to aktywny odpoczynek: idź żwawo, ramiona pracują, oddech się uspokaja.'),
  ('walk_run', 'pl', 'Nie skracaj marszu, nawet gdy masz siłę. Regularność buduje formę bardziej niż jeden mocny dzień.'),
  ('walk_run', 'pl', 'Krótki krok, luźne ramiona, wzrok przed siebie. Bieg ma być przyjemny.'),
  ('walk_run', 'pl', 'Każdy taki trening to cegiełka. Za kilka tygodni biegowe odcinki same się wydłużą.'),
  ('walk_run', 'en', 'Run slowly enough to chat. Walking is part of the plan, not a failure.'),
  ('walk_run', 'en', "Keep the running bits light. Huffing at the end? Go a little slower next time."),
  ('walk_run', 'en', 'The walk is active rest: walk briskly, swing your arms, let your breathing settle.'),
  ('walk_run', 'en', "Don't skip the walk breaks, even if you feel great. Consistency beats one hard day."),
  ('walk_run', 'en', 'Short steps, loose shoulders, eyes ahead. This should feel good.'),
  ('walk_run', 'en', 'Every session like this is a building block. In a few weeks the running parts will grow on their own.'),
  -- bieg spokojny
  ('easy', 'pl', 'Tempo rozmowy. Brakuje tchu? Zwolnij – spokojne bieganie buduje bazę.'),
  ('easy', 'pl', 'Spokojnie znaczy naprawdę spokojnie. Na koniec ma zostać zapas – tak, żeby dało się biec dalej.'),
  ('easy', 'pl', 'Dobry dzień na nową trasę albo bieg bez zegarka – tylko na czucie.'),
  ('easy', 'pl', 'Rozluźnij barki i dłonie. Spokojny bieg to też trening techniki.'),
  ('easy', 'pl', 'Nie ścigaj się z zegarkiem. Dziś liczy się czas w ruchu, nie tempo.'),
  ('easy', 'pl', 'Pod górę możesz przejść do marszu – to nadal spokojny bieg, a nie sprawdzian.'),
  ('easy', 'en', 'Conversation pace. Out of breath? Slow down – easy running builds your base.'),
  ('easy', 'en', 'Easy means truly easy. You should finish feeling you could keep going.'),
  ('easy', 'en', 'Good day for a new route or a run by feel, without checking your watch.'),
  ('easy', 'en', 'Relax your shoulders and hands. Easy runs are technique practice too.'),
  ('easy', 'en', "Don't race the clock. Today is about time on your feet, not pace."),
  ('easy', 'en', "It's fine to walk the hills – it's still an easy run, not a test."),
  -- rozbieganie
  ('recovery', 'pl', 'Bardzo lekko, dla rozruszania nóg. Im wolniej, tym lepiej.'),
  ('recovery', 'pl', 'To bieg na regenerację – wolniej, niż Ci się wydaje, że wypada.'),
  ('recovery', 'pl', 'Nogi ciężkie po ostatnim treningu? To normalne. Rozbieganie pomoże je rozluźnić.'),
  ('recovery', 'pl', 'Płaska trasa, miękkie podłoże, zero ambicji. Dziś odpoczywasz w ruchu.'),
  ('recovery', 'pl', 'Jeśli coś boli – skróć albo zamień na spacer. Plan się dopasuje.'),
  ('recovery', 'en', 'Very light, just to loosen your legs. The slower, the better.'),
  ('recovery', 'en', 'This is a recovery run – slower than feels respectable.'),
  ('recovery', 'en', 'Heavy legs after the last session? Normal. An easy jog will loosen them up.'),
  ('recovery', 'en', 'Flat route, soft surface, zero ambition. Today you rest on the move.'),
  ('recovery', 'en', 'If something hurts, cut it short or walk instead. The plan will adapt.'),
  -- długi bieg
  ('long', 'pl', 'Zacznij spokojniej, niż Ci się wydaje. Biegniesz ponad godzinę? Weź wodę.'),
  ('long', 'pl', 'Długi bieg to cierpliwość, nie tempo. Druga połowa ma być tak samo spokojna jak pierwsza.'),
  ('long', 'pl', 'Zjedz coś lekkiego 1–2 godziny przed wyjściem i nie zapomnij o piciu po treningu.'),
  ('long', 'pl', 'Podziel trasę w głowie na kawałki – łatwiej się biegnie od punktu do punktu.'),
  ('long', 'pl', 'Dobry dzień na przetestowanie butów i stroju na zawody – bez niespodzianek w dniu startu.'),
  ('long', 'pl', 'Po biegu kilka minut marszu i coś do jedzenia. Regeneracja zaczyna się od razu.'),
  ('long', 'en', 'Start slower than you think. Running over an hour? Take water.'),
  ('long', 'en', 'Long runs are about patience, not pace. The second half should feel as easy as the first.'),
  ('long', 'en', 'Eat something light 1–2 hours before and drink after you finish.'),
  ('long', 'en', 'Split the route into chunks in your head – it is easier to run point to point.'),
  ('long', 'en', 'Good day to test your race shoes and kit – no surprises on race day.'),
  ('long', 'en', 'Walk for a few minutes after and grab a snack. Recovery starts right away.'),
  -- interwały
  ('intervals', 'pl', 'Odcinki mocno, ale równo – ostatni tak szybki jak pierwszy. Przerwy truchtem.'),
  ('intervals', 'pl', 'Nie odpuszczaj rozgrzewki – mocne odcinki na zimnych nogach to proszenie się o kłopoty.'),
  ('intervals', 'pl', 'Pierwszy odcinek zacznij odrobinę za wolno. Lepiej przyspieszyć na końcu niż umierać w połowie.'),
  ('intervals', 'pl', 'Licz odcinki, nie kilometry. Skup się na równym rytmie i oddechu.'),
  ('intervals', 'pl', 'Czujesz, że technika się sypie? Odpuść ostatni odcinek – jakość ważniejsza niż liczba.'),
  ('intervals', 'pl', 'Płaski, znany odcinek trasy ułatwi trzymanie równego tempa.'),
  ('intervals', 'en', 'Hard but even – the last rep as fast as the first. Jog the recoveries.'),
  ('intervals', 'en', "Don't skip the warm-up – hard reps on cold legs are asking for trouble."),
  ('intervals', 'en', 'Start the first rep a touch slow. Better to finish strong than fade halfway.'),
  ('intervals', 'en', 'Count reps, not kilometres. Focus on an even rhythm and your breathing.'),
  ('intervals', 'en', 'Form falling apart? Skip the last rep – quality beats quantity.'),
  ('intervals', 'en', 'A flat, familiar stretch makes holding an even pace much easier.'),
  -- bieg w tempie
  ('tempo', 'pl', 'Równe, mocniejsze tempo: kilka słów powiesz, całego zdania już nie.'),
  ('tempo', 'pl', 'Komfortowo ciężko – to dobre określenie. Nie przyspieszaj w połowie.'),
  ('tempo', 'pl', 'Skup się na oddechu: równy, głęboki rytm pomaga utrzymać tempo.'),
  ('tempo', 'pl', 'Po rozgrzewce wejdź w tempo stopniowo, przez minutę–dwie, nie od razu.'),
  ('tempo', 'pl', 'Ten trening uczy ciało biegać szybciej dłużej. Cierpliwość popłaca.'),
  ('tempo', 'en', 'Steady, harder pace: you can say a few words, but not a full sentence.'),
  ('tempo', 'en', "Comfortably hard is the feeling. Don't speed up halfway."),
  ('tempo', 'en', 'Focus on your breathing: a steady, deep rhythm helps you hold the pace.'),
  ('tempo', 'en', 'After the warm-up, ease into the pace over a minute or two, not all at once.'),
  ('tempo', 'en', 'This session teaches your body to run faster for longer. Patience pays off.'),
  -- zawody
  ('race', 'pl', 'Zacznij spokojnie, przyspiesz w drugiej połowie. I ciesz się startem!'),
  ('race', 'pl', 'Nic nowego w dniu startu: znane buty, znane śniadanie, znany strój.'),
  ('race', 'pl', 'Bądź wcześniej, zrób spokojną rozgrzewkę i nie daj się porwać tłumowi na pierwszym kilometrze.'),
  ('race', 'pl', 'Praca jest zrobiona. Dziś po prostu ją odbierasz – powodzenia!'),
  ('race', 'en', 'Start easy, pick it up in the second half. And enjoy the race!'),
  ('race', 'en', 'Nothing new on race day: familiar shoes, breakfast and kit.'),
  ('race', 'en', "Arrive early, warm up gently and don't get swept along in the first kilometre."),
  ('race', 'en', "You've done the work. Today you just collect it – good luck!"),
  -- odpoczynek
  ('rest', 'pl', 'Dziś bez biegania. Spacer albo rozciąganie – jeśli masz ochotę.'),
  ('rest', 'pl', 'Odpoczynek to też trening. Mięśnie rosną w przerwie, nie w biegu.'),
  ('rest', 'pl', 'Dobry dzień na sen trochę dłuższy niż zwykle.'),
  ('rest', 'pl', 'Nogi Ci podziękują. Jutro wrócisz z nowymi siłami.'),
  ('rest', 'en', 'No running today. A walk or some stretching – if you feel like it.'),
  ('rest', 'en', 'Rest is training too. Your muscles get stronger in the break, not the run.'),
  ('rest', 'en', 'Good day for a bit more sleep than usual.'),
  ('rest', 'en', "Your legs will thank you. You'll be fresher tomorrow.");
