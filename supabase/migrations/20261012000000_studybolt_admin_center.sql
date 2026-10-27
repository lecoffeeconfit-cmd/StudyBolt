-- StudyBolt operations. Membership and privileged functions are server managed.
-- Activity contains counts and durations, never study text, answers, or uploads.
create table public.studybolt_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Auth is shared with WordWiz. Only accounts seen in StudyBolt belong in this
-- directory; never treat every auth.users row as a StudyBolt learner.
create table public.studybolt_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table public.studybolt_admin_audit (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null,
  target_user_id uuid,
  action text not null,
  outcome text not null default 'pending' check (outcome in ('pending', 'succeeded', 'failed')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.studybolt_activity (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id text not null check (char_length(event_id) between 1 and 100),
  type text not null check (type in ('pack-created', 'note-review', 'flashcard-review', 'quiz', 'audio', 'focus', 'screen')),
  seconds integer not null default 0 check (seconds between 0 and 14400),
  answers integer not null default 0 check (answers between 0 and 1000),
  correct integer not null default 0 check (correct between 0 and answers),
  screen text check (screen in ('home', 'library', 'planner', 'discover', 'stats', 'profile', 'study-pack', 'exam', 'smart-study', 'speed-review', 'visuals', 'shared', 'community-class', 'processing', 'flagged', 'mistakes')),
  occurred_at timestamptz not null default now(),
  primary key (user_id, event_id),
  check ((type = 'screen' and screen is not null) or (type <> 'screen' and screen is null))
);
create index studybolt_activity_recent_idx on public.studybolt_activity(occurred_at desc);

create table public.studybolt_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('bug', 'idea', 'question')),
  subject text not null check (char_length(subject) between 3 and 120),
  message text not null check (char_length(message) between 10 and 3000),
  status text not null default 'new' check (status in ('new', 'reviewing', 'resolved', 'closed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'critical')),
  admin_reply text check (char_length(admin_reply) <= 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index studybolt_feedback_user_recent_idx on public.studybolt_feedback(user_id, created_at desc);

alter table public.studybolt_admins enable row level security;
alter table public.studybolt_accounts enable row level security;
alter table public.studybolt_admin_audit enable row level security;
alter table public.studybolt_activity enable row level security;
alter table public.studybolt_feedback enable row level security;
revoke all on public.studybolt_admins, public.studybolt_accounts, public.studybolt_admin_audit, public.studybolt_activity, public.studybolt_feedback from public, anon, authenticated;
grant all on public.studybolt_admins, public.studybolt_accounts, public.studybolt_admin_audit, public.studybolt_activity, public.studybolt_feedback to service_role;
grant select on public.studybolt_feedback to authenticated;
create policy "Learners can read their own support requests"
  on public.studybolt_feedback for select to authenticated using (user_id = (select auth.uid()));

create function public.studybolt_is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.studybolt_admins where user_id = auth.uid());
$$;
revoke all on function public.studybolt_is_admin() from public, anon, authenticated;
grant execute on function public.studybolt_is_admin() to authenticated;

create function public.register_studybolt_account()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  insert into public.studybolt_accounts(user_id) values (auth.uid())
    on conflict (user_id) do update set last_seen_at = now();
end;
$$;
revoke all on function public.register_studybolt_account() from public, anon, authenticated;
grant execute on function public.register_studybolt_account() to authenticated;

-- Include existing StudyBolt learners without importing WordWiz-only users.
insert into public.studybolt_accounts(user_id, created_at, last_seen_at)
select id, created_at, coalesce(last_sign_in_at, created_at)
from auth.users where raw_user_meta_data ? 'studybolt_onboarding_required'
on conflict (user_id) do nothing;

do $$
declare source record;
begin
  for source in select * from (values
    ('shared_study_packs', 'owner_user_id', 'created_at'),
    ('classes', 'created_by', 'created_at'),
    ('class_memberships', 'user_id', 'joined_at'),
    ('ai_usage_periods', 'user_id', 'period_start'),
    ('studybolt_visual_documents', 'owner_user_id', 'created_at')
  ) as sources(table_name, user_column, time_column) loop
    if to_regclass('public.' || source.table_name) is not null then
      execute format('insert into public.studybolt_accounts(user_id, created_at, last_seen_at) select %I, min(%I)::timestamptz, max(%I)::timestamptz from public.%I group by %I on conflict (user_id) do update set created_at = least(studybolt_accounts.created_at, excluded.created_at), last_seen_at = greatest(studybolt_accounts.last_seen_at, excluded.last_seen_at)',
        source.user_column, source.time_column, source.time_column, source.table_name, source.user_column);
    end if;
  end loop;
end;
$$;

create function public.record_studybolt_activity(p_events jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare item jsonb; event_time timestamptz;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) > 100 then
    raise exception 'invalid_activity_batch' using errcode = '22023';
  end if;
  perform public.register_studybolt_account();
  for item in select value from jsonb_array_elements(p_events) loop
    event_time := (item->>'occurredAt')::timestamptz;
    if event_time is null or event_time < now() - interval '7 days' or event_time > now() + interval '5 minutes' then
      continue;
    end if;
    insert into public.studybolt_activity(user_id, event_id, type, seconds, answers, correct, screen, occurred_at)
    values (auth.uid(), item->>'id', item->>'type', coalesce((item->>'seconds')::integer, 0),
      coalesce((item->>'answers')::integer, 0), coalesce((item->>'correct')::integer, 0), item->>'screen', event_time)
    on conflict (user_id, event_id) do nothing;
  end loop;
end;
$$;
revoke all on function public.record_studybolt_activity(jsonb) from public, anon, authenticated;
grant execute on function public.record_studybolt_activity(jsonb) to authenticated;

create function public.submit_studybolt_feedback(p_category text, p_subject text, p_message text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare report_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  -- Serialize per learner so concurrent submissions cannot bypass the limit.
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  if (select count(*) from public.studybolt_feedback where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Please wait before sending another support request.' using errcode = 'P0001';
  end if;
  perform public.register_studybolt_account();
  insert into public.studybolt_feedback(user_id, category, subject, message)
  values (auth.uid(), p_category, trim(p_subject), trim(p_message)) returning id into report_id;
  return report_id;
end;
$$;
revoke all on function public.submit_studybolt_feedback(text, text, text) from public, anon, authenticated;
grant execute on function public.submit_studybolt_feedback(text, text, text) to authenticated;

create function public.studybolt_has_premium(p_metadata jsonb)
returns boolean language plpgsql stable set search_path = '' as $$
begin
  if p_metadata->>'subscription_tier' = 'premium' then return true; end if;
  return coalesce((p_metadata->>'studybolt_complimentary_until')::timestamptz > now(), false);
exception when invalid_datetime_format or datetime_field_overflow then return false;
end;
$$;
revoke all on function public.studybolt_has_premium(jsonb) from public, anon, authenticated;
grant execute on function public.studybolt_has_premium(jsonb) to service_role;

create function public.studybolt_admin_overview(p_range text default '30d')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare since_at timestamptz; result jsonb; cloud_metrics jsonb; community_metrics jsonb;
  cloud_actions jsonb := '[]'::jsonb; top_packs jsonb := '[]'::jsonb;
  has_cloud boolean := to_regclass('public.ai_usage_events') is not null;
  has_community boolean := to_regclass('public.shared_study_packs') is not null and to_regclass('public.classes') is not null and to_regclass('public.class_memberships') is not null;
begin
  since_at := case p_range when 'today' then date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'
    when '7d' then now() - interval '7 days' when 'all' then '-infinity'::timestamptz else now() - interval '30 days' end;
  result := (
    with activity as (select * from public.studybolt_activity where occurred_at >= since_at),
    leaders as (
      select user_id, count(*) filter (where type = 'pack-created') packs,
        count(*) filter (where type = 'quiz') quizzes, count(*) filter (where type = 'flashcard-review') reviews,
        count(*) filter (where type <> 'screen') actions
      from activity group by user_id having count(*) filter (where type <> 'screen') > 0
      order by actions desc, user_id limit 20
    )
    select jsonb_build_object(
      'generatedAt', now(),
      'capabilities', jsonb_build_object('cloudUsage', has_cloud, 'community', has_community, 'quotaControls', to_regclass('public.ai_usage_periods') is not null),
      'metrics', jsonb_build_object(
        'totalUsers', (select count(*) from public.studybolt_accounts),
        'newUsers', (select count(*) from public.studybolt_accounts where created_at >= since_at),
        'activeUsers', (select count(*) from public.studybolt_accounts where last_seen_at >= since_at),
        'premiumUsers', (select count(*) from auth.users u join public.studybolt_accounts a on a.user_id = u.id where public.studybolt_has_premium(raw_app_meta_data)),
        'packsCreated', (select count(*) from activity where type = 'pack-created'),
        'quizAttempts', (select count(*) from activity where type = 'quiz'),
        'cardReviews', (select count(*) from activity where type = 'flashcard-review'),
        'quizAccuracy', (select case when sum(answers) > 0 then round(sum(correct) * 100.0 / sum(answers)) else null end from activity where type = 'quiz'),
        'learningSeconds', (select coalesce(sum(seconds), 0) from activity where type in ('quiz', 'flashcard-review')),
        'openFeedback', (select count(*) from public.studybolt_feedback where status in ('new', 'reviewing'))
      ),
      'topLearners', coalesce((select jsonb_agg(row_to_json(t)) from (
        select l.user_id id, coalesce(u.raw_user_meta_data->>'display_name', u.raw_user_meta_data->>'full_name', 'Learner') name,
          u.email, l.packs, l.quizzes, l.reviews, l.actions from leaders l join auth.users u on u.id = l.user_id order by l.actions desc, l.user_id
      ) t), '[]'::jsonb),
      'screenTime', coalesce((select jsonb_agg(row_to_json(t)) from (
        select screen, sum(seconds) seconds, count(*) segments from activity where type = 'screen' group by screen order by seconds desc
      ) t), '[]'::jsonb),
      'recentActions', coalesce((select jsonb_agg(row_to_json(t)) from (
        select id, action, outcome, details->>'email' email, created_at from public.studybolt_admin_audit order by created_at desc limit 12
      ) t), '[]'::jsonb)
    )
  );
  if has_cloud then
    select jsonb_build_object('cloudRequests', count(*), 'cloudCostUsd', coalesce(sum(actual_cost_usd), 0), 'inputTokens', coalesce(sum(input_tokens), 0), 'outputTokens', coalesce(sum(output_tokens), 0))
      into cloud_metrics from public.ai_usage_events where created_at >= since_at;
    select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into cloud_actions from (
      select action, count(*) requests, sum(actual_cost_usd) cost from public.ai_usage_events where created_at >= since_at group by action order by requests desc limit 8
    ) t;
  else
    cloud_metrics := jsonb_build_object('cloudRequests', 0, 'cloudCostUsd', 0, 'inputTokens', 0, 'outputTokens', 0);
  end if;
  if has_community then
    select jsonb_build_object(
      'publicPacks', (select count(*) from public.shared_study_packs where visibility = 'public' and is_active and revoked_at is null and (expires_at is null or expires_at > now())),
      'classes', (select count(*) from public.classes), 'classMembers', (select count(*) from public.class_memberships)) into community_metrics;
    select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into top_packs from (
      select id, shared_content->>'title' title, subject, save_count saves, share_count shares from public.shared_study_packs
      where visibility = 'public' and is_active and revoked_at is null and (expires_at is null or expires_at > now())
      order by save_count desc, share_count desc, id limit 5
    ) t;
  else
    community_metrics := jsonb_build_object('publicPacks', 0, 'classes', 0, 'classMembers', 0);
  end if;
  return jsonb_set(result, '{metrics}', result->'metrics' || cloud_metrics || community_metrics)
    || jsonb_build_object('cloudActions', cloud_actions, 'topPacks', top_packs);
end;
$$;
revoke all on function public.studybolt_admin_overview(text) from public, anon, authenticated;
grant execute on function public.studybolt_admin_overview(text) to service_role;

create function public.studybolt_admin_ai_used(p_user_id uuid)
returns bigint language plpgsql stable security definer set search_path = '' as $$
begin
  if to_regclass('public.ai_usage_periods') is null then return null; end if;
  return (select coalesce(sum(interaction_count), 0) from public.ai_usage_periods where user_id = p_user_id and period_start <= current_date and period_end > current_date);
end;
$$;
revoke all on function public.studybolt_admin_ai_used(uuid) from public, anon, authenticated;
grant execute on function public.studybolt_admin_ai_used(uuid) to service_role;

create function public.studybolt_admin_users(p_page integer default 1, p_search text default '')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare total integer; page_number integer; query_text text := lower(left(trim(coalesce(p_search, '')), 120));
begin
  select count(*) into total from auth.users u join public.studybolt_accounts a on a.user_id = u.id where position(query_text in lower(coalesce(u.email, '') || ' ' || coalesce(u.raw_user_meta_data->>'display_name', '') || ' ' || coalesce(u.raw_user_meta_data->>'full_name', ''))) > 0;
  page_number := least(greatest(coalesce(p_page, 1), 1), greatest(1, ceil(total / 12.0)::integer));
  return jsonb_build_object('page', page_number, 'total', total, 'totalPages', greatest(1, ceil(total / 12.0)::integer), 'users',
    coalesce((select jsonb_agg(row_to_json(t)) from (
      select u.id, u.email, coalesce(u.raw_user_meta_data->>'display_name', u.raw_user_meta_data->>'full_name', 'Learner') name,
        a.created_at, a.last_seen_at last_sign_in_at, exists(select 1 from public.studybolt_admins where user_id = u.id) is_admin,
        coalesce(u.raw_app_meta_data->>'subscription_tier', 'free') subscription_tier,
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

-- Preserve in-flight reservations and historical cost events when resetting the
-- monthly allowance. Reconciliation still applies to the same locked row.
create function public.studybolt_admin_reset_usage(p_user_id uuid, p_admin_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_user_id = p_admin_id or not exists (select 1 from public.studybolt_admins where user_id = p_admin_id)
    or exists (select 1 from public.studybolt_admins where user_id = p_user_id)
    or not exists (select 1 from public.studybolt_accounts where user_id = p_user_id) then
    raise exception 'account_action_not_allowed' using errcode = '42501';
  end if;
  if to_regclass('public.ai_usage_periods') is null then
    raise exception 'Cloud AI quotas are not configured for this StudyBolt backend.' using errcode = 'P0001';
  end if;
  update public.ai_usage_periods set interaction_count = 0, cloud_cost_usd = 0, updated_at = now()
    where user_id = p_user_id and period_start <= current_date and period_end > current_date;
  insert into public.studybolt_admin_audit(admin_user_id, target_user_id, action, outcome, details)
    values (p_admin_id, p_user_id, 'reset_ai_quota', 'succeeded', jsonb_build_object('email', (select email from auth.users where id = p_user_id)));
end;
$$;
revoke all on function public.studybolt_admin_reset_usage(uuid, uuid) from public, anon, authenticated;
grant execute on function public.studybolt_admin_reset_usage(uuid, uuid) to service_role;
