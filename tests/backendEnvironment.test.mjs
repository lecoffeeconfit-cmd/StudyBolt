import assert from 'node:assert/strict';
import test from 'node:test';
import { getStudyBoltEnvironment, resolveBackendUrl, resolveProcessorUrl } from '../src/config/backend.ts';
import { validateEasBuildEnvironment } from '../scripts/validate-eas-environment.mjs';

test('staging refuses the production Supabase host and processor endpoint', () => {
  process.env.EXPO_PUBLIC_APP_ENV = 'staging';
  assert.equal(getStudyBoltEnvironment(), 'staging');
  assert.equal(resolveBackendUrl('https://studybolt-api.duckdns.org'), '');
  assert.equal(resolveProcessorUrl('https://studybolt-api.duckdns.org/functions/v1/studybolt-process-document'), '');
  assert.equal(resolveBackendUrl('https://kbyeyobbhhnafscygiel.supabase.co'), '');
});

test('staging accepts distinct backend URLs and strips a trailing slash', () => {
  process.env.EXPO_PUBLIC_APP_ENV = 'staging';
  assert.equal(resolveBackendUrl('https://studybolt-staging.example.test/'), 'https://studybolt-staging.example.test');
  assert.equal(resolveProcessorUrl('https://staging.example.test/process/'), 'https://staging.example.test/process');
});

test('staging treats malformed URLs as unconfigured', () => {
  process.env.EXPO_PUBLIC_APP_ENV = 'staging';
  assert.equal(resolveBackendUrl('not a URL'), '');
  assert.equal(resolveProcessorUrl(undefined), '');
});

test('production retains the configured production URL', () => {
  process.env.EXPO_PUBLIC_APP_ENV = 'production';
  assert.equal(resolveBackendUrl('https://studybolt-api.duckdns.org/'), 'https://studybolt-api.duckdns.org');
});

test('TestFlight build profile rejects a production marker and production endpoints', () => {
  const validStaging = {
    EAS_BUILD_PROFILE: 'testflight-staging',
    EXPO_PUBLIC_APP_ENV: 'staging',
    EXPO_PUBLIC_SUPABASE_URL: 'https://studybolt-staging.example.test',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: 'public-test-key',
    EXPO_PUBLIC_STUDYBOLT_PROCESSOR_URL: 'https://studybolt-staging.example.test/functions/v1/studybolt-process-document',
  };
  assert.deepEqual(validateEasBuildEnvironment(validStaging), []);
  assert.ok(validateEasBuildEnvironment({
    ...validStaging,
    EXPO_PUBLIC_APP_ENV: 'production',
  }).some((error) => error.includes('must use EXPO_PUBLIC_APP_ENV=staging')));
  assert.ok(validateEasBuildEnvironment({
    ...validStaging,
    EXPO_PUBLIC_SUPABASE_URL: 'https://kbyeyobbhhnafscygiel.supabase.co',
  }).some((error) => error.includes('known production host')));
  assert.ok(validateEasBuildEnvironment({
    ...validStaging,
    EXPO_PUBLIC_STUDYBOLT_PROCESSOR_URL: 'https://studybolt-api.duckdns.org/functions/v1/studybolt-process-document',
  }).some((error) => error.includes('known production host')));
});

test('production and development profiles require their matching environment markers', () => {
  assert.deepEqual(validateEasBuildEnvironment({
    EAS_BUILD_PROFILE: 'development',
    EXPO_PUBLIC_APP_ENV: 'development',
  }), []);

  const productionErrors = validateEasBuildEnvironment({
    EAS_BUILD_PROFILE: 'production',
    EXPO_PUBLIC_APP_ENV: 'staging',
    EXPO_PUBLIC_SUPABASE_URL: 'https://studybolt.example.test',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: 'public-test-key',
    EXPO_PUBLIC_STUDYBOLT_PROCESSOR_URL: 'https://studybolt.example.test/functions/v1/studybolt-process-document',
  });
  assert.ok(productionErrors.some((error) => error.includes('must use EXPO_PUBLIC_APP_ENV=production')));
});
