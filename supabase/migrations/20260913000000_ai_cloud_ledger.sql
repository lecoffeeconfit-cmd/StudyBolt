-- Server-managed AI routing configuration and atomic cloud-usage ledger.
-- Clients never receive table write access. Edge Functions use service_role.

create table if not exists public.ai_cloud_config (
  config_id boolean primary key default true check (config_id = true),
  model text not null default 'gpt-5.6-luna',
  default_reasoning text not null default 'low' check (default_reasoning in ('none', 'low', 'medium', 'high')),
  input_price_per_million numeric(12, 6) not null default 0.20,
  cached_input_price_per_million numeric(12, 6) not null default 0.02,
  output_price_per_million numeric(12, 6) not null default 1.20,
  max_revenue_share numeric(6, 4) not null default 0.15 check (max_revenue_share between 0 and 1),
  free_interaction_limit integer not null default 10 check (free_interaction_limit > 0),
  premium_interaction_limit integer not null default 250 check (premium_interaction_limit > 0),
  free_budget_usd numeric(12, 6) not null default 0.01 check (free_budget_usd >= 0),
  premium_budget_usd numeric(12, 6) not null default 0.15 check (premium_budget_usd >= 0),
  free_daily_limit integer not null default 10 check (free_daily_limit > 0),
  premium_daily_limit integer not null default 50 check (premium_daily_limit > 0),
  free_rolling_10m_limit integer not null default 5 check (free_rolling_10m_limit > 0),
  premium_rolling_10m_limit integer not null default 20 check (premium_rolling_10m_limit > 0),
  free_concurrency_limit integer not null default 2 check (free_concurrency_limit > 0),
  premium_concurrency_limit integer not null default 5 check (premium_concurrency_limit > 0),
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.ai_cloud_config(config_id)
values (true)
on conflict (config_id) do nothing;

create table if not exists public.ai_usage_periods (
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  plan_tier text not null check (plan_tier in ('free', 'premium')),
  interaction_count integer not null default 0 check (interaction_count >= 0),
  reserved_interactions integer not null default 0 check (reserved_interactions >= 0),
  cloud_cost_usd numeric(12, 6) not null default 0 check (cloud_cost_usd >= 0),
  reserved_cost_usd numeric(12, 6) not null default 0 check (reserved_cost_usd >= 0),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, period_start)
);

create table if not exists public.ai_usage_reservations (
  reservation_id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  plan_tier text not null check (plan_tier in ('free', 'premium')),
  reserved_cost_usd numeric(12, 6) not null check (reserved_cost_usd >= 0),
  status text not null default 'reserved' check (status in ('reserved', 'reconciled', 'released')),
  created_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz
);

create index if not exists ai_usage_reservations_user_active_idx
  on public.ai_usage_reservations(user_id, created_at desc)
  where status = 'reserved';

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.ai_usage_reservations(reservation_id),
  request_id uuid not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_tier text not null check (plan_tier in ('free', 'premium')),
  action text not null,
  route_used text not null check (route_used in ('cloud', 'on-device', 'deterministic')),
  model text,
  depth text,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  cached_input_tokens integer not null default 0 check (cached_input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  reasoning_tokens integer not null default 0 check (reasoning_tokens >= 0),
  estimated_cost_usd numeric(12, 6) not null default 0 check (estimated_cost_usd >= 0),
  actual_cost_usd numeric(12, 6) not null default 0 check (actual_cost_usd >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists ai_usage_events_user_recent_idx
  on public.ai_usage_events(user_id, created_at desc);

alter table public.ai_cloud_config enable row level security;
alter table public.ai_usage_periods enable row level security;
alter table public.ai_usage_reservations enable row level security;
alter table public.ai_usage_events enable row level security;

revoke all on public.ai_cloud_config from anon, authenticated;
revoke all on public.ai_usage_periods from anon, authenticated;
revoke all on public.ai_usage_reservations from anon, authenticated;
revoke all on public.ai_usage_events from anon, authenticated;
grant select on public.ai_cloud_config, public.ai_usage_periods to service_role;
grant all on public.ai_usage_reservations, public.ai_usage_events to service_role;

drop policy if exists "users can view their AI periods" on public.ai_usage_periods;
create policy "users can view their AI periods"
  on public.ai_usage_periods for select to authenticated using (user_id = auth.uid());

drop policy if exists "users can view their AI events" on public.ai_usage_events;
create policy "users can view their AI events"
  on public.ai_usage_events for select to authenticated using (user_id = auth.uid());

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
  reservation uuid;
begin
  if p_user_id is null or p_request_id is null or p_plan_tier not in ('free', 'premium') or p_estimated_cost_usd < 0 then
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

create or replace function public.reconcile_ai_cloud_usage(
  p_reservation_id uuid,
  p_request_id uuid,
  p_action text,
  p_route_used text,
  p_model text,
  p_depth text,
  p_input_tokens integer,
  p_cached_input_tokens integer,
  p_output_tokens integer,
  p_reasoning_tokens integer,
  p_estimated_cost_usd numeric,
  p_actual_cost_usd numeric,
  p_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  reservation_row public.ai_usage_reservations%rowtype;
  now_utc timestamptz := timezone('utc', now());
begin
  select * into reservation_row from public.ai_usage_reservations
  where reservation_id = p_reservation_id and request_id = p_request_id for update;
  if reservation_row.reservation_id is null or reservation_row.status <> 'reserved' then return false; end if;

  update public.ai_usage_reservations set status = 'reconciled', finished_at = now_utc where reservation_id = p_reservation_id;
  update public.ai_usage_periods
  set reserved_interactions = greatest(reserved_interactions - 1, 0),
      reserved_cost_usd = greatest(reserved_cost_usd - reservation_row.reserved_cost_usd, 0),
      interaction_count = interaction_count + 1,
      cloud_cost_usd = cloud_cost_usd + greatest(coalesce(p_actual_cost_usd, 0), 0),
      updated_at = now_utc
  where user_id = reservation_row.user_id and period_start = reservation_row.period_start;
  insert into public.ai_usage_events(
    reservation_id, request_id, user_id, plan_tier, action, route_used, model, depth,
    input_tokens, cached_input_tokens, output_tokens, reasoning_tokens,
    estimated_cost_usd, actual_cost_usd, metadata
  ) values (
    reservation_row.reservation_id, reservation_row.request_id, reservation_row.user_id, reservation_row.plan_tier,
    left(coalesce(p_action, 'ask'), 80), left(coalesce(p_route_used, 'cloud'), 30), left(coalesce(p_model, ''), 120), left(coalesce(p_depth, 'normal'), 20),
    greatest(coalesce(p_input_tokens, 0), 0), greatest(coalesce(p_cached_input_tokens, 0), 0), greatest(coalesce(p_output_tokens, 0), 0), greatest(coalesce(p_reasoning_tokens, 0), 0),
    greatest(coalesce(p_estimated_cost_usd, 0), 0), greatest(coalesce(p_actual_cost_usd, 0), 0), coalesce(p_metadata, '{}'::jsonb)
  );
  return true;
end;
$$;

create or replace function public.release_ai_cloud_usage(p_reservation_id uuid, p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  reservation_row public.ai_usage_reservations%rowtype;
begin
  select * into reservation_row from public.ai_usage_reservations
  where reservation_id = p_reservation_id and request_id = p_request_id for update;
  if reservation_row.reservation_id is null or reservation_row.status <> 'reserved' then return false; end if;
  update public.ai_usage_reservations set status = 'released', finished_at = timezone('utc', now()) where reservation_id = p_reservation_id;
  update public.ai_usage_periods
  set reserved_interactions = greatest(reserved_interactions - 1, 0),
      reserved_cost_usd = greatest(reserved_cost_usd - reservation_row.reserved_cost_usd, 0),
      updated_at = timezone('utc', now())
  where user_id = reservation_row.user_id and period_start = reservation_row.period_start;
  return true;
end;
$$;

revoke all on function public.reserve_ai_cloud_usage(uuid, uuid, date, date, text, numeric) from public, anon, authenticated;
revoke all on function public.reconcile_ai_cloud_usage(uuid, uuid, text, text, text, text, integer, integer, integer, integer, numeric, numeric, jsonb) from public, anon, authenticated;
revoke all on function public.release_ai_cloud_usage(uuid, uuid) from public, anon, authenticated;
grant execute on function public.reserve_ai_cloud_usage(uuid, uuid, date, date, text, numeric) to service_role;
grant execute on function public.reconcile_ai_cloud_usage(uuid, uuid, text, text, text, text, integer, integer, integer, integer, numeric, numeric, jsonb) to service_role;
grant execute on function public.release_ai_cloud_usage(uuid, uuid) to service_role;
