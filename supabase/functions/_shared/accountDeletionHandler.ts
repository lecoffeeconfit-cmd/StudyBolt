import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { processAccountDeletion } from './accountDeletionStore.ts';
import { inspectRevenueCatCustomerForDeletion } from './revenuecatCustomer.ts';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type' };
export interface AccountDeletionConfig { url?: string; serviceKey?: string; project?: string; key?: string; workerEnabled: boolean; workerSecret?: string }
export function createAccountDeletionHandler(config: AccountDeletionConfig, createAdmin: () => SupabaseClient, process = processAccountDeletion, inspect = inspectRevenueCatCustomerForDeletion) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    const token = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
    if (!token) return json({ error: 'Missing authorization token' }, 401);
    let body = '';
    if (request.body) {
      const reader = request.body.getReader();
      let size = 0;
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 1024) { await reader.cancel(); return json({ error: 'Request is too large' }, 413); }
          body += decoder.decode(value, { stream: true });
        }
        body += decoder.decode();
      } finally { reader.releaseLock(); }
    }
    try { if (JSON.parse(body).confirmation !== 'DELETE_ACCOUNT') throw new Error(); }
    catch { return json({ error: 'Explicit account-deletion confirmation is required.' }, 400); }
  
    const { url, serviceKey, project, key, workerEnabled, workerSecret } = config;
    if (!url || !serviceKey) {
      return json({ error: 'Account deletion is temporarily unavailable. Please try again later.' }, 503);
    }
    const admin = createAdmin();
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    const { data: { user }, error: userError } = await admin.auth.getUser(token);
    let userId = user?.id;
    if (userError || !user) {
      // A response may have been lost after Auth deletion. Only the exact token
      // previously authenticated for this job can read its acknowledgement.
      const { data: prior, error } = await admin.from('studybolt_account_deletions')
        .select('user_id, completed_at').eq('request_token_hash', hash).maybeSingle();
      if (error || !prior) return json({ error: 'Your session is no longer valid' }, 401);
      if (prior.completed_at) return json({ deleted: true, status: 'completed' });
      userId = prior.user_id;
    } else {
      const { data: prior, error: priorError } = await admin.from('studybolt_account_deletions')
        .select('user_id, completed_at').eq('user_id', user.id).maybeSingle();
      if (priorError) return json({ error: 'Deletion status could not be confirmed. Please retry.' }, 503);
      if (prior?.completed_at) return json({ deleted: true, status: 'completed' });
      if (prior) {
        // An authenticated retry may carry a refreshed token. Bind recovery to
        // this token before another cleanup attempt can remove Auth.
        const { error: recoveryError } = await admin.from('studybolt_account_deletions')
          .update({ request_token_hash: hash }).eq('user_id', user.id);
        if (recoveryError) return json({ accepted: true, status: 'pending' }, 202);
      }
      if (!prior) {
        if (!project || !key || !workerEnabled || (workerSecret?.length ?? 0) < 32) {
          return json({ accepted: false, error: 'Account deletion is temporarily unavailable. No request was recorded. Please try again later.' }, 503);
        }
        const check = await inspect(user.id, project, key);
        if (!check.ok) return json({
          accepted: false,
          error: check.configurationError === 'shared_customer_requires_review'
            ? 'This subscription record is linked to more than one account. No account data was deleted. Please contact support for a safe separation.'
            : 'Subscription data cleanup could not be authorized. No account data was deleted. Please try again later.',
        }, check.configurationError === 'shared_customer_requires_review' ? 409 : 503);
        const { error } = await admin.rpc('request_studybolt_account_deletion', { p_user_id: user.id, p_token_hash: hash });
        if (error) {
          const shared = /shared_identity_requires_review|shared_storage_requires_review/.test(error.message);
          return json({ accepted: false, error: shared
            ? 'This login also owns data in another app. Nothing was deleted. Cross-app account deletion needs review to protect that data.'
            : 'Deletion could not be safely scheduled. Your account was not deleted. Please try again.' }, shared ? 409 : 503);
        }
      }
    }
    try {
      const status = project && key ? await process(admin, userId!, project, key) : 'pending';
      if (status === 'completed') return json({ deleted: true, status });
    } catch {
      // The durable journal retains the accepted request; the authenticated worker retries.
      console.error('delete-account: accepted request requires worker retry');
    }
    return json({ accepted: true, status: 'pending', message: 'Your deletion request is recorded. Remaining cleanup will continue securely. Apple billing is not cancelled.' }, 202);
  };
}
function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}
