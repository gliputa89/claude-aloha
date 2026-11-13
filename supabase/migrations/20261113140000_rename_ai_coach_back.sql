-- Trener AI wraca do starej nazwy: „Keanu Biegała 🌺” → „Pan Aloha” (cofa 20261112160000_rename_ai_coach.sql).
--
--   * public.coaches   – nazwa pokazywana w aplikacji (arkusz rozmowy, wybór trenera),
--   * ops.ai_prompts   – zapisane wersje promptu czatu: najpierw całe zdanie przedstawienia z wbudowanego promptu,
--                        potem same formy imienia; reszta treści wersji zostaje bez zmian.
-- Dotychczasowe wiadomości w rozmowach zostają tak, jak zostały napisane.

update public.coaches
set display_name = 'Pan Aloha'
where kind = 'ai' and display_name like 'Keanu%';

update ops.ai_prompts
set system_prompt = replace(replace(replace(replace(system_prompt,
      'Nazywasz się Keanu Biegała – jesteś trenerem biegania AI w aplikacji Aloha (hawajskie imię, polskie nazwisko; na co dzień po prostu Keanu).',
      'Jesteś Pan Aloha – trener biegania w aplikacji Aloha.'),
      'Keanu Biegały', 'Pana Aloha'),
      'Keanu Biegałą', 'Panem Aloha'),
      'Keanu Biegała', 'Pan Aloha')
where function_name = 'coach-chat' and system_prompt like '%Keanu Biega%';
