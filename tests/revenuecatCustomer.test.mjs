import assert from 'node:assert/strict';
import test from 'node:test';
import { deleteRevenueCatCustomer } from '../supabase/functions/_shared/revenuecatCustomer.ts';

test('customer cleanup calls the v2 delete endpoint with encoded IDs and a bearer key', async () => {
  let url;
  let init;
  const result = await deleteRevenueCatCustomer('user/123', 'proj/abc', 'sk_test_key', async (input, options) => {
    url = String(input);
    init = options;
    return new Response(null, { status: 200 });
  });

  assert.equal(url, 'https://api.revenuecat.com/v2/projects/proj%2Fabc/customers/user%2F123');
  assert.equal(init.method, 'DELETE');
  assert.equal(new Headers(init.headers).get('Authorization'), 'Bearer sk_test_key');
  assert.deepEqual(result, { ok: true, outcome: 'deleted', attempts: 1 });
});

test('404 means the RevenueCat customer has already been removed', async () => {
  const result = await deleteRevenueCatCustomer('user-123', 'proj-123', 'sk_test_key', async () => new Response(null, { status: 404 }));
  assert.deepEqual(result, { ok: true, outcome: 'already_deleted', attempts: 1 });
});

test('transient server errors are retried once after a bounded delay', async () => {
  let attempts = 0;
  const pauses = [];
  const result = await deleteRevenueCatCustomer(
    'user-123',
    'proj-123',
    'sk_test_key',
    async () => {
      attempts += 1;
      return new Response(null, { status: attempts === 1 ? 503 : 200 });
    },
    async (milliseconds) => { pauses.push(milliseconds); },
  );

  assert.deepEqual(result, { ok: true, outcome: 'deleted', attempts: 2 });
  assert.deepEqual(pauses, [250]);
});

test('permission failures return a non-retryable error without a second request', async () => {
  let attempts = 0;
  const result = await deleteRevenueCatCustomer('user-123', 'proj-123', 'sk_test_key', async () => {
    attempts += 1;
    return new Response(null, { status: 403 });
  });

  assert.deepEqual(result, { ok: false, retryable: false, attempts: 1, status: 403 });
  assert.equal(attempts, 1);
});

test('a long provider Retry-After is returned to the caller without an early retry', async () => {
  let attempts = 0;
  const result = await deleteRevenueCatCustomer('user-123', 'proj-123', 'sk_test_key', async () => {
    attempts += 1;
    return new Response(null, { status: 429, headers: { 'Retry-After': '8' } });
  });

  assert.deepEqual(result, { ok: false, retryable: true, attempts: 1, status: 429, retryAfterSeconds: 8 });
  assert.equal(attempts, 1);
});

test('network failures receive one bounded retry', async () => {
  let attempts = 0;
  const result = await deleteRevenueCatCustomer(
    'user-123',
    'proj-123',
    'sk_test_key',
    async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('network unavailable');
      return new Response(null, { status: 200 });
    },
    async () => undefined,
  );

  assert.deepEqual(result, { ok: true, outcome: 'deleted', attempts: 2 });
});
