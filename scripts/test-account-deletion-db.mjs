// Runs the repository's real migrations against disposable PostgreSQL (PGlite), never a hosted URL.
// Install @electric-sql/pglite in a temporary directory, then pass its dist/index.js path as argv[2].
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { PGlite } = process.argv[2] ? await import(pathToFileURL(process.argv[2]).href) : await import('@electric-sql/pglite');
const db = new PGlite();
const root = new URL('../', import.meta.url);
let checks = 0;
const sql = (text, args) => db.query(text, args);
const scalar = async (text, args) => Object.values((await sql(text, args)).rows[0])[0];
const check = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++; };
const rejects = async (text, pattern, label) => { await assert.rejects(() => db.exec(text), pattern, label); checks++; };
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222', C = '33333333-3333-4333-8333-333333333333';
try {
  await db.exec(await readFile(new URL('supabase/tests/account-deletion-fixture.sql', root), 'utf8'));
  const migrations = (await readdir(new URL('supabase/migrations/', root))).filter((name) => name.endsWith('.sql')).sort();
  for (const migration of migrations) {
    try { await db.exec(await readFile(new URL('supabase/migrations/' + migration, root), 'utf8')); }
    catch (error) { throw new Error('Migration failed: ' + migration, { cause: error }); }
  }
  check(migrations.includes('20261029000000_studybolt_account_deletion.sql'), true, 'deletion migration included in replay');
  for (const id of [A, B, C]) await sql('insert into auth.users(id,email) values($1,$2)', [id, id + '@sandbox.invalid']);
  await db.exec(`create table public.wordwiz_test_data(user_id uuid references auth.users(id) on delete cascade, value text);
    insert into public.wordwiz_test_data values('${C}','keep');`);
  await rejects(`select public.request_studybolt_account_deletion('${C}',repeat('c',64));`, /shared_identity_requires_review/, 'shared login cannot cascade another app');
  check(await scalar('select count(*)::int from public.studybolt_account_deletions'), 0, 'no journal for rejected shared identity');
  await sql("update auth.users set raw_app_meta_data = '{\"studyboltXsecret\":true}' where id=$1", [B]);
  await rejects(`select public.request_studybolt_account_deletion('${B}',repeat('b',64));`, /shared_identity_requires_review/, 'prefix must contain a literal underscore');
  await sql("update auth.users set raw_app_meta_data = '{}' where id=$1", [B]);
  await db.exec(`insert into storage.objects(bucket_id,name,owner_id) values('wordwiz','file','${B}');`);
  await rejects(`select public.request_studybolt_account_deletion('${B}',repeat('b',64));`, /shared_storage_requires_review/, 'another app storage stops deletion');
  await db.exec(`delete from storage.objects where bucket_id='wordwiz';`);
  await sql("insert into storage.objects(bucket_id,name,owner_id) values('studybolt-visuals',$1,null),('studybolt-visuals','legacy-owned.png',$2),('studybolt-visuals',$3,$4)", [A+'/nested/a.png', A, B+'/b.png', B]);
  check((await sql('select name from public.list_studybolt_erasure_objects($1)', [A])).rows.map((r) => r.name).sort(), [A+'/nested/a.png','legacy-owned.png'].sort(), 'storage isolation and legacy ownership');
  await sql("insert into shared_study_packs(study_pack_id,owner_user_id,shared_content) values('pack-a',$1,'{}'),('pack-b',$2,'{}')", [A,B]);
  await sql('insert into auth.sessions(user_id) values($1),($2)', [A,B]);
  await sql("insert into studybolt_feedback(user_id,category,subject,message) values($1,'bug','Test','sandbox feedback'),($2,'bug','Test','other feedback')", [A,B]);
  await sql('insert into studybolt_accounts(user_id) values($1),($2)', [A,B]);
  await sql("insert into studybolt_admin_audit(admin_user_id,target_user_id,action,details) values($2,$1,'test','{\"email\":\"a@sandbox.invalid\"}'),($1,$2,'test','{}'),($2,$2,'keep','{}')", [A,B]);
  // Paid status is never a reason to refuse erasure.
  await sql("update auth.users set raw_app_meta_data='{" + '"studybolt_subscription_tier":"premium","studybolt_subscription_expires_at":"2099-01-01T00:00:00Z"' + "}' where id=$1", [A]);
  await sql("select request_studybolt_account_deletion($1,repeat('a',64))", [A]);
  await sql("select request_studybolt_account_deletion($1,repeat('a',64))", [A]);
  check(await scalar('select count(*)::int from studybolt_account_deletions'), 1, 'repeated requests idempotent');
  await rejects(`insert into storage.objects(bucket_id,name) values('studybolt-visuals','${A}/late.png');`, /studybolt_account_deletion_pending/, 'late prefix upload blocked');
  await rejects(`insert into storage.objects(bucket_id,name,owner_id) values('studybolt-visuals','legacy-late.png','${A}');`, /studybolt_account_deletion_pending/, 'late owner upload blocked');
  check(await scalar("select apply_studybolt_subscription_event('late',$1,'RENEWAL',100,true,'2099-01-01') ->> 'status'", [A]), 'ignored_deleting_user', 'deleting webhook ignored before event insert');
  const lease = '44444444-4444-4444-8444-444444444444';
  check((await sql('select * from claim_studybolt_account_deletion($1,$2)', [A,lease])).rows.length, 1, 'first lease granted');
  check((await sql('select * from claim_studybolt_account_deletion($1,gen_random_uuid())', [A])).rows.length, 0, 'second lease denied');
  await sql("update studybolt_account_deletions set lease_until=null, next_attempt_at=now()+interval '10 minutes' where user_id=$1", [A]);
  check((await sql('select * from claim_studybolt_account_deletion($1,gen_random_uuid())', [A])).rows.length, 0, 'manual retries cannot bypass provider backoff');
  // Recheck cross-app writes immediately before destructive Auth removal.
  await sql("insert into wordwiz_test_data values($1,'raced')", [A]);
  await rejects(`delete from auth.users where id='${A}';`, /shared_identity_requires_review/, 'new cross-app data after request still protected');
  await sql('delete from wordwiz_test_data where user_id=$1', [A]);
  // Storage API removal is mocked only here; production uses Storage remove() to erase bytes.
  await sql("delete from storage.objects where bucket_id='studybolt-visuals' and (owner_id=$1 or split_part(name,'/',1)=$1)", [A]);
  await sql('delete from auth.users where id=$1', [A]);
  check(await scalar('select count(*)::int from auth.users where id=$1', [A]), 0, 'Auth removed');
  check(await scalar('select count(*)::int from auth.sessions where user_id=$1', [A]), 0, 'sessions cascade');
  check(await scalar('select count(*)::int from shared_study_packs where owner_user_id=$1', [A]), 0, 'owned share snapshots cascade');
  check(await scalar('select count(*)::int from studybolt_feedback where user_id=$1', [A]), 0, 'feedback cascade');
  check(await scalar('select count(*)::int from studybolt_admin_audit'), 1, 'audit email/actor/target records erased');
  check(await scalar('select count(*)::int from studybolt_account_deletions where user_id=$1', [A]), 1, 'private retry journal survives Auth deletion');
  for (const event of ['RENEWAL','TRANSFER','EXPIRATION']) check(await scalar("select apply_studybolt_subscription_event($1,$2,$3,200,true,'2099-01-01') ->> 'status'", [event,A,event]), 'ignored_deleted_user', 'deleted webhook '+event);
  check(await scalar('select count(*)::int from studybolt_subscription_events where user_id=$1', [A]), 0, 'no orphan webhook event recreated');
  check(await scalar('select count(*)::int from auth.users where id=$1', [B]), 1, 'other Auth user preserved');
  check(await scalar('select count(*)::int from shared_study_packs where owner_user_id=$1', [B]), 1, 'other private pack preserved');
  check(await scalar('select count(*)::int from storage.objects where owner_id=$1', [B]), 1, 'other uploads preserved');
  // Stale JWT still has A uid: existing RLS must not expose B's private records.
  await db.exec(`grant select on shared_study_packs to authenticated; set role authenticated; set request.jwt.claim.sub='${A}';`);
  check(await scalar('select count(*)::int from shared_study_packs'), 0, 'stale deleted-account JWT cannot read another private pack');
  await rejects('select * from studybolt_account_deletions;', /permission denied/, 'journal hidden from app clients');
  await rejects(`select request_studybolt_account_deletion('${B}',repeat('x',64));`, /permission denied/, 'client cannot delete another account with RPC');
  await db.exec('reset role');
  check(await scalar('select count(*)::int from wordwiz_test_data where user_id=$1', [C]), 1, 'WordWiz data preserved');
  const badFks = await sql("select c.relname from pg_constraint f join pg_class c on c.oid=f.conrelid join pg_namespace n on n.oid=c.relnamespace where f.contype='f' and f.confrelid='auth.users'::regclass and n.nspname='public' and c.relname<>'wordwiz_test_data' and f.confdeltype<>'c'");
  check(badFks.rows, [], 'all actual StudyBolt Auth foreign keys cascade');
  console.log(JSON.stringify({ migrations: migrations.length, checks, passed: true, database: 'disposable in-memory PostgreSQL; no remote services' }));
} finally { await db.close(); }
