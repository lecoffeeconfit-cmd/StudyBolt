import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { stripTypeScriptTypes } from 'node:module';

const source = await readFile(new URL('../supabase/functions/_shared/adminPolicy.ts', import.meta.url), 'utf8');
const policy = await import(`data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(source))}`);

test('registered free accounts and RevenueCat premium accounts keep the existing server plan rules', () => {
  const now = Date.parse('2026-11-22T12:00:00.000Z');
  assert.equal(policy.effectiveStudyBoltPlan({}, now), 'free');
  assert.equal(policy.effectiveStudyBoltPlan({ studybolt_subscription_tier: 'premium', studybolt_subscription_expires_at: '2026-12-01T00:00:00Z' }, now), 'premium');
  assert.equal(policy.effectiveStudyBoltPlan({ studybolt_subscription_tier: 'premium', studybolt_subscription_expires_at: '2026-11-01T00:00:00Z' }, now), 'free');
  assert.equal(policy.effectiveStudyBoltPlan({ subscription_tier: 'premium' }, now), 'free');
});
