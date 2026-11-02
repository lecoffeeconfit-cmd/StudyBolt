import { createClient } from 'npm:@supabase/supabase-js@2';
import { processAccountDeletion } from '../_shared/accountDeletionStore.ts';

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const expected = Deno.env.get('STUDYBOLT_DELETION_WORKER_SECRET') ?? '';
  const supplied = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const project = Deno.env.get('REVENUECAT_PROJECT_ID');
  const key = Deno.env.get('REVENUECAT_DELETION_API_KEY');
  if (expected.length < 32 || !url || !serviceKey || !project || !key) return json({ error: 'Worker is not configured' }, 503);
  let difference = expected.length ^ supplied.length;
  for (let i = 0; i < expected.length; i += 1) difference |= expected.charCodeAt(i) ^ (supplied.charCodeAt(i) || 0);
  if (difference) return json({ error: 'Unauthorized' }, 401);
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: jobs, error } = await admin.from('studybolt_account_deletions')
    .select('user_id').is('completed_at', null).lte('next_attempt_at', new Date().toISOString())
    .order('next_attempt_at').limit(2);
  if (error) return json({ error: 'Deletion queue unavailable' }, 503);
  let completed = 0;
  let pending = 0;
  const started = Date.now();
  for (const job of jobs ?? []) {
    if (Date.now() - started > 30_000) break;
    try {
      const result = await processAccountDeletion(admin, job.user_id, project, key);
      if (result === 'completed') completed += 1; else pending += 1;
    } catch { pending += 1; }
  }
  // Minimal operational identifiers and token hashes expire after 30 days.
  const { error: purgeError } = await admin.from('studybolt_account_deletions').delete()
    .lt('completed_at', new Date(Date.now() - 30 * 86400_000).toISOString());
  return json({ completed, pending, retentionPurgeFailed: Boolean(purgeError) }, purgeError ? 503 : 200);
});
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
