-- Add project-wide circuit breakers to the shared AI reservation ledger.
-- The singleton config row is already locked in reserve_ai_cloud_usage, so
-- every request checks and reserves against these limits atomically.

alter table public.ai_cloud_config
  add column if not exists global_daily_budget_usd numeric(12, 6) not null default 5.00
    check (global_daily_budget_usd >= 0),
  add column if not exists global_daily_request_limit integer not null default 500
    check (global_daily_request_limit > 0),
  add column if not exists global_concurrency_limit integer not null default 20
    check (global_concurrency_limit > 0);

-- The former $0.01/$0.15 per-user defaults were sized for short tutor prompts
-- and would reject most document extraction/generation calls before they ran.
-- Preserve any operator-tuned values and raise only the original defaults.
update public.ai_cloud_config set free_budget_usd = 0.25 where free_budget_usd = 0.01;
update public.ai_cloud_config set premium_budget_usd = 5.00 where premium_budget_usd = 0.15;

create or replace function public.reserve_ai_cloud_usage(
  p_user_id uuid,
  p_request_id uuid,
  p_period_start date,
  p_period_end date,
  p_plan_tier text,
  p_estimated_cost_usd numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  now_utc timestamptz := timezone('utc', now());
  config_row public.ai_cloud_config%rowtype;
  period_row public.ai_usage_periods%rowtype;
  active_count integer;
  daily_count integer;
  rolling_count integer;
  concurrency_limit integer;
  monthly_limit integer;
  daily_limit integer;
  rolling_limit integer;
  budget numeric;
  global_spent numeric;
  global_reserved numeric;
  global_daily_count integer;
  global_active_count integer;
  reservation uuid;
begin
  if p_user_id is null or p_request_id is null or p_plan_tier not in ('free', 'premium') or p_estimated_cost_usd is null or p_estimated_cost_usd < 0 then
    raise exception 'invalid AI reservation';
  end if;

  select * into config_row from public.ai_cloud_config where config_id = true for update;
  if config_row.config_id is null then raise exception 'AI configuration missing'; end if;

  monthly_limit := case when p_plan_tier = 'premium' then config_row.premium_interaction_limit else config_row.free_interaction_limit end;
  budget := case when p_plan_tier = 'premium' then config_row.premium_budget_usd else config_row.free_budget_usd end;
  daily_limit := case when p_plan_tier = 'premium' then config_row.premium_daily_limit else config_row.free_daily_limit end;
  rolling_limit := case when p_plan_tier = 'premium' then config_row.premium_rolling_10m_limit else config_row.free_rolling_10m_limit end;
  concurrency_limit := case when p_plan_tier = 'premium' then config_row.premium_concurrency_limit else config_row.free_concurrency_limit end;

  insert into public.ai_usage_periods(user_id, period_start, period_end, plan_tier)
  values (p_user_id, p_period_start, p_period_end, p_plan_tier)
  on conflict (user_id, period_start) do update
    set period_end = excluded.period_end, plan_tier = excluded.plan_tier, updated_at = now_utc;

  select * into period_row
  from public.ai_usage_periods
  where user_id = p_user_id and period_start = p_period_start
  for update;

  if period_row.interaction_count + period_row.reserved_interactions >= monthly_limit then
    return jsonb_build_object('allowed', false, 'reason', 'monthly_limit', 'used', period_row.interaction_count,
      'limit', monthly_limit, 'remaining', greatest(monthly_limit - period_row.interaction_count, 0),
      'periodStart', p_period_start, 'periodEnd', p_period_end, 'plan', p_plan_tier);
  end if;

  if period_row.cloud_cost_usd + period_row.reserved_cost_usd + p_estimated_cost_usd > budget then
    return jsonb_build_object('allowed', false, 'reason', 'cloud_budget', 'used', period_row.interaction_count,
      'limit', monthly_limit, 'remaining', greatest(monthly_limit - period_row.interaction_count, 0),
      'periodStart', p_period_start, 'periodEnd', p_period_end, 'plan', p_plan_tier);
  end if;

  select count(*) into daily_count from public.ai_usage_events
  where user_id = p_user_id and created_at >= now_utc - interval '24 hours';
  select count(*) into rolling_count from public.ai_usage_events
  where user_id = p_user_id and created_at >= now_utc - interval '10 minutes';
  select count(*) into active_count from public.ai_usage_reservations
  where user_id = p_user_id and status = 'reserved';

  if daily_count + period_row.reserved_interactions >= daily_limit then
    return jsonb_build_object('allowed', false, 'reason', 'daily_limit');
  elsif rolling_count + active_count >= rolling_limit then
    return jsonb_build_object('allowed', false, 'reason', 'rolling_limit');
  elsif active_count >= concurrency_limit then
    return jsonb_build_object('allowed', false, 'reason', 'concurrency_limit');
  end if;

  select coalesce(sum(actual_cost_usd), 0) into global_spent
  from public.ai_usage_events
  where created_at >= date_trunc('day', now_utc);

  select coalesce(sum(reserved_cost_usd), 0), count(*)
    into global_reserved, global_active_count
  from public.ai_usage_reservations
  where status = 'reserved';

  select count(*) into global_daily_count
  from public.ai_usage_events
  where created_at >= date_trunc('day', now_utc);

  if global_daily_count + global_active_count >= config_row.global_daily_request_limit then
    return jsonb_build_object('allowed', false, 'reason', 'global_daily_limit');
  elsif global_active_count >= config_row.global_concurrency_limit then
    return jsonb_build_object('allowed', false, 'reason', 'global_concurrency_limit');
  elsif global_spent + global_reserved + p_estimated_cost_usd > config_row.global_daily_budget_usd then
    return jsonb_build_object('allowed', false, 'reason', 'global_daily_budget');
  end if;

  insert into public.ai_usage_reservations(request_id, user_id, period_start, period_end, plan_tier, reserved_cost_usd)
  values (p_request_id, p_user_id, p_period_start, p_period_end, p_plan_tier, p_estimated_cost_usd)
  returning reservation_id into reservation;

  update public.ai_usage_periods
  set reserved_interactions = reserved_interactions + 1,
      reserved_cost_usd = reserved_cost_usd + p_estimated_cost_usd,
      updated_at = now_utc
  where user_id = p_user_id and period_start = p_period_start;

  return jsonb_build_object('allowed', true, 'reservationId', reservation, 'used', period_row.interaction_count,
    'limit', monthly_limit, 'remaining', greatest(monthly_limit - period_row.interaction_count - 1, 0),
    'periodStart', p_period_start, 'periodEnd', p_period_end, 'plan', p_plan_tier);
end;
$$;

revoke all on function public.reserve_ai_cloud_usage(uuid, uuid, date, date, text, numeric) from public, anon, authenticated;
grant execute on function public.reserve_ai_cloud_usage(uuid, uuid, date, date, text, numeric) to service_role;

create or replace function public.release_stale_ai_reservations(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  released_count integer := 0;
begin
  if p_user_id is null then raise exception 'user id is required'; end if;

  with released as (
    update public.ai_usage_reservations
    set status = 'released', finished_at = timezone('utc', now())
    where user_id = p_user_id
      and status = 'reserved'
      and created_at < timezone('utc', now()) - interval '5 minutes'
    returning 1
  )
  select count(*) into released_count from released;

  update public.ai_usage_periods period
  set reserved_interactions = coalesce((
        select count(*) from public.ai_usage_reservations reservation
        where reservation.user_id = period.user_id
          and reservation.period_start = period.period_start
          and reservation.status = 'reserved'
      ), 0),
      reserved_cost_usd = coalesce((
        select sum(reservation.reserved_cost_usd) from public.ai_usage_reservations reservation
        where reservation.user_id = period.user_id
          and reservation.period_start = period.period_start
          and reservation.status = 'reserved'
      ), 0),
      updated_at = timezone('utc', now())
  where period.user_id = p_user_id;

  return released_count;
end;
$$;

revoke all on function public.release_stale_ai_reservations(uuid) from public, anon, authenticated;
grant execute on function public.release_stale_ai_reservations(uuid) to service_role;
