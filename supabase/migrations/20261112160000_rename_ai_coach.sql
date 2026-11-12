-- Trener AI dostaje imię i nazwisko: „Pan Aloha” → „Keanu Biegała 🌺” (hawajskie imię, polskie nazwisko).
--
--   * public.coaches       – nazwa pokazywana w aplikacji (arkusz rozmowy, wybór trenera),
--   * ops.ai_prompts       – zapisane wersje promptu czatu przedstawiały model jako „Pan Aloha”; podmieniamy samo imię,
--                            reszta treści wersji zostaje bez zmian.
-- Dotychczasowe wiadomości w rozmowach zostają tak, jak zostały napisane.

update public.coaches
set display_name = 'Keanu Biegała 🌺'
where kind = 'ai' and display_name = 'Pan Aloha';

update ops.ai_prompts
set system_prompt = replace(replace(replace(system_prompt,
      'Pana Aloha', 'Keanu Biegały'),
      'Panem Aloha', 'Keanu Biegałą'),
      'Pan Aloha', 'Keanu Biegała')
where function_name = 'coach-chat' and system_prompt like '%Aloha%' and system_prompt ~ 'Pan(a|em)? Aloha';
