import { createClient } from 'npm:@supabase/supabase-js@2';
import { createAccountDeletionHandler } from '../_shared/accountDeletionHandler.ts';

const url = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
Deno.serve(createAccountDeletionHandler({
  url, serviceKey,
  project: Deno.env.get('REVENUECAT_PROJECT_ID')?.trim(),
  key: Deno.env.get('REVENUECAT_DELETION_API_KEY')?.trim(),
  workerEnabled: Deno.env.get('STUDYBOLT_DELETION_WORKER_ENABLED') === 'true',
  workerSecret: Deno.env.get('STUDYBOLT_DELETION_WORKER_SECRET'),
}, () => createClient(url!, serviceKey!, { auth: { autoRefreshToken: false, persistSession: false } })));
