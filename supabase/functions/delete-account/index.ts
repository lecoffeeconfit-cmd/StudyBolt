import { createClient } from 'npm:@supabase/supabase-js@2';

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
  if (!url || !serviceRoleKey) return json({ error: 'Server configuration is incomplete' }, 500);

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error: userError } = await admin.auth.getUser(token);
  if (userError || !user) return json({ error: 'Your session is no longer valid' }, 401);

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

function json(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
