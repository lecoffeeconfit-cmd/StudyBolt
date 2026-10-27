import { accountActionError, complimentaryExpiry, effectiveStudyBoltPlan } from './adminPolicy.ts';

function assert(value: unknown, message: string) { if (!value) throw new Error(message); }
const now = Date.parse('2026-10-12T12:00:00.000Z');

Deno.test('complimentary access expires at the boundary and rejects malformed metadata', () => {
  assert(effectiveStudyBoltPlan({ studybolt_complimentary_until: '2026-10-12T12:00:01.000Z' }, now) === 'premium', 'Active access should be premium');
  assert(effectiveStudyBoltPlan({ studybolt_complimentary_until: '2026-10-12T12:00:00.000Z' }, now) === 'free', 'Expired access must be free');
  for (const value of [undefined, null, true, 42, '', 'not a date', '2026-99-99T00:00:00Z']) {
    assert(effectiveStudyBoltPlan({ studybolt_complimentary_until: value }, now) === 'free', 'Malformed access must not elevate a learner');
  }
});

Deno.test('StudyBolt paid access is scoped and expires independently of complimentary access', () => {
  assert(effectiveStudyBoltPlan({ studybolt_subscription_tier: 'premium', studybolt_subscription_expires_at: new Date(now + 1).toISOString(), studybolt_complimentary_until: null }, now) === 'premium', 'Revoking a gift must not revoke an active subscription');
  assert(effectiveStudyBoltPlan({ studybolt_subscription_tier: 'premium', studybolt_subscription_expires_at: '2000-01-01', studybolt_complimentary_until: '2000-01-01' }, now) === 'free', 'Expired access must become free');
  assert(effectiveStudyBoltPlan({ subscription_tier: 'premium' }, now) === 'free', 'Another product’s generic entitlement must not grant StudyBolt Premium');
  assert(effectiveStudyBoltPlan({ subscription_tier: 'free' }, now) === 'free', 'Free should remain free');
});

Deno.test('new gifts last thirty days and renewals extend the existing period', () => {
  const first = complimentaryExpiry(null, now);
  assert(Date.parse(first) === now + 30 * 86400000, 'A new gift should last thirty days');
  assert(Date.parse(complimentaryExpiry(first, now)) === now + 60 * 86400000, 'Renewal should extend access');
  assert(complimentaryExpiry('invalid', now) === first, 'Invalid dates should start from now');
  assert(complimentaryExpiry('2000-01-01T00:00:00Z', now) === first, 'Expired gifts should start from now');
});

Deno.test('account actions protect the caller and every other admin', () => {
  assert(accountActionError('actor', 'actor', false) !== null, 'Self modification must be rejected');
  assert(accountActionError('actor', 'other-admin', true) !== null, 'Admin modification must be rejected');
  assert(accountActionError('actor', 'learner', false) === null, 'Learner actions should be permitted after membership checks');
});
