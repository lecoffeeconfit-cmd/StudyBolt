const LIVE_BACKEND_HOSTS = new Set([
  'studybolt-api.duckdns.org',
  'kbyeyobbhhnafscygiel.supabase.co',
]);

export type StudyBoltEnvironment = 'development' | 'staging' | 'production';

export function getStudyBoltEnvironment(): StudyBoltEnvironment {
  const value = process.env.EXPO_PUBLIC_APP_ENV?.trim().toLowerCase();
  if (value === 'staging' || value === 'production') return value;
  return 'development';
}

/**
 * Staging builds fail closed if an EAS preview variable is accidentally copied
 * from production. The Supabase URL fronts auth, storage, and every backend
 * function, so rejecting it here protects all of those write paths together.
 */
export function resolveBackendUrl(value: string | undefined): string {
  return resolveEnvironmentUrl(value);
}

/** Keep the document processor on the same explicit environment as the app. */
export function resolveProcessorUrl(value: string | undefined): string {
  return resolveEnvironmentUrl(value);
}

function resolveEnvironmentUrl(value: string | undefined): string {
  const candidate = value?.trim() ?? '';
  if (!candidate) return '';

  if (getStudyBoltEnvironment() === 'staging') {
    try {
      const hostname = new URL(candidate).hostname.toLowerCase();
      if (LIVE_BACKEND_HOSTS.has(hostname)) return '';
    } catch {
      // Keep invalid URLs out of staging too; the caller treats an empty value
      // as an unconfigured backend and does not send a request.
      return '';
    }
  }

  return candidate.replace(/\/$/, '');
}
