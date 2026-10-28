import { createClient } from 'npm:@supabase/supabase-js@2';
import { deleteRevenueCatCustomer } from '../_shared/revenuecatCustomer.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authorization = request.headers.get('Authorization');
  const token = authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Missing authorization token' }, 401);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const revenueCatProjectId = Deno.env.get('REVENUECAT_PROJECT_ID')?.trim();
  const revenueCatDeleteApiKey = Deno.env.get('REVENUECAT_CUSTOMER_DELETE_API_KEY')?.trim();
  if (!url || !serviceRoleKey || !revenueCatProjectId || !revenueCatDeleteApiKey) {
    return json({ error: 'Account deletion is temporarily unavailable. Please try again later.' }, 503);
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error: userError } = await admin.auth.getUser(token);
  if (userError || !user) return json({ error: 'Your session is no longer valid' }, 401);

  // Purchases.configure and logIn use the authenticated Supabase UUID as the
  // RevenueCat app user ID. Remove that customer before deleting Auth so a
  // retry remains possible if either external cleanup or Auth deletion fails.
  const revenueCatDeletion = await deleteRevenueCatCustomer(
    user.id,
    revenueCatProjectId,
    revenueCatDeleteApiKey,
  );
  if (!revenueCatDeletion.ok) {
    const headers = revenueCatDeletion.retryAfterSeconds
      ? { 'Retry-After': String(revenueCatDeletion.retryAfterSeconds) }
      : undefined;
    return json({
      error: revenueCatDeletion.retryable
        ? 'Subscription data could not be deleted yet. Please try account deletion again shortly.'
        : 'Subscription data could not be deleted. Your account was not deleted; please contact support.',
    }, revenueCatDeletion.retryable ? 503 : 502, headers);
  }

  // Storage objects do not cascade when the auth.users row is deleted. Remove
  // the user's private slide images first so account deletion removes them too.
  try {
    await removeUserVisuals(admin, user.id);
  } catch (error) {
    console.error('delete-account: visual cleanup failed', error);
    return json({ error: 'Your study images could not be deleted. Please try again.' }, 500);
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) return json({ error: 'The account could not be deleted' }, 500);
  return json({ deleted: true });
});

async function removeUserVisuals(admin: ReturnType<typeof createClient>, userId: string): Promise<void> {
  const bucket = admin.storage.from('studybolt-visuals');
  const files: string[] = [];
  const directories = [userId];

  while (directories.length) {
    const directory = directories.pop()!;
    let offset = 0;
    while (true) {
      const { data, error } = await bucket.list(directory, { limit: 1000, offset });
      if (error) throw error;
      const entries = data ?? [];
      for (const entry of entries) {
        const path = `${directory}/${entry.name}`;
        if (entry.id) files.push(path);
        else directories.push(path);
      }
      if (entries.length < 1000) break;
      offset += entries.length;
    }
  }

  for (let index = 0; index < files.length; index += 100) {
    const { error } = await bucket.remove(files.slice(index, index + 100));
    if (error) throw error;
  }
}

function json(payload: Record<string, unknown>, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders },
  });
}
