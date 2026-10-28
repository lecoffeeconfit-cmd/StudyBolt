export type RevenueCatCustomerDeletion =
  | { ok: true; outcome: 'deleted' | 'already_deleted'; attempts: number }
  | { ok: false; retryable: boolean; attempts: number; status?: number; retryAfterSeconds?: number };

const MAX_ATTEMPTS = 2;
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Delete the authenticated StudyBolt user's RevenueCat customer. StudyBolt
 * configures RevenueCat with the Supabase UUID as appUserID, so the verified
 * user ID is also the RevenueCat customer ID for the v2 API.
 */
export async function deleteRevenueCatCustomer(
  appUserId: string,
  projectId: string,
  secretApiKey: string,
  fetcher: typeof fetch = fetch,
  pause: (milliseconds: number) => Promise<void> = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
): Promise<RevenueCatCustomerDeletion> {
  if (!appUserId.trim() || !projectId.trim() || !secretApiKey.trim()) {
    return { ok: false, retryable: false, attempts: 0 };
  }

  const url = `https://api.revenuecat.com/v2/projects/${encodeURIComponent(projectId)}/customers/${encodeURIComponent(appUserId)}`;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let response: Response;
    try {
      response = await fetcher(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${secretApiKey}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      if (attempt < MAX_ATTEMPTS) {
        await pause(250);
        continue;
      }
      return { ok: false, retryable: true, attempts: attempt };
    }

    if (response.ok) return { ok: true, outcome: 'deleted', attempts: attempt };
    // The v2 API returns 404 when a prior retry already removed this customer.
    if (response.status === 404) return { ok: true, outcome: 'already_deleted', attempts: attempt };

    const retryable = response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500;
    const retryAfterSeconds = parseRetryAfter(response.headers.get('Retry-After'));
    if (!retryable || attempt === MAX_ATTEMPTS || (retryAfterSeconds !== null && retryAfterSeconds > 2)) {
      return {
        ok: false,
        retryable,
        attempts: attempt,
        status: response.status,
        ...(retryAfterSeconds === null ? {} : { retryAfterSeconds }),
      };
    }

    await pause(retryAfterSeconds === null ? 250 : retryAfterSeconds * 1000);
  }

  return { ok: false, retryable: true, attempts: MAX_ATTEMPTS };
}

function parseRetryAfter(value: string | null): number | null {
  if (!value?.trim() || !/^\d+$/.test(value.trim())) return null;
  const seconds = Number(value.trim());
  return Number.isSafeInteger(seconds) && seconds > 0 ? seconds : null;
}
