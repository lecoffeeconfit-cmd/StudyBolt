import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { deleteRevenueCatCustomer, inspectRevenueCatCustomerForDeletion, confirmRevenueCatCustomerDeleted } from '../supabase/functions/_shared/revenuecatCustomer.ts';
const json = (data, status = 200) => Response.json(data, { status });
const noop = async () => {};

test('account deletion entry points read the configured v2 key name and project ID', () => {
  for (const entry of ['delete-account/index.ts', 'process-account-deletions/index.ts']) {
    const source = readFileSync(new URL(`../supabase/functions/${entry}`, import.meta.url), 'utf8');
    assert.match(source, /Deno\.env\.get\('REVENUECAT_PROJECT_ID'\)/);
    assert.match(source, /Deno\.env\.get\('REVENUECAT_DELETION_API_KEY'\)/);
    assert.doesNotMatch(source, /REVENUECAT_CUSTOMER_DELETE_API_KEY/);
  }
});

function provider(custom = () => undefined) {
  const calls = [];
  return { calls, fetch: async (url, options) => {
    calls.push({ url: String(url), ...options });
    return await custom(String(url), options, calls) ?? (String(url).includes('/aliases?') ? json({ items: [{ id: 'user/123' }], next_page: null }) : json({ items: [{ id: 'proj' }, { id: 'proj/abc' }] }));
  } };
}
test('v2 DELETE encodes IDs, uses only backend key, and reports queued rather than erased', async () => {
  const rc = provider();
  const result = await deleteRevenueCatCustomer('user/123', 'proj/abc', 'sk_test', rc.fetch, noop);
  assert.equal(result.outcome, 'queued');
  assert.equal(rc.calls.length, 3);
  assert.equal(rc.calls[2].url, 'https://api.revenuecat.com/v2/projects/proj%2Fabc/customers/user%2F123');
  assert.equal(rc.calls[2].method, 'DELETE');
  assert.equal(rc.calls[2].headers.Authorization, 'Bearer sk_test');
});
test('project 404 is a configuration failure, never proof of customer deletion', async () => {
  const rc = provider(() => json({}, 404));
  const result = await deleteRevenueCatCustomer('user/123', 'wrong', 'sk_test', rc.fetch, noop);
  assert.equal(result.configurationError, 'invalid_project');
  assert.equal(rc.calls.length, 1);
});
test('customer 404 after valid project is idempotently already deleted', async () => {
  const rc = provider((url) => url.includes('/customers/') ? json({}, 404) : undefined);
  assert.equal((await deleteRevenueCatCustomer('user/123', 'proj', 'sk_test', rc.fetch, noop)).outcome, 'already_deleted');
  assert.ok(rc.calls.every((call) => call.method === 'GET'));
});
test('merged profile with another identified account is never erased', async () => {
  const rc = provider((url) => url.includes('/aliases?') ? json({ items: [{ id: 'other-user' }] }) : undefined);
  assert.equal((await deleteRevenueCatCustomer('user/123', 'proj', 'sk_test', rc.fetch, noop)).configurationError, 'shared_customer_requires_review');
  assert.ok(rc.calls.every((call) => call.method !== 'DELETE'));
});
test('anonymous aliases allowed; pagination cursor encoded locally without following arbitrary URLs', async () => {
  const rc = provider((url) => url.includes('starting_after=') ? json({ items: [{ id: '$RCAnonymousID:safe' }] }) : url.includes('/aliases?') ? json({ items: [{ id: 'user/123' }], next_page: 'https://attacker.invalid' }) : undefined);
  assert.equal((await inspectRevenueCatCustomerForDeletion('user/123', 'proj', 'sk_test', rc.fetch, noop)).outcome, 'safe');
  assert.ok(rc.calls[2].url.endsWith('&starting_after=user%2F123'));
  assert.ok(rc.calls.every((call) => call.url.startsWith('https://api.revenuecat.com/')));
});
test('malformed or looping alias responses fail closed', async () => {
  for (const data of [{}, { items: [{ id: 42 }] }, { items: [], next_page: 'more' }]) {
    const rc = provider((url) => url.includes('/aliases?') ? json(data) : undefined);
    assert.equal((await deleteRevenueCatCustomer('user/123', 'proj', 'sk_test', rc.fetch, noop)).ok, false);
    assert.ok(rc.calls.every((call) => call.method !== 'DELETE'));
  }
});
test('public SDK keys and absent credentials make zero requests', async () => {
  const rc = provider();
  assert.equal((await deleteRevenueCatCustomer('user/123', 'proj', 'appl_public', rc.fetch)).configurationError, 'secret_api_key_required');
  assert.equal((await deleteRevenueCatCustomer('', 'proj', 'sk_test', rc.fetch)).configurationError, 'missing_credentials');
  assert.equal(rc.calls.length, 0);
});
test('RevenueCat project ID is required before making a provider request', async () => {
  const rc = provider();
  const result = await deleteRevenueCatCustomer('user/123', ' ', 'sk_test', rc.fetch, noop);
  assert.equal(result.configurationError, 'missing_credentials');
  assert.equal(rc.calls.length, 0);
});
test('authorization failures never retried', async () => {
  for (const status of [401, 403]) {
    const rc = provider(() => json({}, status));
    const result = await deleteRevenueCatCustomer('user/123', 'proj', 'sk_test', rc.fetch, noop);
    assert.equal(result.status, status); assert.equal(result.retryable, false); assert.equal(rc.calls.length, 1);
  }
});
test('transient deletion failures and locks receive one bounded retry', async () => {
  for (const status of [423, 503]) {
    let deletions = 0; const pauses = [];
    const rc = provider((url, options) => options.method === 'DELETE' ? (++deletions === 1 ? json({}, status) : json({})) : undefined);
    const result = await deleteRevenueCatCustomer('user/123', 'proj', 'sk_test', rc.fetch, async (ms) => pauses.push(ms));
    assert.equal(result.outcome, 'queued'); assert.equal(result.attempts, 2); assert.deepEqual(pauses, [250]);
  }
});
test('long Retry-After is returned without retrying too soon', async () => {
  const rc = provider(() => new Response(null, { status: 429, headers: { 'Retry-After': '8' } }));
  const result = await deleteRevenueCatCustomer('user/123', 'proj', 'sk_test', rc.fetch, noop);
  assert.equal(result.retryAfterSeconds, 8); assert.equal(rc.calls.length, 1);
});
test('network failure retries once', async () => {
  const rc = provider((url, options, calls) => { if (calls.length === 1) throw Error('offline'); });
  assert.equal((await deleteRevenueCatCustomer('user/123', 'proj', 'sk_test', rc.fetch, noop)).outcome, 'queued');
  assert.equal(rc.calls.length, 4);
});
test('async completion requires v2 customer 404; existing customer is still pending', async () => {
  for (const status of [200, 404]) {
    const rc = provider((url) => url.includes('/customers/') ? json({}, status) : undefined);
    assert.equal((await confirmRevenueCatCustomerDeleted('user/123', 'proj', 'sk_test', rc.fetch, noop)).deleted, status === 404);
    assert.ok(rc.calls.every((call) => call.method === 'GET' && call.url.includes('/v2/')));
  }
});
test('an empty but valid project is validated through a bounded read before customer 404', async () => {
  const rc = provider((url) => url.endsWith('/customers?limit=1') ? json({ items: [] }) : url.includes('/aliases?') ? json({}, 404) : undefined);
  assert.equal((await deleteRevenueCatCustomer('user/123', 'proj', 'sk_test', rc.fetch, noop)).outcome, 'already_deleted');
  assert.ok(rc.calls[0].url.endsWith('/projects/proj/customers?limit=1'));
});
