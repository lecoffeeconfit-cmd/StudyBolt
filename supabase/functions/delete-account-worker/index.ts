import { createClient } from 'npm:@supabase/supabase-js@2';
import { processAccountDeletion } from '../_shared/accountDeletionStore.ts';

const env = (name: string) => Deno.env.get(name)?.trim() ?? '';

function respond(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function authorized(request: Request, secret: string) {
  const token = request.headers.get('authorization')
    ?.match(/^Bearer (.+)$/i)?.[1] ?? '';

  if (!token || !secret || token.length !== secret.length) return false;

  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(token)),
    crypto.subtle.digest('SHA-256', encoder.encode(secret)),
  ]);

  return new Uint8Array(a).every(
    (value, index) => value === new Uint8Array(b)[index]
  );
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return respond({ error: 'Method not allowed' }, 405);
  }

  const secret = env('STUDYBOLT_DELETION_WORKER_SECRET');

  if (!(await authorized(request, secret))) {
    return respond({ error: 'Unauthorized' }, 401);
  }

  const url = env('SUPABASE_URL');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  const project = env('REVENUECAT_PROJECT_ID');
  const key = env('REVENUECAT_DELETION_API_KEY');

  if (
    env('STUDYBOLT_DELETION_WORKER_ENABLED') !== 'true' ||
    secret.length < 32 || !url || !serviceKey || !project || !key
  ) {
    return respond({ error: 'Worker not configured' }, 503);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const now = new Date().toISOString();

  const { data: jobs, error } = await admin
    .from('studybolt_account_deletions')
    .select('user_id')
    .is('completed_at', null)
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${now}`)
    .limit(10);

  if (error) {
    console.error('Deletion queue unavailable');
    return respond({ error: 'Queue unavailable' }, 503);
  }

  let completed = 0;
  let pending = 0;
  let failed = 0;

  for (const job of jobs ?? []) {
    try {
      const result = await processAccountDeletion(
        admin, job.user_id, project, key
      );

      if (result === 'completed') completed++;
      else pending++;
    } catch {
      failed++;
      console.error('Deletion job processing failed');
    }
  }

  return respond({
    processed: (jobs ?? []).length,
    completed,
    pending,
    failed,
  }, failed ? 503 : 200);
});
