-- StudyCast AI usage, public/link sharing, and lightweight class discovery.
-- This migration extends the existing sanitized shared_study_packs snapshot;
-- source uploads and private progress remain local/private.

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  school_name text not null check (char_length(school_name) between 2 and 140),
  course_code text not null check (char_length(course_code) between 1 and 40),
  course_name text not null check (char_length(course_name) between 2 and 160),
  subject text not null check (char_length(subject) between 2 and 80),
  instructor_name text check (instructor_name is null or char_length(instructor_name) <= 120),
  term text check (term is null or char_length(term) <= 80),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists classes_identity_idx
  on public.classes (lower(school_name), lower(course_code), lower(coalesce(term, '')));
create index if not exists classes_course_code_idx on public.classes (lower(course_code));
create index if not exists classes_subject_idx on public.classes (lower(subject));

create table if not exists public.class_memberships (
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default timezone('utc', now()),
  primary key (class_id, user_id)
);

create index if not exists class_memberships_user_idx on public.class_memberships(user_id, joined_at desc);

alter table public.shared_study_packs
  drop constraint if exists shared_study_packs_visibility_check;
alter table public.shared_study_packs
  add constraint shared_study_packs_visibility_check
  check (visibility in ('private', 'link', 'public'));

alter table public.shared_study_packs
  add column if not exists creator_display_name text not null default 'StudyBolt student',
  add column if not exists description text not null default '',
  add column if not exists subject text not null default '',
  add column if not exists class_id uuid references public.classes(id) on delete set null,
  add column if not exists original_set_id text,
  add column if not exists save_count integer not null default 0 check (save_count >= 0),
  add column if not exists share_count integer not null default 0 check (share_count >= 0),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create index if not exists shared_study_packs_public_recent_idx
  on public.shared_study_packs(updated_at desc)
  where visibility = 'public' and is_active = true and revoked_at is null;
create index if not exists shared_study_packs_public_popular_idx
  on public.shared_study_packs(save_count desc, share_count desc)
  where visibility = 'public' and is_active = true and revoked_at is null;
create index if not exists shared_study_packs_class_idx
  on public.shared_study_packs(class_id, updated_at desc)
  where visibility = 'public' and is_active = true and revoked_at is null;
create index if not exists shared_study_packs_subject_idx on public.shared_study_packs(lower(subject));

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  questions_used integer not null default 0 check (questions_used >= 0),
  plan_tier text not null default 'free' check (plan_tier in ('free', 'premium')),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, period_start)
);

create table if not exists public.ai_tutor_rate_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null default timezone('utc', now()),
  requests_in_window integer not null default 0 check (requests_in_window >= 0)
);

alter table public.classes enable row level security;
alter table public.class_memberships enable row level security;
alter table public.ai_usage enable row level security;
alter table public.ai_tutor_rate_limits enable row level security;

drop policy if exists "classes are readable" on public.classes;

drop policy if exists "authenticated users can create classes" on public.classes;
create policy "authenticated users can create classes"
  on public.classes for insert to authenticated with check (created_by = auth.uid());

drop policy if exists "creators can update classes" on public.classes;
create policy "creators can update classes"
  on public.classes for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());

drop policy if exists "users can view their memberships" on public.class_memberships;
create policy "users can view their memberships"
  on public.class_memberships for select to authenticated using (user_id = auth.uid());

drop policy if exists "users can join classes" on public.class_memberships;
create policy "users can join classes"
  on public.class_memberships for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "users can leave classes" on public.class_memberships;
create policy "users can leave classes"
  on public.class_memberships for delete to authenticated using (user_id = auth.uid());

drop policy if exists "users can view their AI usage" on public.ai_usage;
create policy "users can view their AI usage"
  on public.ai_usage for select to authenticated using (user_id = auth.uid());

drop policy if exists "public packs are discoverable" on public.shared_study_packs;

create or replace function public.get_shared_study_pack(p_share_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pack public.shared_study_packs%rowtype;
begin
  select * into pack
  from public.shared_study_packs
  where share_token = p_share_token
    and visibility in ('link', 'public')
    and is_active = true
    and revoked_at is null
    and (expires_at is null or expires_at > timezone('utc', now()))
  limit 1;

  if pack.id is null then return null; end if;

  update public.shared_study_packs
  set share_count = share_count + 1
  where id = pack.id;

  return jsonb_build_object(
    'content', pack.shared_content,
    'metadata', jsonb_build_object(
      'token', pack.share_token,
      'creatorDisplayName', pack.creator_display_name,
      'description', pack.description,
      'itemCount', (case when jsonb_typeof(pack.shared_content->'flashcards') = 'array' then jsonb_array_length(pack.shared_content->'flashcards') else 0 end)
        + (case when jsonb_typeof(pack.shared_content->'notes') = 'array' then jsonb_array_length(pack.shared_content->'notes') else 0 end),
      'saveCount', pack.save_count,
      'shareCount', pack.share_count + 1,
      'visibility', pack.visibility,
      'classId', pack.class_id,
      'originalSetId', pack.original_set_id
    )
  );
end;
$$;

revoke all on function public.get_shared_study_pack(text) from public;
grant execute on function public.get_shared_study_pack(text) to anon, authenticated;

create or replace function public.upsert_shared_study_pack(
  p_study_pack_id text,
  p_visibility text,
  p_shared_content jsonb,
  p_creator_display_name text default 'StudyBolt student',
  p_description text default '',
  p_subject text default '',
  p_class_id uuid default null,
  p_original_set_id text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  pack public.shared_study_packs%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_visibility not in ('private', 'link', 'public') then raise exception 'invalid visibility'; end if;
  if p_shared_content is null or jsonb_typeof(p_shared_content) <> 'object' then raise exception 'invalid content'; end if;
  if char_length(p_study_pack_id) > 180 then raise exception 'invalid study pack id'; end if;

  select * into pack
  from public.shared_study_packs
  where owner_user_id = auth.uid()
    and study_pack_id = p_study_pack_id
    and is_active = true
    and revoked_at is null
  order by created_at desc
  limit 1;

  if pack.id is null then
    insert into public.shared_study_packs(
      study_pack_id, owner_user_id, visibility, shared_content,
      creator_display_name, description, subject, class_id, original_set_id
    ) values (
      p_study_pack_id, auth.uid(), p_visibility, p_shared_content,
      left(coalesce(nullif(trim(p_creator_display_name), ''), 'StudyBolt student'), 80),
      left(coalesce(p_description, ''), 500),
      left(coalesce(p_subject, ''), 80),
      case when p_visibility = 'public' then p_class_id else null end,
      left(coalesce(p_original_set_id, p_study_pack_id), 180)
    ) returning * into pack;
  else
    update public.shared_study_packs
    set visibility = p_visibility,
        shared_content = p_shared_content,
        creator_display_name = left(coalesce(nullif(trim(p_creator_display_name), ''), 'StudyBolt student'), 80),
        description = left(coalesce(p_description, ''), 500),
        subject = left(coalesce(p_subject, ''), 80),
        class_id = case when p_visibility = 'public' then p_class_id else null end,
        original_set_id = left(coalesce(pack.original_set_id, p_original_set_id, p_study_pack_id), 180),
        updated_at = timezone('utc', now())
    where id = pack.id
    returning * into pack;
  end if;

  return jsonb_build_object(
    'share_token', pack.share_token,
    'visibility', pack.visibility,
    'created_at', pack.created_at,
    'updated_at', pack.updated_at,
    'class_id', pack.class_id
  );
end;
$$;

revoke all on function public.upsert_shared_study_pack(text, text, jsonb, text, text, text, uuid, text) from public;
grant execute on function public.upsert_shared_study_pack(text, text, jsonb, text, text, text, uuid, text) to authenticated;

create or replace function public.list_public_study_packs(
  p_search text default '',
  p_subject text default '',
  p_class_id uuid default null,
  p_sort text default 'newest',
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  token text,
  title text,
  course_name text,
  subject text,
  description text,
  creator_display_name text,
  item_count integer,
  page_count integer,
  save_count integer,
  share_count integer,
  updated_at timestamptz,
  class_id uuid,
  class_label text
)
language sql
security definer
set search_path = public
as $$
  select
    p.share_token,
    coalesce(p.shared_content->>'title', 'Untitled Study Pack'),
    coalesce(p.shared_content->>'courseName', p.subject),
    p.subject,
    p.description,
    p.creator_display_name,
    ((case when jsonb_typeof(p.shared_content->'flashcards') = 'array' then jsonb_array_length(p.shared_content->'flashcards') else 0 end)
      + (case when jsonb_typeof(p.shared_content->'notes') = 'array' then jsonb_array_length(p.shared_content->'notes') else 0 end))::integer,
    case when coalesce(p.shared_content->>'pageCount', '') ~ '^\d{1,7}$' then (p.shared_content->>'pageCount')::integer else 0 end,
    p.save_count,
    p.share_count,
    p.updated_at,
    p.class_id,
    case when c.id is null then null else c.course_code || ' · ' || c.course_name end
  from public.shared_study_packs p
  left join public.classes c on c.id = p.class_id
  where p.visibility = 'public'
    and p.is_active = true
    and p.revoked_at is null
    and (p.expires_at is null or p.expires_at > timezone('utc', now()))
    and (p_class_id is null or p.class_id = p_class_id)
    and (coalesce(p_subject, '') = '' or lower(p.subject) = lower(p_subject))
    and (
      coalesce(trim(p_search), '') = ''
      or lower(coalesce(p.shared_content->>'title', '')) like '%' || lower(trim(p_search)) || '%'
      or lower(coalesce(p.shared_content->>'courseName', '')) like '%' || lower(trim(p_search)) || '%'
      or lower(p.subject) like '%' || lower(trim(p_search)) || '%'
      or lower(coalesce(c.course_code, '')) like '%' || lower(trim(p_search)) || '%'
      or lower(coalesce(c.school_name, '')) like '%' || lower(trim(p_search)) || '%'
      or lower(coalesce(c.instructor_name, '')) like '%' || lower(trim(p_search)) || '%'
    )
  order by
    case when p_sort = 'popular' then p.share_count end desc nulls last,
    case when p_sort = 'saved' then p.save_count end desc nulls last,
    p.updated_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 40)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.list_public_study_packs(text, text, uuid, text, integer, integer) from public;
grant execute on function public.list_public_study_packs(text, text, uuid, text, integer, integer) to anon, authenticated;

create or replace function public.list_community_classes(
  p_search text default '',
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  school_name text,
  course_code text,
  course_name text,
  subject text,
  instructor_name text,
  term text,
  member_count integer,
  set_count integer,
  joined boolean
)
language sql
security definer
set search_path = public
as $$
  select
    c.id,
    c.school_name,
    c.course_code,
    c.course_name,
    c.subject,
    c.instructor_name,
    c.term,
    (select count(*)::integer from public.class_memberships m where m.class_id = c.id),
    (select count(*)::integer from public.shared_study_packs p where p.class_id = c.id and p.visibility = 'public' and p.is_active = true and p.revoked_at is null),
    exists(select 1 from public.class_memberships mine where mine.class_id = c.id and mine.user_id = auth.uid())
  from public.classes c
  where coalesce(trim(p_search), '') = ''
    or lower(c.school_name) like '%' || lower(trim(p_search)) || '%'
    or lower(c.course_code) like '%' || lower(trim(p_search)) || '%'
    or lower(c.course_name) like '%' || lower(trim(p_search)) || '%'
    or lower(c.subject) like '%' || lower(trim(p_search)) || '%'
    or lower(coalesce(c.instructor_name, '')) like '%' || lower(trim(p_search)) || '%'
  order by c.course_code, c.school_name
  limit least(greatest(coalesce(p_limit, 20), 1), 40)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.list_community_classes(text, integer, integer) from public;
grant execute on function public.list_community_classes(text, integer, integer) to anon, authenticated;

create or replace function public.get_community_class(p_class_id uuid)
returns table (
  id uuid,
  school_name text,
  course_code text,
  course_name text,
  subject text,
  instructor_name text,
  term text,
  member_count integer,
  set_count integer,
  joined boolean
)
language sql
security definer
set search_path = public
as $$
  select
    c.id,
    c.school_name,
    c.course_code,
    c.course_name,
    c.subject,
    c.instructor_name,
    c.term,
    (select count(*)::integer from public.class_memberships m where m.class_id = c.id),
    (select count(*)::integer from public.shared_study_packs p where p.class_id = c.id and p.visibility = 'public' and p.is_active = true and p.revoked_at is null),
    exists(select 1 from public.class_memberships mine where mine.class_id = c.id and mine.user_id = auth.uid())
  from public.classes c
  where c.id = p_class_id
  limit 1;
$$;

revoke all on function public.get_community_class(uuid) from public;
grant execute on function public.get_community_class(uuid) to anon, authenticated;

create or replace function public.join_community_class(p_class_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  insert into public.class_memberships(class_id, user_id)
  values (p_class_id, auth.uid())
  on conflict (class_id, user_id) do nothing;
  return true;
end;
$$;

create or replace function public.leave_community_class(p_class_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  delete from public.class_memberships
  where class_id = p_class_id and user_id = auth.uid();
  return true;
end;
$$;

revoke all on function public.join_community_class(uuid) from public;
revoke all on function public.leave_community_class(uuid) from public;
grant execute on function public.join_community_class(uuid) to authenticated;
grant execute on function public.leave_community_class(uuid) to authenticated;

create or replace function public.increment_shared_pack_save(p_share_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.shared_study_packs
  set save_count = save_count + 1
  where share_token = p_share_token
    and visibility in ('link', 'public')
    and is_active = true
    and revoked_at is null;
  return found;
end;
$$;

revoke all on function public.increment_shared_pack_save(text) from public;
grant execute on function public.increment_shared_pack_save(text) to authenticated;

create or replace function public.claim_ai_tutor_question(
  p_user_id uuid,
  p_monthly_limit integer,
  p_plan_tier text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  now_utc timestamptz := timezone('utc', now());
  start_date date := date_trunc('month', timezone('utc', now()))::date;
  end_date date := (date_trunc('month', timezone('utc', now())) + interval '1 month')::date;
  usage_count integer;
  rate_row public.ai_tutor_rate_limits%rowtype;
begin
  if p_user_id is null or p_monthly_limit < 1 or p_monthly_limit > 10000 then
    raise exception 'invalid quota claim';
  end if;

  insert into public.ai_tutor_rate_limits(user_id, window_start, requests_in_window)
  values (p_user_id, now_utc, 0)
  on conflict (user_id) do nothing;

  select * into rate_row from public.ai_tutor_rate_limits where user_id = p_user_id for update;
  if rate_row.window_start < now_utc - interval '1 minute' then
    update public.ai_tutor_rate_limits set window_start = now_utc, requests_in_window = 1 where user_id = p_user_id;
  elsif rate_row.requests_in_window >= 10 then
    return jsonb_build_object('allowed', false, 'reason', 'rate_limit');
  else
    update public.ai_tutor_rate_limits set requests_in_window = requests_in_window + 1 where user_id = p_user_id;
  end if;

  insert into public.ai_usage(user_id, period_start, period_end, questions_used, plan_tier)
  values (p_user_id, start_date, end_date, 0, case when p_plan_tier = 'premium' then 'premium' else 'free' end)
  on conflict (user_id, period_start) do update
    set period_end = excluded.period_end,
        plan_tier = excluded.plan_tier,
        updated_at = now_utc;

  select questions_used into usage_count
  from public.ai_usage
  where user_id = p_user_id and period_start = start_date
  for update;

  if usage_count >= p_monthly_limit then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'monthly_limit',
      'used', usage_count,
      'limit', p_monthly_limit,
      'remaining', 0,
      'periodStart', start_date,
      'periodEnd', end_date,
      'plan', case when p_plan_tier = 'premium' then 'premium' else 'free' end
    );
  end if;

  update public.ai_usage
  set questions_used = questions_used + 1, updated_at = now_utc
  where user_id = p_user_id and period_start = start_date
  returning questions_used into usage_count;

  return jsonb_build_object(
    'allowed', true,
    'used', usage_count,
    'limit', p_monthly_limit,
    'remaining', greatest(p_monthly_limit - usage_count, 0),
    'periodStart', start_date,
    'periodEnd', end_date,
    'plan', case when p_plan_tier = 'premium' then 'premium' else 'free' end
  );
end;
$$;

create or replace function public.refund_ai_tutor_question(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.ai_usage
  set questions_used = greatest(questions_used - 1, 0), updated_at = timezone('utc', now())
  where user_id = p_user_id
    and period_start = date_trunc('month', timezone('utc', now()))::date;
$$;

revoke all on function public.claim_ai_tutor_question(uuid, integer, text) from public, anon, authenticated;
revoke all on function public.refund_ai_tutor_question(uuid) from public, anon, authenticated;
grant execute on function public.claim_ai_tutor_question(uuid, integer, text) to service_role;
grant execute on function public.refund_ai_tutor_question(uuid) to service_role;
