-- Run only in an isolated test database after the Admin Center migration.
-- The surrounding test harness supplies minimal auth.users/auth.uid fixtures.
begin;
insert into auth.users(id, email, raw_user_meta_data, raw_app_meta_data, created_at) values
  ('10000000-0000-4000-8000-000000000001', 'admin@example.test', '{"display_name":"Admin"}', '{}', now()),
  ('10000000-0000-4000-8000-000000000002', 'learner@example.test', '{"display_name":"Learner"}', '{}', now()),
  ('10000000-0000-4000-8000-000000000003', 'wordwiz-only@example.test', '{"display_name":"WordWiz only"}', '{}', now()),
  ('10000000-0000-4000-8000-000000000004', 'attacker@example.test', '{"admin":true}', '{"admin":true}', now());
insert into public.studybolt_admins(user_id) values ('10000000-0000-4000-8000-000000000001');

do $$ begin
  if has_table_privilege('authenticated', 'public.studybolt_admins', 'INSERT') then raise exception 'Client can self-promote'; end if;
  if has_table_privilege('authenticated', 'public.studybolt_accounts', 'SELECT') then raise exception 'Client can read the user registry'; end if;
  if has_function_privilege('authenticated', 'public.studybolt_admin_users(integer,text)', 'EXECUTE') then raise exception 'Client can read the directory'; end if;
  if has_function_privilege('authenticated', 'public.studybolt_admin_overview(text)', 'EXECUTE') then raise exception 'Client can read admin aggregates'; end if;
  if has_function_privilege('anon', 'public.record_studybolt_activity(jsonb)', 'EXECUTE') then raise exception 'Guest can submit activity'; end if;
  if has_function_privilege('authenticated', 'public.studybolt_admin_reset_usage(uuid,uuid)', 'EXECUTE') then raise exception 'Client can reset a quota directly'; end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', true);
do $$ begin
  if public.studybolt_is_admin() then raise exception 'Metadata grants admin access'; end if;
end $$;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select public.register_studybolt_account();
do $$ begin
  if not public.studybolt_is_admin() then raise exception 'Real admin membership was rejected'; end if;
end $$;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select public.record_studybolt_activity(jsonb_build_array(jsonb_build_object('id', 'fixture-quiz', 'type', 'quiz', 'occurredAt', now(), 'seconds', 90, 'answers', 2, 'correct', 1, 'user_id', '10000000-0000-4000-8000-000000000003')));
-- A retried upload must be idempotent.
select public.record_studybolt_activity(jsonb_build_array(jsonb_build_object('id', 'fixture-quiz', 'type', 'quiz', 'occurredAt', now(), 'seconds', 90, 'answers', 2, 'correct', 1)));
select public.record_studybolt_activity(jsonb_build_array(jsonb_build_object('id', 'old-event', 'type', 'quiz', 'occurredAt', now() - interval '8 days')));
select public.submit_studybolt_feedback('bug', 'Fixture problem', 'A sufficiently detailed support request.');
do $$ begin
  if (select count(*) from public.studybolt_feedback) <> 1 then raise exception 'Learner cannot read own support request'; end if;
  begin
    update public.studybolt_feedback set status = 'resolved';
    raise exception 'Learner can edit support status';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.record_studybolt_activity(jsonb_build_array(jsonb_build_object('id', 'bad-event', 'type', 'quiz', 'occurredAt', now(), 'seconds', 999999)));
    raise exception 'Oversized activity was accepted';
  exception when check_violation then null;
  end;
  for i in 1..4 loop
    perform public.submit_studybolt_feedback('question', 'Support question', 'Another sufficiently detailed request.');
  end loop;
  begin
    perform public.submit_studybolt_feedback('question', 'One too many', 'This is the sixth request in an hour.');
    raise exception 'Support rate limit was bypassed';
  exception when raise_exception then
    if sqlerrm <> 'Please wait before sending another support request.' then raise; end if;
  end;
end $$;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', true);
do $$ begin
  if exists(select 1 from public.studybolt_feedback) then raise exception 'Learner can read another account support request'; end if;
end $$;
reset role;

do $$ declare overview jsonb; directory jsonb; begin
  if (select count(*) from public.studybolt_activity) <> 1 then raise exception 'Retry duplicates or stale data was retained'; end if;
  if exists(select 1 from public.studybolt_activity where user_id <> '10000000-0000-4000-8000-000000000002') then raise exception 'Activity ownership was forged'; end if;
  overview := public.studybolt_admin_overview('all');
  if (overview->'metrics'->>'totalUsers')::integer <> 2 then raise exception 'WordWiz-only accounts leaked into StudyBolt metrics'; end if;
  if (overview->'metrics'->>'quizAccuracy')::integer <> 50 then raise exception 'Quiz accuracy is incorrect'; end if;
  if (overview->'metrics'->>'learningSeconds')::integer <> 90 then raise exception 'Practice duration is incorrect'; end if;
  directory := public.studybolt_admin_users(999, 'wordwiz-only');
  if (directory->>'total')::integer <> 0 then raise exception 'WordWiz-only account leaked into directory'; end if;
  if (public.studybolt_admin_users(999, 'learner')->>'page')::integer <> 1 then raise exception 'Directory pagination was not clamped'; end if;
  if public.studybolt_has_premium('{"studybolt_complimentary_until":"2026-99-99T00:00:00Z"}') then raise exception 'Malformed metadata grants premium'; end if;
  if not public.studybolt_has_premium('{"subscription_tier":"premium"}') then raise exception 'Paid access lost'; end if;
  if to_regclass('public.ai_usage_periods') is not null then
    insert into public.ai_usage_periods(user_id, period_start, period_end, plan_tier, interaction_count, reserved_interactions, cloud_cost_usd, reserved_cost_usd)
      values ('10000000-0000-4000-8000-000000000002', current_date - 1, current_date + 29, 'free', 9, 1, 0.009, 0.001);
    perform public.studybolt_admin_reset_usage('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001');
    if not exists(select 1 from public.ai_usage_periods where interaction_count = 0 and reserved_interactions = 1 and cloud_cost_usd = 0 and reserved_cost_usd = 0.001) then raise exception 'Quota reset damaged pending reservations'; end if;
  elsif (overview->'capabilities'->>'cloudUsage')::boolean then
    raise exception 'Unconfigured cloud reporting was presented as available';
  end if;
  begin
    perform public.studybolt_admin_reset_usage('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001');
    raise exception 'Self quota modification was accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
delete from public.studybolt_admins where user_id = '10000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
do $$ begin
  if public.studybolt_is_admin() then raise exception 'Revoked membership remained active'; end if;
end $$;
reset role;
rollback;
