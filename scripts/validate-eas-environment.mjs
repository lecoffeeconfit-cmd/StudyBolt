import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LIVE_BACKEND_HOSTS = new Set([
  'studybolt-api.duckdns.org',
  'kbyeyobbhhnafscygiel.supabase.co',
]);

const PROFILE_ENVIRONMENTS = {
  development: 'development',
  preview: 'staging',
  'testflight-staging': 'staging',
  production: 'production',
};

export function validateEasBuildEnvironment(environment) {
  const errors = [];
  const profile = environment.EAS_BUILD_PROFILE;
  const expectedAppEnvironment = PROFILE_ENVIRONMENTS[profile];

  if (!expectedAppEnvironment) {
    errors.push('EAS_BUILD_PROFILE is missing or is not an approved StudyBolt profile.');
    return errors;
  }

  if (environment.EXPO_PUBLIC_APP_ENV !== expectedAppEnvironment) {
    errors.push(`The ${profile} EAS profile must use EXPO_PUBLIC_APP_ENV=${expectedAppEnvironment}.`);
  }

  if (expectedAppEnvironment === 'development') return errors;

  requireHttpsUrl(environment.EXPO_PUBLIC_SUPABASE_URL, 'EXPO_PUBLIC_SUPABASE_URL', errors);
  if (!environment.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim()) {
    errors.push('EXPO_PUBLIC_SUPABASE_ANON_KEY is not configured.');
  }
  requireHttpsUrl(environment.EXPO_PUBLIC_STUDYBOLT_PROCESSOR_URL, 'EXPO_PUBLIC_STUDYBOLT_PROCESSOR_URL', errors);

  return errors;
}

function requireHttpsUrl(value, name, errors) {
  if (!value?.trim()) {
    errors.push(`${name} is not configured.`);
    return;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') errors.push(`${name} must use HTTPS.`);
    if (LIVE_BACKEND_HOSTS.has(url.hostname.toLowerCase())) {
      errors.push(`${name} points to a known production host.`);
    }
  } catch {
    errors.push(`${name} must be a valid HTTPS URL.`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = validateEasBuildEnvironment(process.env);
  if (errors.length) {
    console.error(`StudyBolt EAS build configuration rejected:\n- ${errors.join('\n- ')}`);
    process.exitCode = 1;
  } else {
    console.log('StudyBolt EAS build configuration validated.');
  }
}
