// Disposable PostgreSQL only. This script never connects to a production URL.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
let checks = 0;
const check = (a, b) => { assert.deepEqual(a, b); checks++; };
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const scalar = async (sql) => Object.values((await db.query(sql)).rows[0])[0];
async function asUser(userId, sql, error) {
  await db.exec(`begin; set local role authenticated; set local request.jwt.claim.sub='${userId}';`);
  try {
    if (error) { await assert.rejects(() => db.exec(sql), error); checks++; }
    else return await scalar(sql);
  } finally { await db.exec('rollback'); }
}
try {
  await db.exec(await readFile(new URL('../supabase/tests/account-deletion-fixture.sql', import.meta.url), 'utf8'));
  for (const name of ['20260911000000_shared_study_packs.sql', '20260912000000_studycast_discover_classes.sql']) {
    await db.exec(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8'));
  }
  await db.exec(`grant select,insert,update on public.shared_study_packs to authenticated;
    insert into auth.users(id) values('${A}'),('${B}');
    insert into public.shared_study_packs(study_pack_id,owner_user_id,visibility,shared_content) values('private','${A}','private','{}'),('old-public','${A}','public','{}');
    create table public.wordwiz_isolation_sentinel(value text);
    insert into public.wordwiz_isolation_sentinel values('untouched');`);
  const migration = await readFile(new URL('../supabase/migrations/20261107000000_studybolt_private_release.sql', import.meta.url), 'utf8');
  await db.exec(migration);
  await db.exec(migration); // Safe to reconcile an already-applied deployment.
  for (const name of ['get_shared_study_pack', 'list_public_study_packs', 'list_community_classes', 'get_community_class', 'increment_shared_pack_save', 'join_community_class']) {
    for (const role of ['anon', 'authenticated']) {
      check(await scalar(`select has_function_privilege('${role}',p.oid,'EXECUTE') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='${name}'`), false);
    }
  }
  check(await asUser(A, 'select count(*)::int from public.shared_study_packs'), 2);
  check(await asUser(B, 'select count(*)::int from public.shared_study_packs'), 0);
  for (const visibility of ['link', 'public']) {
    await asUser(A, `insert into public.shared_study_packs(study_pack_id,owner_user_id,visibility,shared_content) values('blocked','${A}','${visibility}','{}')`, /row-level security/);
    await asUser(A, `update public.shared_study_packs set visibility='${visibility}' where study_pack_id='private'`, /row-level security/);
    await asUser(A, `select public.upsert_shared_study_pack('private','${visibility}','{}')`, /row-level security/);
  }
  check(typeof await asUser(A, `select public.upsert_shared_study_pack('private','private','{}')`), 'object');
  check(await asUser(A, `select public.revoke_shared_study_pack((select share_token from public.shared_study_packs where study_pack_id='old-public'))`), true);
  check(await scalar('select count(*)::int from public.shared_study_packs'), 2);
  check(await scalar("select visibility from public.shared_study_packs where study_pack_id='old-public'"), 'public');
  check(await scalar('select value from public.wordwiz_isolation_sentinel'), 'untouched');
  console.log(`PASS: ${checks} production access-control checks in disposable PostgreSQL; no live data used.`);
} finally { await db.close(); }
