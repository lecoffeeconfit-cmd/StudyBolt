-- Free accounts can import one distinct PowerPoint per UTC calendar month.
-- Existing Study Packs remain local and usable after a subscription expires.

create table if not exists public.studybolt_powerpoint_import_periods (
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  imports_used integer not null default 0 check (imports_used between 0 and 1),
  updated_at timestamptz not null default now(),
  primary key (user_id, period_start)
);

create table if not exists public.studybolt_powerpoint_import_requests (
  user_id uuid not null,
  period_start date not null,
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  state text not null check (state in ('reserved', 'consumed', 'released')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, period_start, source_hash),
  foreign key (user_id, period_start)
    references public.studybolt_powerpoint_import_periods(user_id, period_start)
    on delete cascade
);

alter table public.studybolt_powerpoint_import_periods enable row level security;
alter table public.studybolt_powerpoint_import_requests enable row level security;
revoke all on public.studybolt_powerpoint_import_periods from public, anon, authenticated;
revoke all on public.studybolt_powerpoint_import_requests from public, anon, authenticated;
grant all on public.studybolt_powerpoint_import_periods to service_role;
grant all on public.studybolt_powerpoint_import_requests to service_role;

create or replace function public.claim_studybolt_powerpoint_import(
  p_user_id uuid,
  p_source_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  metadata jsonb;
  current_period date := date_trunc('month', timezone('UTC', now()))::date;
  period_row public.studybolt_powerpoint_import_periods%rowtype;
  request_row public.studybolt_powerpoint_import_requests%rowtype;
  request_found boolean;
  stale_count integer;
begin
  if p_user_id is null or p_source_hash is null or p_source_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid PowerPoint import claim';
  end if;

  select coalesce(u.raw_app_meta_data, '{}'::jsonb)
    into metadata
    from auth.users u
    where u.id = p_user_id;
  if not found then raise exception 'PowerPoint import user not found'; end if;

  if public.studybolt_has_premium(metadata) then
    return jsonb_build_object('allowed', true, 'limited', false, 'premium', true);
  end if;

  delete from public.studybolt_powerpoint_import_periods
    where user_id = p_user_id and period_start < current_period;

  insert into public.studybolt_powerpoint_import_periods(user_id, period_start)
  values (p_user_id, current_period)
  on conflict (user_id, period_start) do nothing;

  select * into period_row
    from public.studybolt_powerpoint_import_periods
    where user_id = p_user_id and period_start = current_period
    for update;

  -- A terminated upload must not consume the whole month's allowance. Release
  -- every abandoned claim, including when the learner chooses a different file.
  with stale as (
    update public.studybolt_powerpoint_import_requests
      set state = 'released', updated_at = now()
      where user_id = p_user_id and period_start = current_period
        and state = 'reserved' and created_at <= now() - interval '10 minutes'
      returning 1
  )
  select count(*) into stale_count from stale;
  if stale_count > 0 then
    update public.studybolt_powerpoint_import_periods
      set imports_used = greatest(imports_used - stale_count, 0), updated_at = now()
      where user_id = p_user_id and period_start = current_period;
    period_row.imports_used := greatest(period_row.imports_used - stale_count, 0);
  end if;

  select * into request_row
    from public.studybolt_powerpoint_import_requests
    where user_id = p_user_id and period_start = current_period and source_hash = p_source_hash
    for update;
  request_found := found;

  if request_found and request_row.state = 'consumed' then
    return jsonb_build_object('allowed', false, 'limited', true, 'premium', false, 'reason', 'already_imported', 'periodStart', current_period);
  end if;

  if request_found and request_row.state = 'reserved' then
    return jsonb_build_object('allowed', false, 'limited', true, 'premium', false, 'reason', 'in_progress', 'periodStart', current_period);
  end if;

  if period_row.imports_used >= 1 then
    return jsonb_build_object('allowed', false, 'limited', true, 'premium', false, 'reason', 'monthly_limit', 'periodStart', current_period);
  end if;

  if request_found then
    update public.studybolt_powerpoint_import_requests
      set state = 'reserved', created_at = now(), updated_at = now()
      where user_id = p_user_id and period_start = current_period and source_hash = p_source_hash;
  else
    insert into public.studybolt_powerpoint_import_requests(user_id, period_start, source_hash, state)
    values (p_user_id, current_period, p_source_hash, 'reserved');
  end if;

  update public.studybolt_powerpoint_import_periods
    set imports_used = imports_used + 1, updated_at = now()
    where user_id = p_user_id and period_start = current_period;

  return jsonb_build_object('allowed', true, 'limited', true, 'premium', false, 'periodStart', current_period, 'remaining', 0);
end;
$$;

create or replace function public.complete_studybolt_powerpoint_import(
  p_user_id uuid,
  p_period_start date,
  p_source_hash text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare changed integer;
begin
  if p_user_id is null or p_period_start is null or p_source_hash is null
     or p_source_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid PowerPoint import completion';
  end if;
  perform 1 from public.studybolt_powerpoint_import_periods
    where user_id = p_user_id and period_start = p_period_start for update;
  update public.studybolt_powerpoint_import_requests
    set state = 'consumed', updated_at = now()
    where user_id = p_user_id and period_start = p_period_start
      and source_hash = p_source_hash and state = 'reserved';
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

create or replace function public.release_studybolt_powerpoint_import(
  p_user_id uuid,
  p_period_start date,
  p_source_hash text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare changed integer;
begin
  if p_user_id is null or p_period_start is null or p_source_hash is null
     or p_source_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid PowerPoint import release';
  end if;
  -- Keep the same lock order as claims and completion: period, then request.
  perform 1 from public.studybolt_powerpoint_import_periods
    where user_id = p_user_id and period_start = p_period_start for update;
  update public.studybolt_powerpoint_import_requests
    set state = 'released', updated_at = now()
    where user_id = p_user_id and period_start = p_period_start
      and source_hash = p_source_hash and state = 'reserved';
  get diagnostics changed = row_count;
  if changed = 1 then
    update public.studybolt_powerpoint_import_periods
      set imports_used = greatest(imports_used - 1, 0), updated_at = now()
      where user_id = p_user_id and period_start = p_period_start;
  end if;
  return changed = 1;
end;
$$;

revoke all on function public.claim_studybolt_powerpoint_import(uuid, text) from public, anon, authenticated;
revoke all on function public.complete_studybolt_powerpoint_import(uuid, date, text) from public, anon, authenticated;
revoke all on function public.release_studybolt_powerpoint_import(uuid, date, text) from public, anon, authenticated;
grant execute on function public.claim_studybolt_powerpoint_import(uuid, text) to service_role;
grant execute on function public.complete_studybolt_powerpoint_import(uuid, date, text) to service_role;
grant execute on function public.release_studybolt_powerpoint_import(uuid, date, text) to service_role;
