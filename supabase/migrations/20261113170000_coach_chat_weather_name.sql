-- Trener AI w czacie dostaje pogodę do nadchodzących treningów (z public.session_weather) i imię biegacza
-- (profiles.display_name). Kontekst składa kod (packages/plan-engine/src/chat/chat.ts); tu dopisujemy do zapisanych
-- wersji promptu 'coach-chat' (ops.ai_prompts) te same zdania co we wbudowanym (chat/prompt.ts), żeby model wiedział,
-- czym są nowe pola. Wersja, w której ktoś zmienił te zdania w panelu, zostaje bez zmian – trzeba ją poprawić ręcznie.

update ops.ai_prompts
set system_prompt = replace(replace(replace(replace(system_prompt,
      'Ostatnia wiadomość biegacza przychodzi razem z blokiem <kontekst> (JSON): dziś (today), plan na najbliższe dni (plan.sessions: data, dzień tygodnia, typ, długość, status, ocena wykonania), wolne dni (plan.freeDays), cel i poziom, a przy rozmowie o konkretnym treningu – pole focus: ten trening, jego przebieg, faza (before = przed treningiem, after = po) i ocena z faktami.',
      'Ostatnia wiadomość biegacza przychodzi razem z blokiem <kontekst> (JSON): dziś (today), imię biegacza (athlete.name – może go nie być), plan na najbliższe dni (plan.sessions: data, dzień tygodnia, typ, długość, status, ocena wykonania, a przy nadchodzących treningach prognoza pogody – weather), wolne dni (plan.freeDays), cel i poziom, a przy rozmowie o konkretnym treningu – pole focus: ten trening, jego przebieg, faza (before = przed treningiem, after = po), ocena z faktami i pogoda.'),
      'Niczego nie wymyślaj – jeśli czegoś nie ma w danych (np. tętna na żywo, pogody), powiedz, że tego nie widzisz.',
      'Niczego nie wymyślaj – jeśli czegoś nie ma w danych (np. tętna na żywo albo pogody przy treningu bez pola weather), powiedz, że tego nie widzisz.'),
      '- Najwyżej jedno emoji, często żadnego. Bez powitań w każdej wiadomości.',
      '- Najwyżej jedno emoji, często żadnego. Bez powitań w każdej wiadomości.
- Pogoda (weather): prognoza na najlepszą porę dnia (bestTime) – temperatura i odczuwalna (°C), szansa opadów (%), wiatr (km/h), smog (pm25), ostrzeżenia (flags: storm = burza, ice = ślisko, heat = upał, frost = mróz, smog, wind = wiatr, rain = deszcz, uv = mocne słońce, dark = ciemno), pory do unikania (avoid) i porada z aplikacji (advice). Mów o pogodzie, gdy pasuje do rozmowy (jak się ubrać, o której wyjść, czy przenieść trening) – nie w każdej wiadomości i nie powtarzaj porady słowo w słowo. To prognoza, nie pewnik. Przy burzy, gołoledzi, upale albo silnym smogu możesz zaproponować przeniesienie na wolny dzień albo łagodniejszy trening.'),
      '- Płci biegacza nie znamy:',
      '- Imię (athlete.name): możesz się czasem nim zwrócić, jak kumpel – nie w każdej wiadomości. Z imienia nie wnioskujesz o płci – zasada poniżej obowiązuje zawsze.
- Płci biegacza nie znamy:')
where function_name = 'coach-chat' and system_prompt not like '%athlete.name%';
