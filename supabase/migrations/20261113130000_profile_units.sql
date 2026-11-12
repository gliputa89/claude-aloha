-- Jednostki biegacza: km · °C (metric) albo mile · °F (imperial). Wybiera się je w Profilu aplikacji
-- (na start z ustawień telefonu); aplikacja zapisuje je tu, żeby trener AI pisał w nich notki,
-- odpowiedzi na czacie, rady w planie i prognozę startu. Dane w bazie zostają metryczne.

alter table public.profiles
  add column units text not null default 'metric'
    check (units in ('metric', 'imperial'));

comment on column public.profiles.units is
  'Jednostki w tekstach dla biegacza: metric (km, °C) albo imperial (mile, °F). Ustawiane z aplikacji (Profil).';
