-- Schemat marketing: lista oczekujących, polecenia, zaproszenia do bety.
-- Zapis: Server Action w apps/web (service_role). Odczyt: apps/admin (service_role).

create table marketing.waitlist_signups (
  id                    uuid primary key default gen_random_uuid(),
  email                 extensions.citext not null unique
                          check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  locale                text not null default 'pl' check (locale in ('pl', 'en')),
  -- cel biegowy z formularza, np. '5k', '10k', 'half', 'marathon', 'general'
  goal                  text,
  -- „co najczęściej psuje Ci plan” – odpowiedź z formularza
  plan_breaker          text check (char_length(plan_breaker) <= 500),
  marketing_consent     boolean not null default false,
  marketing_consent_at  timestamptz,
  consent_text_version  text,
  utm_source            text,
  utm_medium            text,
  utm_campaign          text,
  utm_content           text,
  utm_term              text,
  referrer_url          text,
  -- własny kod polecający osoby zapisanej (do linku ?ref=)
  referral_code         text not null unique
                          default lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  -- kto polecił (polecenia = wiersze z ustawionym referred_by)
  referred_by           uuid references marketing.waitlist_signups (id) on delete set null,
  status                text not null default 'waiting'
                          check (status in ('waiting', 'invited', 'joined', 'unsubscribed')),
  -- konto w aplikacji po dołączeniu (łączone po e-mailu)
  user_id               uuid references auth.users (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint marketing_consent_has_date
    check (not marketing_consent or marketing_consent_at is not null)
);

create index waitlist_signups_created_at_idx on marketing.waitlist_signups (created_at);
create index waitlist_signups_referred_by_idx on marketing.waitlist_signups (referred_by);
create index waitlist_signups_utm_source_idx on marketing.waitlist_signups (utm_source);

create trigger waitlist_signups_updated_at
  before update on marketing.waitlist_signups
  for each row execute function public.set_updated_at();

-- Polecenia: kto kogo polecił (widok na waitlist_signups.referred_by).
create view marketing.referrals as
select
  r.id          as referrer_id,
  r.email       as referrer_email,
  r.referral_code,
  s.id          as referred_id,
  s.email       as referred_email,
  s.created_at  as referred_at
from marketing.waitlist_signups s
join marketing.waitlist_signups r on r.id = s.referred_by;

create table marketing.beta_invites (
  id           uuid primary key default gen_random_uuid(),
  signup_id    uuid references marketing.waitlist_signups (id) on delete set null,
  email        extensions.citext not null,
  code         text not null unique
                 default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  -- np. 'beta-1', 'beta-2' – fala zaproszeń
  cohort       text,
  sent_at      timestamptz,
  accepted_at  timestamptz,
  user_id      uuid references auth.users (id) on delete set null,
  expires_at   timestamptz,
  created_at   timestamptz not null default now()
);

create index beta_invites_email_idx on marketing.beta_invites (email);

-- Wszystko w tym schemacie tylko dla service_role (RLS jako dodatkowa bariera).
alter table marketing.waitlist_signups enable row level security;
alter table marketing.beta_invites enable row level security;
