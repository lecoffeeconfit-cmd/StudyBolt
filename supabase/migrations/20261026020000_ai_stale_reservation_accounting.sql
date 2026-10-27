-- If an Edge Function disappears after an AI request starts, settle the held
-- estimate as a conservative usage event instead of silently releasing it.
create index if not exists ai_usage_reservations_stale_idx
  on public.ai_usage_reservations(created_at)
  where status = 'reserved';

create or replace function public.release_stale_ai_reservations(p_user_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare settled_count integer := 0;
begin
  with settled as (
    update public.ai_usage_reservations
    set status = 'reconciled', finished_at = timezone('utc', now())
    where (p_user_id is null or user_id = p_user_id)
      and status = 'reserved'
      and created_at < timezone('utc', now()) - interval '5 minutes'
    returning reservation_id, request_id, user_id, period_start, period_end, plan_tier, reserved_cost_usd
  ), totals as (
    select user_id, period_start, count(*)::integer interaction_count, sum(reserved_cost_usd) cost_usd
    from settled
    group by user_id, period_start
  ), adjusted_periods as (
    update public.ai_usage_periods period
    set reserved_interactions = greatest(period.reserved_interactions - totals.interaction_count, 0),
        reserved_cost_usd = greatest(period.reserved_cost_usd - totals.cost_usd, 0),
        interaction_count = period.interaction_count + totals.interaction_count,
        cloud_cost_usd = period.cloud_cost_usd + totals.cost_usd,
        updated_at = timezone('utc', now())
    from totals
    where period.user_id = totals.user_id and period.period_start = totals.period_start
    returning period.user_id
  ), inserted_events as (
    insert into public.ai_usage_events(
      reservation_id, request_id, user_id, plan_tier, action, route_used, model, depth,
      input_tokens, cached_input_tokens, output_tokens, reasoning_tokens,
      estimated_cost_usd, actual_cost_usd, metadata
    )
    select reservation_id, request_id, user_id, plan_tier, 'ai_reservation_timeout', 'cloud', null, 'normal',
      0, 0, 0, 0, reserved_cost_usd, reserved_cost_usd,
      jsonb_build_object('accounting', 'estimated_after_edge_timeout', 'estimatedCostSettled', reserved_cost_usd)
    from settled
    returning 1
  )
  select count(*) into settled_count from inserted_events;

  return settled_count;
end;
$$;

revoke all on function public.release_stale_ai_reservations(uuid) from public, anon, authenticated;
grant execute on function public.release_stale_ai_reservations(uuid) to service_role;
