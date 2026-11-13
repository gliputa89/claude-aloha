-- Przy set_main trener może podać także durationMin – wtedy trening zmienia długość razem z częścią główną
-- (silnik: execute('set_main') w packages/plan-engine/src/ai/ai-ops.ts). Bez tego zdjęty czas wchodził w rozgrzewkę
-- i schłodzenie, a trener obiecywał biegaczowi krótszy trening, który wcale krótszy nie był.
-- Dopisujemy zdanie do zapisanych wersji promptu 'coach-chat' (ops.ai_prompts), tak jak we wbudowanym (chat/prompt.ts).

update ops.ai_prompts
set system_prompt = replace(system_prompt,
      '- Część główna to 1–12 serii; repeat 1–30, odcinek od 10 sekund do 60 minut.',
      '- Przy set_main możesz podać też durationMin, jeśli trening ma być krótszy albo dłuższy (zaokrąglone do 5). Bez tego długość treningu zostaje ta sama, a czas zdjęty z części głównej wchodzi w rozgrzewkę i schłodzenie – więc gdy zabierasz powtórzenia „na krócej”, podaj durationMin i nie obiecuj krótszego treningu bez niego.
- Część główna to 1–12 serii; repeat 1–30, odcinek od 10 sekund do 60 minut.')
where function_name = 'coach-chat' and system_prompt like '%set_main%' and system_prompt not like '%podaj durationMin%';
