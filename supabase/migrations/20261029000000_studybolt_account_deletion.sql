-- Additive deletion journal. No production data is removed by applying this migration.
-- Review cross-product Auth ownership before deployment: Auth is shared with WordWiz.
create table public.studybolt_account_deletions (
  user_id uuid primary key,
  request_token_hash text not null check (length(request_token_hash) = 64),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  storage_deleted boolean not null default false,
  auth_deleted boolean not null default false,
  revenuecat_requested boolean not null default false,
  revenuecat_requested_at timestamptz,
  revenuecat_deleted boolean not null default false,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,
  lease_until timestamptz,
  last_error text
);
alter table public.studybolt_account_deletions enable row level security;
revoke all on public.studybolt_account_deletions from public, anon, authenticated;
grant all on public.studybolt_account_deletions to service_role;
create unique index studybolt_account_deletions_token_idx on public.studybolt_account_deletions(request_token_hash);
create index studybolt_account_deletions_pending_idx on public.studybolt_account_deletions(next_attempt_at) where completed_at is null;

-- Check actual referencing rows, rather than deleting other products' records.
create function public.check_studybolt_erasure_safety(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare ref record; has_rows boolean; metadata jsonb;
begin
  select raw_app_meta_data into metadata from auth.users where id = p_user_id for update;
  if not found then raise exception 'account_not_found'; end if;
  if exists(select 1 from jsonb_object_keys(coalesce(metadata, '{}'::jsonb)) k
    where k not in ('provider', 'providers') and left(k, 10) <> 'studybolt_') then
    raise exception 'shared_identity_requires_review';
  end if;
  for ref in
    select n.nspname schema_name, c.relname table_name, a.attname column_name
    from pg_constraint f join pg_class c on c.oid = f.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attnum = f.conkey[1]
    where f.contype = 'f' and f.confrelid = 'auth.users'::regclass
      and n.nspname not in ('auth', 'storage')
      and not (n.nspname = 'public' and c.relname in (
        'shared_study_packs','classes','class_memberships','ai_usage','ai_tutor_rate_limits',
        'ai_usage_periods','ai_usage_reservations','ai_usage_events',
        'studybolt_visual_documents','studybolt_visuals','studybolt_admins','studybolt_accounts',
        'studybolt_activity','studybolt_feedback','studybolt_subscription_events',
        'studybolt_subscription_sync_throttle','studybolt_powerpoint_import_periods'
      ))
  loop
    execute format('select exists(select 1 from %I.%I where %I = $1)', ref.schema_name, ref.table_name, ref.column_name)
      into has_rows using p_user_id;
    if has_rows then raise exception 'shared_identity_requires_review'; end if;
  end loop;
  if exists(select 1 from storage.objects where owner_id = p_user_id::text and bucket_id <> 'studybolt-visuals') then
    raise exception 'shared_storage_requires_review';
  end if;
end;
$$;

create function public.request_studybolt_account_deletion(p_user_id uuid, p_token_hash text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.check_studybolt_erasure_safety(p_user_id);
  insert into public.studybolt_account_deletions(user_id, request_token_hash)
    values(p_user_id, p_token_hash)
    on conflict (user_id) do update set request_token_hash = excluded.request_token_hash;
end;
$$;

create function public.claim_studybolt_account_deletion(p_user_id uuid, p_lease uuid)
returns setof public.studybolt_account_deletions
language sql security definer set search_path = '' as $$
  update public.studybolt_account_deletions
    set lease_token = p_lease, lease_until = now() + interval '5 minutes', attempts = attempts + 1
    where user_id = p_user_id and completed_at is null
      and next_attempt_at <= now()
      and (lease_until is null or lease_until < now())
    returning *;
$$;

-- Stop new slide objects racing against an accepted erasure request, including service-role uploads.
create function public.guard_studybolt_deleted_storage()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.bucket_id = 'studybolt-visuals' and exists(
    select 1 from public.studybolt_account_deletions d where d.user_id::text = split_part(new.name, '/', 1) or d.user_id::text = new.owner_id
  ) then raise exception 'studybolt_account_deletion_pending'; end if;
  return new;
end;
$$;
create trigger studybolt_deleted_storage_guard before insert or update on storage.objects
  for each row execute function public.guard_studybolt_deleted_storage();

create function public.list_studybolt_erasure_objects(p_user_id uuid, p_after_name text default '')
returns table(name text) language sql security definer set search_path = '' as $$
  select o.name from storage.objects o where o.bucket_id = 'studybolt-visuals'
    and (o.owner_id = p_user_id::text or split_part(o.name, '/', 1) = p_user_id::text)
    and o.name > p_after_name order by o.name limit 1000;
$$;

-- This table has no Auth FK and its JSON details can contain a user's email.
create function public.erase_studybolt_audit_personal_data()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Recheck immediately before Auth deletion: another app may have written since confirmation.
  if exists(select 1 from public.studybolt_account_deletions where user_id = old.id) then
    perform public.check_studybolt_erasure_safety(old.id);
  end if;
  delete from public.studybolt_admin_audit where admin_user_id = old.id or target_user_id = old.id;
  return old;
end;
$$;
create trigger studybolt_erase_audit_on_auth_delete before delete on auth.users
  for each row execute function public.erase_studybolt_audit_personal_data();

-- Lock the real Auth row BEFORE inserting the FK event. Late/deleted-user events are acknowledged.
create or replace function public.apply_studybolt_subscription_event(
  p_event_id text, p_user_id uuid, p_event_type text, p_event_timestamp_ms bigint,
  p_is_premium boolean, p_expires_at timestamptz
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare metadata jsonb; previous_event_ms bigint;
  active_now boolean := coalesce(p_is_premium, false) and p_expires_at is not null and p_expires_at > now();
begin
  if p_event_id is null or length(p_event_id) not between 1 and 200 or p_user_id is null
    or p_event_timestamp_ms is null or p_event_timestamp_ms <= 0
    or p_event_type is null or length(p_event_type) > 80 then raise exception 'Invalid subscription event'; end if;
  select coalesce(u.raw_app_meta_data, '{}'::jsonb) into metadata from auth.users u where u.id = p_user_id for update;
  if not found then return jsonb_build_object('status','ignored_deleted_user'); end if;
  if exists(select 1 from public.studybolt_account_deletions where user_id = p_user_id) then
    return jsonb_build_object('status','ignored_deleting_user');
  end if;
  insert into public.studybolt_subscription_events(event_id,user_id,event_type,event_timestamp_ms)
    values(p_event_id,p_user_id,p_event_type,p_event_timestamp_ms) on conflict do nothing;
  if not found then return jsonb_build_object('status','duplicate'); end if;
  begin previous_event_ms := nullif(metadata->>'studybolt_subscription_event_at','')::bigint;
    exception when invalid_text_representation or numeric_value_out_of_range then previous_event_ms := null;
  end;
  if previous_event_ms is not null and p_event_timestamp_ms <= previous_event_ms then
    update public.studybolt_subscription_events set outcome='stale' where event_id=p_event_id and user_id=p_user_id;
    return jsonb_build_object('status','stale');
  end if;
  metadata := metadata || jsonb_build_object('studybolt_subscription_tier',case when active_now then 'premium' else 'free' end,
    'studybolt_subscription_expires_at',p_expires_at,'studybolt_subscription_event_at',p_event_timestamp_ms);
  update auth.users set raw_app_meta_data=metadata where id=p_user_id;
  update public.studybolt_subscription_events set outcome='applied' where event_id=p_event_id and user_id=p_user_id;
  return jsonb_build_object('status','applied','plan',case when active_now then 'premium' else 'free' end);
end;
$$;

revoke all on function public.check_studybolt_erasure_safety(uuid) from public,anon,authenticated;
revoke all on function public.request_studybolt_account_deletion(uuid,text) from public,anon,authenticated;
revoke all on function public.claim_studybolt_account_deletion(uuid,uuid) from public,anon,authenticated;
revoke all on function public.guard_studybolt_deleted_storage() from public,anon,authenticated;
revoke all on function public.erase_studybolt_audit_personal_data() from public,anon,authenticated;
revoke all on function public.list_studybolt_erasure_objects(uuid,text) from public,anon,authenticated;
grant execute on function public.request_studybolt_account_deletion(uuid,text) to service_role;
grant execute on function public.claim_studybolt_account_deletion(uuid,uuid) to service_role;
grant execute on function public.list_studybolt_erasure_objects(uuid,text) to service_role;
