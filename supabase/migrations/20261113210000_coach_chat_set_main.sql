-- Trener AI może zmieniać intensywność i liczbę powtórzeń, nie tylko czas treningu: do propozycji z czatu dochodzi
-- operacja set_main (nowa część główna jako serie: powtórzenia × odcinek + przerwa, każda ze strefą wysiłku) –
-- silnik: CHAT_CHANGE_KINDS i checkChatChange w packages/plan-engine/src/chat/chat.ts. Do kontekstu trafia też
-- przebieg treningu z zadanym tempem (plan.sessions[].steps), bo dotąd trener widział tylko typ i długość.
-- Dopisujemy do zapisanych wersji promptu 'coach-chat' (ops.ai_prompts) to samo, co we wbudowanym (chat/prompt.ts).
-- Wersja, w której ktoś zmienił te zdania w panelu, zostaje bez zmian – trzeba ją poprawić ręcznie.

update ops.ai_prompts
set system_prompt = replace(system_prompt,
      '- Dozwolone: move (przenieś trening z date na toDate – na dowolny dzień z plan.freeDays, także na dziś, na dzień spoza ankiety i do innego tygodnia; biegacz decyduje, kiedy biega), set_duration (zmień długość, durationMin zaokrąglone do 5), set_type (zmień rodzaj, np. interwały → spokojny bieg; opcjonalnie durationMin), remove (odpuść trening).',
      '- Dozwolone: move (przenieś trening z date na toDate – na dowolny dzień z plan.freeDays, także na dziś, na dzień spoza ankiety i do innego tygodnia; biegacz decyduje, kiedy biega), set_duration (zmień długość, durationMin zaokrąglone do 5), set_type (zmień rodzaj, np. interwały → spokojny bieg; opcjonalnie durationMin), set_main (ułóż od nowa część główną treningu), remove (odpuść trening).
- set_main to Twój sposób na intensywność i liczbę powtórzeń – nie tylko czas. Używaj go, gdy biegacz prosi o wolniej, mocniej, mniej albo więcej powtórzeń, krótsze albo dłuższe odcinki, dłuższą przerwę. W change.sets podajesz serie części głównej po kolei: repeat (ile powtórzeń), workS (czas odcinka w sekundach), workZone (strefa odcinka), recoveryS (przerwa w sekundach albo null), recoveryZone (strefa przerwy albo null). Rozgrzewkę i schłodzenie dokłada aplikacja – nie wpisuj ich w sets.
- Strefy wysiłku od najlżejszej: walk (marsz), recovery (trucht), easy (spokojnie, w tempie rozmowy), steady (umiarkowanie), tempo (mocno, ale pod kontrolą), interval (bardzo mocno), sprint (przebieżka). Łagodniej = niższa strefa, mocniej = wyższa. Pole steps pokazuje, jak trening wygląda teraz (odcinki, strefy i zadane tempo w min/km) – wychodź od tego i zmieniaj tylko to, o co prosi biegacz.
- Zadane tempo odcinków wylicza aplikacja ze strefy i ostatniego wyniku biegacza – sam go nie wpisujesz. Jeśli biegacz mówi, że zadane tempo jest dla niego za szybkie, zejdź set_main na niższą strefę zamiast tłumaczyć, że tempa nie da się zmienić.
- Część główna to 1–12 serii; repeat 1–30, odcinek od 10 sekund do 60 minut. Reguły (ile mocnych minut mieści się w treningu, przeciwwskazania, poziom biegacza) sprawdza aplikacja – jeśli zmiana ich nie przejdzie, dostaniesz powód do poprawki.')
where function_name = 'coach-chat' and system_prompt like '%remove (odpuść trening).%' and system_prompt not like '%set_main%';

update ops.ai_prompts
set system_prompt = replace(system_prompt,
      'plan na najbliższe dni (plan.sessions: data, dzień tygodnia, typ, długość, status, ocena wykonania',
      'plan na najbliższe dni (plan.sessions: data, dzień tygodnia, typ, długość, przebieg treningu z zadanym tempem – steps, status, ocena wykonania')
where function_name = 'coach-chat' and system_prompt like '%typ, długość, status, ocena wykonania%';
