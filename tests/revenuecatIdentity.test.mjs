import assert from 'node:assert/strict';
import test from 'node:test';
import { createRevenueCatIdentityQueue } from '../src/services/revenuecatIdentity.ts';
function fixture(id = null, hold = async () => false) {
  const calls = [];
  const sdk = { isConfigured: async () => id !== null, configure: (config) => { id = config.appUserID; calls.push('configure:' + id); }, getAppUserID: async () => id,
    isAnonymous: async () => id?.startsWith('$RCAnonymousID:'), logIn: async (next) => { id = next; calls.push('login:' + id); }, logOut: async () => { calls.push('logout:' + id); id = '$RCAnonymousID:new'; } };
  return { sdk, calls, queue: createRevenueCatIdentityQueue(sdk, hold), id: () => id };
}
test('signed-out startup never configures an anonymous customer', async () => {
  const f = fixture(); await f.queue.withUser(null, 'public', () => assert.fail()); assert.deepEqual(f.calls, []);
});
test('first use configures Supabase UUID and a valid restore action runs on that ID', async () => {
  const f = fixture(); const result = await f.queue.withUser('A', 'public', async () => ({ originalAppUserId: f.id(), restored: true }));
  assert.deepEqual(f.calls, ['configure:A']); assert.equal(result.originalAppUserId, 'A'); assert.equal(result.restored, true);
});
test('actual cached SDK identity is checked and changed before restoring', async () => {
  const f = fixture('B'); await f.queue.withUser('A', 'public', async () => { assert.equal(f.id(), 'A'); }); assert.deepEqual(f.calls, ['login:A']);
});
test('mismatched login cannot execute a purchase/restore', async () => {
  const f = fixture('B'); f.sdk.logIn = async () => {}; await assert.rejects(() => f.queue.withUser('A', 'public', async () => assert.fail()), /could not be verified/);
});
test('concurrent purchase actions cannot run under another account identity', async () => {
  const f = fixture('A'); let release; const gate = new Promise((resolve) => { release = resolve; }); const seen = [];
  const first = f.queue.withUser('A', 'public', async () => { seen.push(f.id()); await gate; seen.push(f.id()); });
  const second = f.queue.withUser('B', 'public', async () => { seen.push(f.id()); });
  release(); await Promise.all([first, second]); assert.deepEqual(seen, ['A', 'A', 'B']);
});
test('deletion hold prevents re-login and restores for that account', async () => {
  const f = fixture('B', async (id) => id === 'A'); await assert.rejects(() => f.queue.withUser('A', 'public', async () => assert.fail()), /deletion is pending/); assert.deepEqual(f.calls, []);
});
test('detaching a deleted account never logs out another account', async () => {
  const f = fixture('B'); await f.queue.detach('A'); assert.deepEqual(f.calls, []);
  await f.queue.detach('B'); assert.deepEqual(f.calls, ['logout:B']);
});
test('failed SDK action does not poison later user operations', async () => {
  const f = fixture('A'); await assert.rejects(() => f.queue.withUser('A', 'public', async () => { throw Error('cancelled'); }));
  assert.equal(await f.queue.withUser('B', 'public', async () => f.id()), 'B');
});
