import assert from 'node:assert/strict';
import test from 'node:test';
import { runAccountDeletion } from '../supabase/functions/_shared/accountDeletion.ts';
import { removeUserVisuals, studyBoltSubscriptionAccountExists } from '../supabase/functions/_shared/accountDeletionStore.ts';
import { submitAccountDeletion, studyBoltLocalAccountKeys } from '../src/services/accountDeletionClient.ts';
function fixture(overrides = {}, jobOverrides = {}) {
  const job = { user_id: 'A', storage_deleted: false, auth_deleted: false, revenuecat_requested: false, revenuecat_deleted: false, completed_at: null, ...jobOverrides };
  const calls = [];
  const steps = {
    removeStorage: async () => { calls.push('storage'); }, removeAuth: async () => { calls.push('auth'); },
    requestRevenueCat: async () => { calls.push('rc'); return { ok: true, outcome: 'queued', attempts: 1 }; },
    confirmRevenueCat: async () => { calls.push('confirm'); return { deleted: true }; },
    checkpoint: async (step) => { calls.push(step); job[step] = true; },
    complete: async () => { calls.push('complete'); job.completed_at = 'done'; }, defer: async (code) => { calls.push(code); }, ...overrides,
  };
  return { job, calls, steps };
}
test('deletion does not inspect or cancel billing: same workflow for free and subscribed users', async () => {
  for (const subscribed of [false, true]) {
    const f = fixture({}, { subscribed });
    assert.equal(await runAccountDeletion(f.job, f.steps), 'pending');
    assert.deepEqual(f.calls, ['storage', 'storage_deleted', 'auth', 'auth_deleted', 'rc', 'revenuecat_requested', 'revenuecat_confirmation_pending']);
    assert.equal(await runAccountDeletion(f.job, f.steps), 'completed');
    assert.deepEqual(f.calls.slice(-3), ['confirm', 'revenuecat_deleted', 'complete']);
    const count = f.calls.length;
    assert.equal(await runAccountDeletion(f.job, f.steps), 'completed'); assert.equal(f.calls.length, count);
  }
});
test('storage failure preserves Auth and RevenueCat; retry resumes safely', async () => {
  const f = fixture({ removeStorage: async () => { throw Error('storage down'); } });
  assert.equal(await runAccountDeletion(f.job, f.steps), 'pending');
  assert.deepEqual(f.calls, ['storage_cleanup_failed']); assert.equal(f.job.auth_deleted, false);
});
test('Supabase Auth failure leaves RevenueCat untouched', async () => {
  const f = fixture({ removeAuth: async () => { throw Error('database down'); } });
  await runAccountDeletion(f.job, f.steps);
  assert.equal(f.job.storage_deleted, true); assert.equal(f.job.auth_deleted, false);
  assert.ok(!f.calls.includes('rc')); assert.equal(f.calls.at(-1), 'auth_cleanup_failed');
});
test('failed RevenueCat request remains durable after Auth removal and retries only remaining step', async () => {
  const f = fixture({ requestRevenueCat: async () => ({ ok: false, retryable: true }) });
  assert.equal(await runAccountDeletion(f.job, f.steps), 'pending'); assert.equal(f.job.auth_deleted, true);
  assert.equal(f.calls.at(-1), 'revenuecat_request_failed');
  f.steps.requestRevenueCat = async () => ({ ok: true, outcome: 'already_deleted' });
  assert.equal(await runAccountDeletion(f.job, f.steps), 'completed');
  assert.equal(f.calls.filter((c) => c === 'auth').length, 1);
});
test('pending async deletion is never completed prematurely', async () => {
  const f = fixture({ confirmRevenueCat: async () => ({ deleted: false }) }, { storage_deleted: true, auth_deleted: true, revenuecat_requested: true, revenuecat_requested_at: new Date().toISOString() });
  assert.equal(await runAccountDeletion(f.job, f.steps), 'pending'); assert.equal(f.job.completed_at, null);
  assert.deepEqual(f.calls, ['revenuecat_confirmation_pending']);
});
test('failed checkpoint stops following destructive stages', async () => {
  const f = fixture({ checkpoint: async () => { throw Error('db down'); } });
  assert.equal(await runAccountDeletion(f.job, f.steps), 'pending');
  assert.deepEqual(f.calls, ['storage', 'storage_cleanup_failed']);
});
test('storage removal paginates with stable cursors and removes bytes in batches, including legacy paths', async () => {
  const paths = Array.from({ length: 1005 }, (_, i) => `A/nested/${String(i).padStart(4, '0')}.png`).concat('legacy-owned.png');
  const removed = []; const cursors = [];
  await removeUserVisuals({ rpc: async (name, args) => {
    assert.equal(name, 'list_studybolt_erasure_objects'); assert.equal(args.p_user_id, 'A'); cursors.push(args.p_after_name);
    return { data: paths.filter((p) => p > args.p_after_name).slice(0, 1000).map((name) => ({ name })) };
  }, storage: { from: (bucket) => { assert.equal(bucket, 'studybolt-visuals'); return { remove: async (batch) => { assert.ok(batch.length <= 100); removed.push(...batch); return {}; } }; } } }, 'A');
  assert.deepEqual(removed, paths); assert.deepEqual(cursors, ['', paths[999]]);
});
test('deleted/deleting user guards do not look up RevenueCat or return an existing account', async () => {
  for (const deleting of [true, false]) {
    let lookups = 0;
    const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: deleting ? { user_id: 'A' } : null }) };
    const admin = { from: () => query, auth: { admin: { getUserById: async () => { lookups++; return { data: { user: null }, error: { status: 404 } }; } } } };
    assert.equal(await studyBoltSubscriptionAccountExists(admin, 'A'), false); assert.equal(lookups, deleting ? 0 : 1);
  }
});
test('unavailable deletion status fails closed', async () => {
  const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ error: {} }) };
  await assert.rejects(() => studyBoltSubscriptionAccountExists({ from: () => q }, 'A'));
});
test('only explicit accepted/completed deletion acknowledgements sign out', async () => {
  for (const payload of [{ accepted: true, status: 'pending' }, { deleted: true, status: 'completed' }, {}, { deleted: true }, { accepted: true, status: 'completed' }]) {
    let cleared = 0;
    const result = await submitAccountDeletion(async () => Response.json(payload), async () => { cleared++; }, async () => {});
    const accepted = (payload.accepted && payload.status === 'pending') || (payload.deleted && payload.status === 'completed');
    assert.equal(cleared, accepted ? 1 : 0); assert.equal(Boolean(result.error), !accepted);
  }
});
test('lost response retries the same request; unrecoverable network error preserves local data', async () => {
  let sends = 0; let cleared = 0;
  const result = await submitAccountDeletion(async () => { if (++sends === 1) throw Error(); return Response.json({ accepted: true, status: 'pending' }, { status: 202 }); }, async () => { cleared++; }, async () => {});
  assert.equal(result.deletionPending, true); assert.equal(sends, 2); assert.equal(cleared, 1);
  const failed = await submitAccountDeletion(async () => { throw Error(); }, async () => { cleared++; }, async () => {});
  assert.ok(failed.error); assert.equal(cleared, 1);
});
test('confirmed rejection releases the purchase hold; uncertain service failures retain it', async () => {
  for (const status of [400, 401, 403, 409, 503]) {
    let released = 0;
    await submitAccountDeletion(async () => Response.json({ error: 'failed' }, { status }), async () => assert.fail(), async () => { released++; });
    assert.equal(released, status === 503 ? 0 : 1);
  }
});
test('session cleanup failure still acknowledges deletion and reports local failure', async () => {
  const result = await submitAccountDeletion(async () => Response.json({ deleted: true, status: 'completed' }), async () => { throw Error(); }, async () => {});
  assert.equal(result.sessionCleanupFailed, true); assert.equal(result.error, undefined);
});
test('local key erasure includes all StudyBolt caches and leaves other apps alone', () => {
  assert.deepEqual(studyBoltLocalAccountKeys(['@studybolt/state', '@studybolt/admin/A', '@studybolt/deleting-account/A', '@wordwiz/data', 'other']), ['@studybolt/state', '@studybolt/admin/A', '@studybolt/deleting-account/A']);
});
test('Supabase erases immediately but RevenueCat erasure waits for bounded in-flight lookups to drain', async () => {
  const f = fixture({}, { created_at: new Date().toISOString() });
  assert.equal(await runAccountDeletion(f.job, f.steps), 'pending'); assert.equal(f.job.auth_deleted, true);
  assert.ok(!f.calls.includes('rc')); assert.equal(f.calls.at(-1), 'revenuecat_drain_pending');
});
test('a stuck or recreated customer receives another safe erasure request after five minutes', async () => {
  const f = fixture({ confirmRevenueCat: async () => ({ deleted: false }) }, { storage_deleted: true, auth_deleted: true, revenuecat_requested: true, revenuecat_requested_at: new Date(Date.now() - 301000).toISOString() });
  assert.equal(await runAccountDeletion(f.job, f.steps), 'pending'); assert.ok(f.calls.includes('rc')); assert.equal(f.job.completed_at, null);
});
test('provider retry delay is preserved for the durable worker', async () => {
  let delay;
  const f = fixture({ requestRevenueCat: async () => ({ ok: false, retryable: true, retryAfterSeconds: 900 }), defer: async (_, seconds) => { delay = seconds; } });
  await runAccountDeletion(f.job, f.steps); assert.equal(delay, 900);
});
test('a definitive server refusal releases the SDK hold so unavailable setup cannot break existing restores', async () => {
  let released = false;
  const result = await submitAccountDeletion(async () => Response.json({ accepted: false, error: 'No deletion job recorded' }, { status: 503 }), async () => assert.fail(), async () => { released = true; });
  assert.equal(released, true); assert.ok(result.error);
});
