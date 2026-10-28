-- Transactional integration checks; all fixtures are rolled back.
begin;
do $$
declare
  free_user uuid := gen_random_uuid();
  trial_user uuid := gen_random_uuid();
  rollover_user uuid := gen_random_uuid();
  current_period date := date_trunc('month', timezone('UTC', now()))::date;
  previous_period date := (date_trunc('month', timezone('UTC', now())) - interval '1 month')::date;
  first_hash text := repeat('a', 64);
  second_hash text := repeat('b', 64);
  result jsonb;
  event_ms bigint := floor(extract(epoch from now()) * 1000)::bigint;
begin
  insert into auth.users(id, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
  values
    (free_user, free_user::text || '@example.invalid', '{"subscription_tier":"premium"}', '{}', now(), now()),
    (trial_user, trial_user::text || '@example.invalid', '{}', '{}', now(), now()),
    (rollover_user, rollover_user::text || '@example.invalid', '{}', '{}', now(), now());

  if has_function_privilege('authenticated', 'public.claim_studybolt_powerpoint_import(uuid,text)', 'EXECUTE')
     or has_table_privilege('authenticated', 'public.studybolt_powerpoint_import_periods', 'UPDATE') then
    raise exception 'Clients can bypass the server-owned import allowance';
  end if;

  result := public.claim_studybolt_powerpoint_import(free_user, first_hash);
  if result->>'allowed' is distinct from 'true' or result->>'limited' is distinct from 'true' then raise exception 'First free import rejected or user metadata grants Premium'; end if;
  if public.claim_studybolt_powerpoint_import(free_user, first_hash)->>'reason' is distinct from 'in_progress' then raise exception 'Duplicate in-flight import accepted'; end if;
  if public.claim_studybolt_powerpoint_import(free_user, second_hash)->>'reason' is distinct from 'monthly_limit' then raise exception 'Concurrent second import accepted'; end if;
  if not public.release_studybolt_powerpoint_import(free_user, current_period, first_hash) then raise exception 'Failed upload was not released'; end if;
  if public.release_studybolt_powerpoint_import(free_user, current_period, first_hash) then raise exception 'Release is not idempotent'; end if;
  if public.claim_studybolt_powerpoint_import(free_user, second_hash)->>'allowed' is distinct from 'true' then raise exception 'Retry after failure rejected'; end if;

  update public.studybolt_powerpoint_import_requests set created_at = now() - interval '11 minutes'
    where user_id = free_user and period_start = current_period and source_hash = second_hash;
  if public.claim_studybolt_powerpoint_import(free_user, first_hash)->>'allowed' is distinct from 'true' then raise exception 'Abandoned upload blocks a different file'; end if;
  if not public.complete_studybolt_powerpoint_import(free_user, current_period, first_hash) then raise exception 'Import completion failed'; end if;
  if public.release_studybolt_powerpoint_import(free_user, current_period, first_hash) then raise exception 'Completed import was refunded'; end if;
  if public.claim_studybolt_powerpoint_import(free_user, first_hash)->>'reason' is distinct from 'already_imported' then raise exception 'Completed upload was repeated'; end if;
  if public.claim_studybolt_powerpoint_import(free_user, second_hash)->>'reason' is distinct from 'monthly_limit' then raise exception 'Second free import accepted'; end if;

  perform public.apply_studybolt_subscription_event('trial-start-' || trial_user::text, trial_user, 'INITIAL_PURCHASE', event_ms, true, now() + interval '7 days');
  result := public.claim_studybolt_powerpoint_import(trial_user, first_hash);
  if result->>'allowed' is distinct from 'true' or result->>'limited' is distinct from 'false' then raise exception 'Active trial is capped'; end if;
  if public.claim_studybolt_powerpoint_import(trial_user, second_hash)->>'limited' is distinct from 'false' then raise exception 'Active trial cannot import multiple files'; end if;
  perform public.apply_studybolt_subscription_event('trial-end-' || trial_user::text, trial_user, 'EXPIRATION', event_ms + 1, false, now() - interval '1 minute');
  result := public.claim_studybolt_powerpoint_import(trial_user, first_hash);
  if result->>'allowed' is distinct from 'true' or result->>'limited' is distinct from 'true' then raise exception 'Expired trial does not receive free monthly allowance'; end if;
  perform public.complete_studybolt_powerpoint_import(trial_user, current_period, first_hash);
  if public.claim_studybolt_powerpoint_import(trial_user, second_hash)->>'reason' is distinct from 'monthly_limit' then raise exception 'Expired trial bypasses monthly limit'; end if;
  perform public.apply_studybolt_subscription_event('paid-start-' || trial_user::text, trial_user, 'RENEWAL', event_ms + 2, true, now() + interval '1 year');
  if public.claim_studybolt_powerpoint_import(trial_user, second_hash)->>'limited' is distinct from 'false' then raise exception 'Paid membership remains capped'; end if;

  insert into public.studybolt_powerpoint_import_periods(user_id, period_start, imports_used) values (rollover_user, previous_period, 1);
  insert into public.studybolt_powerpoint_import_requests(user_id, period_start, source_hash, state) values (rollover_user, previous_period, first_hash, 'consumed');
  if public.claim_studybolt_powerpoint_import(rollover_user, second_hash)->>'allowed' is distinct from 'true' then raise exception 'Monthly allowance did not reset'; end if;
  if exists(select 1 from public.studybolt_powerpoint_import_periods where user_id = rollover_user and period_start = previous_period) then raise exception 'Old import hashes were retained'; end if;
  raise notice 'PASS: import limits, retry recovery, expired trial, paid access, monthly reset, and client access restrictions';
end;
$$;
rollback;
