-- Run only in an isolated test database after all AI ledger migrations.
-- Verifies quota reservations count before completion and preserve paid limits.
begin;

insert into auth.users(id, email, raw_user_meta_data, raw_app_meta_data, created_at) values
  ('30000000-0000-4000-8000-000000000001', 'ledger-free@example.test', '{}', '{}', now()),
  ('30000000-0000-4000-8000-000000000002', 'ledger-premium@example.test', '{}', '{"studybolt_subscription_tier":"premium"}', now());

update public.ai_cloud_config set
  free_interaction_limit = 1,
  premium_interaction_limit = 5,
  free_budget_usd = 100,
  premium_budget_usd = 100,
  free_daily_limit = 20,
  premium_daily_limit = 20,
  free_rolling_10m_limit = 20,
  premium_rolling_10m_limit = 20,
  free_concurrency_limit = 5,
  premium_concurrency_limit = 5,
  global_daily_budget_usd = 100,
  global_daily_request_limit = 100;

do $$
declare
  free_user uuid := '30000000-0000-4000-8000-000000000001';
  premium_user uuid := '30000000-0000-4000-8000-000000000002';
  free_first jsonb;
  free_second jsonb;
  premium_first jsonb;
  reconciled boolean;
begin
  free_first := public.reserve_ai_cloud_usage(free_user, '30000000-0000-4000-8000-000000000011', current_date, current_date + 30, 'free', 0.0001);
  if free_first->>'allowed' is distinct from 'true' then raise exception 'Registered free account could not reserve its allowance'; end if;

  -- A second request must see the first in-flight reservation at the monthly cap.
  free_second := public.reserve_ai_cloud_usage(free_user, '30000000-0000-4000-8000-000000000012', current_date, current_date + 30, 'free', 0.0001);
  if free_second->>'reason' is distinct from 'monthly_limit' then raise exception 'Concurrent reservation bypassed the free quota'; end if;

  reconciled := public.reconcile_ai_cloud_usage(
    (free_first->>'reservationId')::uuid,
    '30000000-0000-4000-8000-000000000011',
    'ask', 'cloud', 'fixture-model', 'normal', 10, 0, 5, 0, 0.0001, 0.0001, '{}'::jsonb
  );
  if not reconciled then raise exception 'Usage reservation could not be reconciled'; end if;
  if not exists (
    select 1 from public.ai_usage_periods
    where user_id = free_user and period_start = current_date
      and interaction_count = 1 and reserved_interactions = 0
  ) then raise exception 'Reconciliation did not settle exactly one free interaction'; end if;

  premium_first := public.reserve_ai_cloud_usage(premium_user, '30000000-0000-4000-8000-000000000021', current_date, current_date + 30, 'premium', 0.0001);
  if premium_first->>'allowed' is distinct from 'true' or premium_first->>'plan' is distinct from 'premium' then
    raise exception 'Paid account did not retain the premium quota path';
  end if;
  if premium_first->>'limit' is distinct from '5' then raise exception 'Premium quota limit was not applied'; end if;
end $$;

rollback;
