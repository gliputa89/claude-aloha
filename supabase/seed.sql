-- Dane testowe dla lokalnego środowiska (`pnpm db:reset`). Nie trafiają na staging ani produkcję.

insert into marketing.waitlist_signups (email, goal, plan_breaker, marketing_consent, marketing_consent_at, utm_source, utm_campaign)
values
  ('ania@example.com',   '10k',  'praca do późna',      true,  now(), 'facebook',  'grupy-biegowe'),
  ('tomek@example.com',  'half', 'dzieci chorują',      false, null,  'instagram', 'reels-1'),
  ('kasia@example.com',  '5k',   'brak motywacji zimą', true,  now(), null,        null);

-- Polecenie: Tomek polecił Marka.
insert into marketing.waitlist_signups (email, goal, referred_by)
select 'marek@example.com', 'general', id from marketing.waitlist_signups where email = 'tomek@example.com';

insert into ops.feature_flags (key, enabled, description)
values
  ('ai_checkin_interpret', true,  'Interpretacja check-inu przez Claude API (inaczej tylko reguły)'),
  ('beta_signup_open',     false, 'Otwarte zapisy do bety ze strony');
