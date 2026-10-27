-- RevenueCat is the source of truth for paid subscription lifecycle events.
-- Keep StudyBolt-specific fields separate from shared auth metadata consumed
-- by other products using the same Supabase project.

create table if not exists public.studybolt_subscription_events (
  event_id text not null check (length(event_id) between 1 and 200),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  event_timestamp_ms bigint not null check (event_timestamp_ms > 0),
  outcome text not null default 'received' check (outcome in ('received', 'applied', 'stale')),
  received_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table public.studybolt_subscription_events enable row level security;
revoke all on public.studybolt_subscription_events from public, anon, authenticated;
grant all on public.studybolt_subscription_events to service_role;

create or replace function public.apply_studybolt_subscription_event(
  p_event_id text,
  p_user_id uuid,
  p_event_type text,
  p_event_timestamp_ms bigint,
  p_is_premium boolean,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  metadata jsonb;
  previous_event_ms bigint;
  active_now boolean := coalesce(p_is_premium, false) and p_expires_at is not null and p_expires_at > now();
begin
  if p_event_id is null or length(p_event_id) not between 1 and 200
     or p_user_id is null or p_event_timestamp_ms is null or p_event_timestamp_ms <= 0
     or p_event_type is null or length(p_event_type) > 80 then
    raise exception 'Invalid subscription event';
  end if;

  insert into public.studybolt_subscription_events(event_id, user_id, event_type, event_timestamp_ms)
  values (p_event_id, p_user_id, p_event_type, p_event_timestamp_ms)
  on conflict (event_id, user_id) do nothing;

  if not found then
    return jsonb_build_object('status', 'duplicate');
  end if;

  select coalesce(u.raw_app_meta_data, '{}'::jsonb)
    into metadata
    from auth.users u
    where u.id = p_user_id
    for update;

  if not found then
    raise exception 'Subscription user not found';
  end if;

  begin
    previous_event_ms := nullif(metadata->>'studybolt_subscription_event_at', '')::bigint;
  exception when invalid_text_representation or numeric_value_out_of_range then
    previous_event_ms := null;
  end;

  if previous_event_ms is not null and p_event_timestamp_ms <= previous_event_ms then
    update public.studybolt_subscription_events set outcome = 'stale' where event_id = p_event_id;
    return jsonb_build_object('status', 'stale');
  end if;

  metadata := jsonb_set(metadata, '{studybolt_subscription_tier}', to_jsonb(case when active_now then 'premium' else 'free' end), true);
  metadata := jsonb_set(metadata, '{studybolt_subscription_expires_at}', coalesce(to_jsonb(p_expires_at), 'null'::jsonb), true);
  metadata := jsonb_set(metadata, '{studybolt_subscription_event_at}', to_jsonb(p_event_timestamp_ms), true);

  update auth.users set raw_app_meta_data = metadata where id = p_user_id;
  update public.studybolt_subscription_events set outcome = 'applied' where event_id = p_event_id;

  return jsonb_build_object('status', 'applied', 'plan', case when active_now then 'premium' else 'free' end);
end;
$$;

revoke all on function public.apply_studybolt_subscription_event(text, uuid, text, bigint, boolean, timestamptz) from public, anon, authenticated;
grant execute on function public.apply_studybolt_subscription_event(text, uuid, text, bigint, boolean, timestamptz) to service_role;

create table if not exists public.studybolt_subscription_sync_throttle (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_request_at timestamptz not null
);
alter table public.studybolt_subscription_sync_throttle enable row level security;
revoke all on public.studybolt_subscription_sync_throttle from public, anon, authenticated;
grant all on public.studybolt_subscription_sync_throttle to service_role;

create or replace function public.acquire_studybolt_subscription_sync(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare acquired boolean;
begin
  if p_user_id is null then raise exception 'user id is required'; end if;
  insert into public.studybolt_subscription_sync_throttle(user_id, last_request_at)
  values (p_user_id, now())
  on conflict (user_id) do update set last_request_at = excluded.last_request_at
    where public.studybolt_subscription_sync_throttle.last_request_at < now() - interval '30 seconds'
  returning true into acquired;
  return coalesce(acquired, false);
end;
$$;
revoke all on function public.acquire_studybolt_subscription_sync(uuid) from public, anon, authenticated;
grant execute on function public.acquire_studybolt_subscription_sync(uuid) to service_role;

-- Admin analytics and AI quota enforcement use the same effective entitlement.
create or replace function public.studybolt_has_premium(p_metadata jsonb)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare subscription_expiry timestamptz;
begin
  if p_metadata->>'studybolt_subscription_tier' = 'premium' then
    begin
      subscription_expiry := nullif(p_metadata->>'studybolt_subscription_expires_at', '')::timestamptz;
      if subscription_expiry > now() then return true; end if;
    exception when invalid_datetime_format or datetime_field_overflow then
      null;
    end;
  end if;
  begin
    return coalesce((p_metadata->>'studybolt_complimentary_until')::timestamptz > now(), false);
  exception when invalid_datetime_format or datetime_field_overflow then
    return false;
  end;
end;
$$;
revoke all on function public.studybolt_has_premium(jsonb) from public, anon, authenticated;
grant execute on function public.studybolt_has_premium(jsonb) to service_role;

create or replace function public.studybolt_paid_subscription_active(p_metadata jsonb)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare subscription_expiry timestamptz;
begin
  if p_metadata->>'studybolt_subscription_tier' <> 'premium' then return false; end if;
  begin
    subscription_expiry := nullif(p_metadata->>'studybolt_subscription_expires_at', '')::timestamptz;
    return coalesce(subscription_expiry > now(), false);
  exception when invalid_datetime_format or datetime_field_overflow then
    return false;
  end;
end;
$$;
revoke all on function public.studybolt_paid_subscription_active(jsonb) from public, anon, authenticated;
grant execute on function public.studybolt_paid_subscription_active(jsonb) to service_role;

create or replace function public.studybolt_admin_users(p_page integer default 1, p_search text default '')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare total integer; page_number integer; query_text text := lower(left(trim(coalesce(p_search, '')), 120));
begin
  select count(*) into total from auth.users u join public.studybolt_accounts a on a.user_id = u.id
  where position(query_text in lower(coalesce(u.email, '') || ' ' || coalesce(u.raw_user_meta_data->>'display_name', '') || ' ' || coalesce(u.raw_user_meta_data->>'full_name', ''))) > 0;
  page_number := least(greatest(coalesce(p_page, 1), 1), greatest(1, ceil(total / 12.0)::integer));
  return jsonb_build_object('page', page_number, 'total', total, 'totalPages', greatest(1, ceil(total / 12.0)::integer), 'users',
    coalesce((select jsonb_agg(row_to_json(t)) from (
      select u.id, u.email, coalesce(u.raw_user_meta_data->>'display_name', u.raw_user_meta_data->>'full_name', 'Learner') name,
        a.created_at, a.last_seen_at last_sign_in_at, exists(select 1 from public.studybolt_admins where user_id = u.id) is_admin,
        case when public.studybolt_paid_subscription_active(u.raw_app_meta_data) then 'premium' else 'free' end subscription_tier,
        u.raw_app_meta_data->>'studybolt_complimentary_until' complimentary_until,
        (select count(*) from public.studybolt_activity where user_id = u.id and type = 'pack-created') packs,
        (select count(*) from public.studybolt_activity where user_id = u.id and type = 'quiz') quizzes,
        (select count(*) from public.studybolt_activity where user_id = u.id and type = 'flashcard-review') reviews,
        public.studybolt_admin_ai_used(u.id) ai_used
      from auth.users u join public.studybolt_accounts a on a.user_id = u.id
      where position(query_text in lower(coalesce(u.email, '') || ' ' || coalesce(u.raw_user_meta_data->>'display_name', '') || ' ' || coalesce(u.raw_user_meta_data->>'full_name', ''))) > 0
      order by a.created_at desc, u.id limit 12 offset (page_number - 1) * 12
    ) t), '[]'::jsonb));
end;
$$;
revoke all on function public.studybolt_admin_users(integer, text) from public, anon, authenticated;
grant execute on function public.studybolt_admin_users(integer, text) to service_role;

