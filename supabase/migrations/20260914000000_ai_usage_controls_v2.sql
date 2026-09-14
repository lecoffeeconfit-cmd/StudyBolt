-- Add a configurable warning point and recover reservations left behind by a
-- terminated Edge Function. This is additive and safe for existing ledgers.

alter table public.ai_cloud_config
  add column if not exists soft_warning_ratio numeric(5, 4) not null default 0.80
  check (soft_warning_ratio between 0.50 and 0.98);

create index if not exists ai_usage_reservations_user_status_created_idx
  on public.ai_usage_reservations(user_id, status, created_at desc);

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
      and created_at < timezone('utc', now()) - interval '2 minutes'
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
