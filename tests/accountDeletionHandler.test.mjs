import assert from 'node:assert/strict';
import test from 'node:test';
import { createAccountDeletionHandler } from '../supabase/functions/_shared/accountDeletionHandler.ts';
const config = { url: 'https://test.invalid', serviceKey: 'server-only', project: 'projtest', key: 'sk_test', workerEnabled: true, workerSecret: 'x'.repeat(32) };
function fixture(options = {}) {
  const calls = []; const user = options.noUser ? null : { id: 'A' };
  const query = { select: () => query, update: (values) => { calls.push(['resume', values]); return query; }, eq: (key, value) => { calls.push([key, value]); return query; }, maybeSingle: async () => ({ data: options.prior ?? null }) };
  const admin = { auth: { getUser: async (token) => { calls.push(['auth', token]); return { data: { user }, error: !user ? {} : null }; } }, from: () => query,
    rpc: async (name, args) => { calls.push([name, args]); return { error: options.rpcError }; } };
  const handler = createAccountDeletionHandler({ ...config, ...options.config }, () => admin,
    async (_, userId) => { calls.push(['process', userId]); if (options.crash) throw Error(); return options.status ?? 'pending'; },
    async (userId) => { calls.push(['inspect', userId]); return options.inspection ?? { ok: true, outcome: 'safe' }; });
  return { calls, handler };
}
const request = (body = { confirmation: 'DELETE_ACCOUNT' }, token = 'original-token') => new Request('https://test.invalid/delete', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: JSON.stringify(body) });
test('confirmation is explicit, authenticated, and bounded before any provider operation', async () => {
  const f = fixture();
  assert.equal((await f.handler(request({}))).status, 400);
  assert.equal((await f.handler(new Request('https://test.invalid', { method: 'POST', body: '{}' }))).status, 401);
  assert.equal((await f.handler(request({ confirmation: 'DELETE_ACCOUNT', extra: 'x'.repeat(1024) }))).status, 413);
  assert.equal((await f.handler(new Request('https://test.invalid', { method: 'GET' }))).status, 405);
  assert.deepEqual(f.calls, []);
});
test('only the authenticated user can be deleted; arbitrary target ID is ignored', async () => {
  const f = fixture(); const response = await f.handler(request({ confirmation: 'DELETE_ACCOUNT', user_id: 'B' }));
  assert.equal(response.status, 202); assert.ok(f.calls.some(([action, id]) => action === 'process' && id === 'A'));
  const rpc = f.calls.find(([action]) => action === 'request_studybolt_account_deletion')[1];
  assert.equal(rpc.p_user_id, 'A'); assert.match(rpc.p_token_hash, /^[a-f0-9]{64}$/); assert.notEqual(rpc.p_token_hash, 'original-token');
});
test('requires a usable retry worker before accepting destructive work', async () => {
  for (const overrides of [{ workerEnabled: false }, { workerSecret: 'short' }]) {
    const f = fixture({ config: overrides }); const response = await f.handler(request());
    assert.equal(response.status, 503); assert.equal((await response.json()).accepted, false);
    assert.ok(!f.calls.some(([action]) => ['process', 'inspect', 'request_studybolt_account_deletion'].includes(action)));
  }
});
test('shared cross-app identity or shared RevenueCat profile stops before deletion', async () => {
  for (const options of [{ rpcError: { message: 'shared_identity_requires_review' } }, { inspection: { ok: false, configurationError: 'shared_customer_requires_review' } }]) {
    const f = fixture(options); assert.equal((await f.handler(request())).status, 409); assert.ok(!f.calls.some(([action]) => action === 'process'));
  }
});
test('after Auth removal, only the hash of the original validated token resumes the recorded request', async () => {
  const f = fixture({ noUser: true, prior: { user_id: 'A', completed_at: null } });
  assert.equal((await f.handler(request())).status, 202);
  assert.ok(f.calls.some(([field, hash]) => field === 'request_token_hash' && /^[a-f0-9]{64}$/.test(hash)));
  assert.ok(!f.calls.some(([action]) => action === 'inspect'));
  assert.ok(f.calls.some(([action, id]) => action === 'process' && id === 'A'));
  const invalid = fixture({ noUser: true }); assert.equal((await invalid.handler(request({}, 'fake'))).status, 400);
  assert.equal((await invalid.handler(request(undefined, 'fake'))).status, 401);
});
test('completed repeat request acknowledges safely without another destructive operation', async () => {
  const f = fixture({ noUser: true, prior: { user_id: 'A', completed_at: 'done' } });
  assert.deepEqual(await (await f.handler(request())).json(), { deleted: true, status: 'completed' });
  assert.ok(!f.calls.some(([action]) => action === 'process'));
});
test('accepted partial failure returns pending, while completion is explicit', async () => {
  const warn = console.error; console.error = () => {};
  try {
    const f = fixture({ crash: true }); assert.equal((await f.handler(request())).status, 202);
    const complete = fixture({ status: 'completed' }); assert.deepEqual(await (await complete.handler(request())).json(), { deleted: true, status: 'completed' });
  } finally { console.error = warn; }
});
test('an already-recorded deletion is acknowledged even after new requests are paused', async () => {
  const f = fixture({ prior: { user_id: 'A', completed_at: null }, config: { workerEnabled: false, key: undefined } });
  const response = await f.handler(request()); assert.equal(response.status, 202); assert.equal((await response.json()).accepted, true);
  assert.ok(!f.calls.some(([action]) => ['inspect', 'request_studybolt_account_deletion'].includes(action)));
});
