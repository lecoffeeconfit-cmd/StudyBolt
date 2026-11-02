export type RevenueCatCustomerDeletion =
  | { ok: true; outcome: 'queued' | 'already_deleted'; attempts: number }
  | { ok: false; retryable: boolean; attempts: number; status?: number; retryAfterSeconds?: number;
      configurationError?: 'missing_credentials' | 'secret_api_key_required' | 'invalid_project' | 'shared_customer_requires_review' };

type RequestResult = { ok: true; response: Response; attempts: number }
  | Extract<RevenueCatCustomerDeletion, { ok: false }>;

function configuration(appUserId: string, projectId: string, secret: string): Extract<RevenueCatCustomerDeletion, { ok: false }> | null {
  if (!appUserId.trim() || !projectId.trim() || !secret.trim()) return { ok: false, retryable: false, attempts: 0, configurationError: 'missing_credentials' };
  if (!secret.trim().startsWith('sk_')) return { ok: false, retryable: false, attempts: 0, configurationError: 'secret_api_key_required' };
  return null;
}

async function request(url: string, method: string, key: string, fetcher: typeof fetch, pause: (ms: number) => Promise<void>): Promise<RequestResult> {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetcher(url, {
        method, headers: { Authorization: 'Bearer ' + key.trim(), Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });
      if (response.ok || response.status === 404) return { ok: true, response, attempts: attempt };
      const retryable = [408, 423, 425, 429].includes(response.status) || response.status >= 500;
      const header = response.headers.get('Retry-After');
      const delay = header && /^\d+$/.test(header.trim()) ? Number(header) : header ? Math.ceil((Date.parse(header) - Date.now()) / 1000) : NaN;
      const retryAfterSeconds = Number.isFinite(delay) && delay > 0 ? delay : undefined;
      if (!retryable || attempt === 2 || (retryAfterSeconds ?? 0) > 2) {
        return { ok: false, retryable, attempts: attempt, status: response.status, ...(retryAfterSeconds ? { retryAfterSeconds } : {}) };
      }
      await pause((retryAfterSeconds ?? 0.25) * 1000);
    } catch {
      if (attempt === 2) return { ok: false, retryable: true, attempts: attempt };
      await pause(250);
    }
  }
  return { ok: false, retryable: true, attempts: 2 };
}
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const root = (projectId: string) => 'https://api.revenuecat.com/v2/projects/' + encodeURIComponent(projectId.trim());

async function checkProject(projectId: string, key: string, fetcher: typeof fetch, pause: (ms: number) => Promise<void>): Promise<RequestResult> {
  // A bounded customer-list read validates the project before deletion. A wrong
  // project must never look like an erased user.
  const result = await request(root(projectId) + '/customers?limit=1', 'GET', key, fetcher, pause);
  if (!result.ok) return result;
  if (result.response.status === 404) return { ok: false, retryable: false, attempts: result.attempts, status: 404, configurationError: 'invalid_project' };
  try {
    const data = await result.response.clone().json();
    if (!Array.isArray(data.items)) return { ok: false, retryable: true, attempts: result.attempts };
  } catch { return { ok: false, retryable: true, attempts: result.attempts }; }
  return result;
}

/** Check configuration and aliases before removing any StudyBolt data. */
export async function inspectRevenueCatCustomerForDeletion(
  appUserId: string, projectId: string, secretApiKey: string,
  fetcher: typeof fetch = fetch, pause: (ms: number) => Promise<void> = sleep,
): Promise<Exclude<RevenueCatCustomerDeletion, { ok: true }> | { ok: true; outcome: 'safe' | 'already_deleted'; attempts: number }> {
  const invalid = configuration(appUserId, projectId, secretApiKey);
  if (invalid) return invalid;
  const project = await checkProject(projectId, secretApiKey, fetcher, pause);
  if (!project.ok) return project;
  const customerUrl = root(projectId) + '/customers/' + encodeURIComponent(appUserId.trim());

  // Erasing a merged profile would erase every alias. Never delete another identified account.
  let cursor = '';
  for (let page = 0; page < 10; page += 1) {
    const aliases = await request(customerUrl + '/aliases?limit=100' + (cursor ? '&starting_after=' + encodeURIComponent(cursor) : ''), 'GET', secretApiKey, fetcher, pause);
    if (!aliases.ok) return aliases;
    if (aliases.response.status === 404) return { ok: true, outcome: 'already_deleted', attempts: aliases.attempts };
    let data: { items?: Array<{ id?: unknown }>; next_page?: unknown };
    try { data = await aliases.response.json(); } catch { return { ok: false, retryable: true, attempts: aliases.attempts }; }
    if (!Array.isArray(data.items)) return { ok: false, retryable: true, attempts: aliases.attempts };
    if (data.items.some((alias) => typeof alias.id !== 'string' || (alias.id !== appUserId.trim() && !alias.id.startsWith('$RCAnonymousID:')))) {
      return { ok: false, retryable: false, attempts: aliases.attempts, configurationError: 'shared_customer_requires_review' };
    }
    if (!data.next_page) break;
    const last = data.items.at(-1)?.id;
    if (page === 9 || typeof last !== 'string' || !last || last === cursor) return { ok: false, retryable: false, attempts: aliases.attempts, configurationError: 'shared_customer_requires_review' };
    cursor = last;
  }
  return { ok: true, outcome: 'safe', attempts: 1 };
}

/** DELETE is asynchronous. A 200 means queued, not erased or billing cancelled. */
export async function deleteRevenueCatCustomer(
  appUserId: string, projectId: string, secretApiKey: string,
  fetcher: typeof fetch = fetch, pause: (ms: number) => Promise<void> = sleep,
): Promise<RevenueCatCustomerDeletion> {
  const check = await inspectRevenueCatCustomerForDeletion(appUserId, projectId, secretApiKey, fetcher, pause);
  if (!check.ok) return check;
  if (check.outcome === 'already_deleted') return { ok: true, outcome: 'already_deleted', attempts: check.attempts };
  const deletion = await request(root(projectId) + '/customers/' + encodeURIComponent(appUserId.trim()), 'DELETE', secretApiKey, fetcher, pause);
  if (!deletion.ok) return deletion;
  return { ok: true, outcome: deletion.response.status === 404 ? 'already_deleted' : 'queued', attempts: deletion.attempts };
}

/** v2 GET does not create a subscriber; poll until the already-validated project returns customer 404. */
export async function confirmRevenueCatCustomerDeleted(
  appUserId: string, projectId: string, secretApiKey: string,
  fetcher: typeof fetch = fetch, pause: (ms: number) => Promise<void> = sleep,
): Promise<{ deleted: boolean; retryAfterSeconds?: number }> {
  const invalid = configuration(appUserId, projectId, secretApiKey);
  if (invalid) throw new Error(invalid.configurationError);
  const project = await checkProject(projectId, secretApiKey, fetcher, pause);
  if (!project.ok) throw new Error(project.configurationError ?? 'revenuecat_confirmation_failed');
  const result = await request(root(projectId) + '/customers/' + encodeURIComponent(appUserId.trim()), 'GET', secretApiKey, fetcher, pause);
  if (!result.ok) throw new Error('revenuecat_confirmation_failed');
  return { deleted: result.response.status === 404 };
}
