import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchRevenueCatEntitlement } from '../supabase/functions/_shared/revenuecat.ts';

const future = new Date(Date.now() + 86400000).toISOString();
const past = new Date(Date.now() - 86400000).toISOString();
const subscriber = (store, expires = future, grace = null) => ({
  subscriber: {
    entitlements: { premium: { product_identifier: 'monthly', expires_date: expires, grace_period_expires_date: grace } },
    subscriptions: { monthly: { store, is_sandbox: true } },
  },
});
async function lookup(t, payload, status = 200) {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.revenuecat.com/v1/subscribers/account%2Fone');
    assert.equal(options.headers.Authorization, 'Bearer backend-read-key');
    return new Response(JSON.stringify(payload), { status });
  });
  return fetchRevenueCatEntitlement('account/one', 'premium', 'backend-read-key');
}

for (const store of ['app_store', 'mac_app_store', 'play_store']) {
  test(`${store} subscriptions retain server access, including Apple sandbox`, async (t) => {
    assert.deepEqual(await lookup(t, subscriber(store)), { active: true, expiresAt: future });
  });
}
test('Test Store simulation cannot grant production backend Premium', async (t) => {
  assert.deepEqual(await lookup(t, subscriber('test_store')), { active: false, expiresAt: null });
});
test('unknown stores cannot grant production backend Premium', async (t) => {
  assert.deepEqual(await lookup(t, subscriber('unexpected_store')), { active: false, expiresAt: null });
});
test('Apple billing grace continues access until the grace expiry', async (t) => {
  assert.deepEqual(await lookup(t, subscriber('app_store', past, future)), { active: true, expiresAt: future });
});
test('expired subscriptions cannot grant access', async (t) => {
  assert.deepEqual(await lookup(t, subscriber('app_store', past)), { active: false, expiresAt: past });
});
test('unverifiable store fails without overwriting the last verified entitlement', async (t) => {
  const payload = subscriber('app_store');
  delete payload.subscriber.subscriptions;
  await assert.rejects(lookup(t, payload), /store could not be verified/);
});
test('customer absence is free access', async (t) => {
  assert.deepEqual(await lookup(t, {}, 404), { active: false, expiresAt: null });
});
test('provider failure remains retryable rather than reporting free', async (t) => {
  await assert.rejects(lookup(t, {}, 503), /lookup failed with 503/);
});
