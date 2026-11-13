-- Trener AI może przenieść trening na dowolny wolny dzień: także na dziś przed startem planu, na dzień spoza ankiety
-- i do innego tygodnia (silnik: checkChatChange w packages/plan-engine/src/chat/chat.ts). Dopisujemy do zapisanych
-- wersji promptu 'coach-chat' (ops.ai_prompts) to samo zdanie co we wbudowanym (chat/prompt.ts). Wersja, w której
-- ktoś zmienił to zdanie w panelu, zostaje bez zmian – trzeba ją poprawić ręcznie.

update ops.ai_prompts
set system_prompt = replace(system_prompt,
      'move (przenieś trening z date na toDate – tylko na dzień z plan.freeDays w tym samym tygodniu)',
      'move (przenieś trening z date na toDate – na dowolny dzień z plan.freeDays, także na dziś, na dzień spoza ankiety i do innego tygodnia; biegacz decyduje, kiedy biega)')
where function_name = 'coach-chat' and system_prompt like '%tylko na dzień z plan.freeDays w tym samym tygodniu%';
