-- Schemat analytics: widoki KPI dla panelu (docs/PROJECT.md, sekcja 10 „Miary sukcesu MVP”).
-- Tylko agregaty – bez treści notatek i samopoczucia konkretnych osób.
-- Gdy danych przybędzie, ciężkie widoki zamienimy na zmaterializowane odświeżane przez pg_cron.

-- Lista oczekujących: zapisy dziennie.
create view analytics.waitlist_daily as
select
  (created_at at time zone 'Europe/Warsaw')::date       as day,
  count(*)                                               as signups,
  count(*) filter (where marketing_consent)              as with_marketing_consent,
  count(*) filter (where referred_by is not null)        as from_referral
from marketing.waitlist_signups
group by 1;

-- Lista oczekujących: źródła (UTM) i statusy.
create view analytics.waitlist_by_source as
select
  coalesce(utm_source, '(direct)')                       as source,
  coalesce(utm_campaign, '')                             as campaign,
  count(*)                                               as signups,
  count(*) filter (where status = 'invited')             as invited,
  count(*) filter (where status = 'joined')              as joined
from marketing.waitlist_signups
group by 1, 2;

-- Aktywni tygodniowo: użytkownik z check-inem albo odhaczonym treningiem w danym tygodniu.
create view analytics.active_users_weekly as
with activity as (
  select user_id, day as activity_day from public.check_ins
  union all
  select user_id, scheduled_on from public.sessions where status in ('done', 'partial')
)
select
  date_trunc('week', activity_day)::date                 as week,
  count(distinct user_id)                                as active_users
from activity
group by 1;

-- Retencja: % użytkowników aktywnych w 4. i 8. tygodniu od rejestracji (kohorty tygodniowe).
create view analytics.retention_cohorts as
with cohort as (
  select id as user_id, date_trunc('week', created_at)::date as cohort_week
  from public.profiles
),
activity as (
  select user_id, day as activity_day from public.check_ins
  union all
  select user_id, scheduled_on from public.sessions where status in ('done', 'partial')
),
weeks_active as (
  select distinct c.user_id, c.cohort_week,
         ((a.activity_day - c.cohort_week) / 7)::int as week_no
  from cohort c
  join activity a on a.user_id = c.user_id
)
select
  c.cohort_week,
  count(distinct c.user_id)                                                           as users,
  count(distinct w.user_id) filter (where w.week_no = 4)                              as active_week_4,
  count(distinct w.user_id) filter (where w.week_no = 8)                              as active_week_8,
  round(100.0 * count(distinct w.user_id) filter (where w.week_no = 4)
        / nullif(count(distinct c.user_id), 0), 1)                                    as pct_week_4,
  round(100.0 * count(distinct w.user_id) filter (where w.week_no = 8)
        / nullif(count(distinct c.user_id), 0), 1)                                    as pct_week_8
from cohort c
left join weeks_active w on w.user_id = c.user_id
group by 1;

-- % dni treningowych z check-inem (wypełnionym, nie „Pomiń”).
create view analytics.checkin_rate_weekly as
select
  date_trunc('week', s.scheduled_on)::date               as week,
  count(*)                                               as training_days,
  count(ci.id) filter (where not ci.skipped)             as with_checkin,
  round(100.0 * count(ci.id) filter (where not ci.skipped) / nullif(count(*), 0), 1) as pct
from public.sessions s
left join public.check_ins ci on ci.user_id = s.user_id and ci.day = s.scheduled_on
where s.type <> 'rest' and s.scheduled_on <= current_date
group by 1;

-- % zaakceptowanych propozycji zmian, wg poziomu 0–4 i źródła.
create view analytics.adjustment_acceptance as
select
  level,
  source,
  count(*)                                               as proposed,
  count(*) filter (where status = 'accepted')            as accepted,
  count(*) filter (where status = 'rejected')            as rejected,
  round(100.0 * count(*) filter (where status = 'accepted')
        / nullif(count(*) filter (where status <> 'proposed'), 0), 1) as pct_accepted
from public.adjustments
group by 1, 2;

-- % wykonanych jednostek (także po adaptacji).
create view analytics.plan_completion_weekly as
select
  date_trunc('week', scheduled_on)::date                 as week,
  count(*)                                               as planned,
  count(*) filter (where status = 'done')                as done,
  count(*) filter (where status = 'partial')             as partial,
  count(*) filter (where status = 'missed')              as missed,
  round(100.0 * count(*) filter (where status in ('done', 'partial')) / nullif(count(*), 0), 1) as pct_completed
from public.sessions
where type <> 'rest' and scheduled_on <= current_date
group by 1;

-- Koszty AI dziennie.
create view analytics.ai_costs_daily as
select
  (created_at at time zone 'Europe/Warsaw')::date        as day,
  function_name,
  model,
  count(*)                                               as calls,
  sum(input_tokens)                                      as input_tokens,
  sum(output_tokens)                                     as output_tokens,
  round(sum(cost_usd), 4)                                as cost_usd,
  round(avg(duration_ms))                                as avg_duration_ms,
  count(*) filter (where error is not null)              as errors,
  count(*) filter (where validation_status in ('corrected', 'rejected', 'fallback')) as not_ok
from ops.ai_calls
group by 1, 2, 3;

grant select on all tables in schema analytics to service_role;
