import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.116.0';
import { accountActionError, ADMIN_USER_ACTIONS, complimentaryExpiry, UUID_PATTERN, type AdminUserAction } from '../_shared/adminPolicy.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const STATUSES = new Set(['new', 'reviewing', 'resolved', 'closed']);
const PRIORITIES = new Set(['low', 'normal', 'high', 'critical']);

function serverKey(dictionary: string, fallback: string): string | undefined {
  try {
    const keys = JSON.parse(Deno.env.get(dictionary) ?? '{}') as Record<string, string>;
    return keys.default || Object.values(keys).find(value => typeof value === 'string' && value) || Deno.env.get(fallback);
  } catch { return Deno.env.get(fallback); }
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Please sign in with an admin account.' }, 401);
  const url = Deno.env.get('SUPABASE_URL');
  const key = serverKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return json({ error: 'The Admin Center server is not configured.' }, 503);
  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return json({ error: 'Your session expired. Please sign in again.' }, 401);
  // Never trust app/user metadata, a client flag, an email allow-list, or a
  // client-supplied actor ID for authorization. Check live membership each time.
  const { data: membership, error: membershipError } = await admin.from('studybolt_admins').select('user_id').eq('user_id', user.id).maybeSingle();
  if (membershipError) return json({ error: 'Apply the StudyBolt Admin Center migration before opening this workspace.' }, 503);
  if (!membership) return json({ error: 'This account does not have admin access.' }, 403);

  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 10000) return json({ error: 'Request is too large.' }, 413);
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return json({ error: 'Invalid request.' }, 400);
    body = parsed;
  } catch { return json({ error: 'Invalid request.' }, 400); }

  try {
    if (body.operation === 'overview') {
      const range = ['today', '7d', '30d', 'all'].includes(String(body.range)) ? String(body.range) : '30d';
      const { data, error } = await admin.rpc('studybolt_admin_overview', { p_range: range });
      if (error) throw error;
      return json(data);
    }
    if (body.operation === 'users') {
      const { data, error } = await admin.rpc('studybolt_admin_users', { p_page: pageNumber(body.page), p_search: typeof body.search === 'string' ? body.search.trim().slice(0, 120) : '' });
      if (error) throw error;
      return json(data);
    }
    if (body.operation === 'feedback') return json(await feedbackWorkspace(admin, body));
    if (body.operation === 'update-feedback') return await updateFeedback(admin, user.id, body);
    if (body.operation === 'user-action') return await userAction(admin, user.id, body);
    return json({ error: 'Unknown Admin Center operation.' }, 400);
  } catch (error) {
    console.error('studybolt-admin operation failed', error);
    return json({ error: 'The operation could not be completed. Verify the Admin Center migrations and try again.' }, 500);
  }
});

async function feedbackWorkspace(admin: SupabaseClient, body: Record<string, unknown>) {
  const status = STATUSES.has(String(body.status)) ? String(body.status) : null;
  const page = pageNumber(body.page);
  let query = admin.from('studybolt_feedback').select('*', { count: 'exact' }).order('created_at', { ascending: false }).order('id').range((page - 1) * 12, page * 12 - 1);
  if (status) query = query.eq('status', status);
  const [reportsResult, countResult] = await Promise.all([
    query,
    admin.from('studybolt_feedback').select('id', { count: 'exact', head: true }).in('status', ['new', 'reviewing']),
  ]);
  if (reportsResult.error) throw reportsResult.error;
  if (countResult.error) throw countResult.error;
  const names = new Map<string, { name: string; email: string }>();
  await Promise.all([...new Set((reportsResult.data ?? []).map(report => report.user_id as string))].map(async id => {
    const { data: { user }, error } = await admin.auth.admin.getUserById(id);
    if (error) throw error;
    names.set(id, { name: user?.user_metadata?.display_name || user?.user_metadata?.full_name || 'Learner', email: user?.email ?? '' });
  }));
  return {
    reports: (reportsResult.data ?? []).map(report => ({ ...report, userName: names.get(report.user_id)?.name, userEmail: names.get(report.user_id)?.email })),
    unresolvedCount: countResult.count ?? 0, page, totalPages: Math.max(1, Math.ceil((reportsResult.count ?? 0) / 12)),
  };
}

async function updateFeedback(admin: SupabaseClient, actorId: string, body: Record<string, unknown>): Promise<Response> {
  if (typeof body.reportId !== 'string' || !UUID_PATTERN.test(body.reportId)
    || !STATUSES.has(String(body.status)) || !PRIORITIES.has(String(body.priority))
    || typeof body.reply !== 'string' || body.reply.length > 3000) return json({ error: 'Choose a valid support status, priority, and reply.' }, 400);
  const { data: report, error } = await admin.from('studybolt_feedback').select('id, user_id').eq('id', body.reportId).maybeSingle();
  if (error) throw error;
  if (!report) return json({ error: 'This support request no longer exists.' }, 404);
  const auditId = await startAudit(admin, actorId, report.user_id, 'update_feedback', { reportId: report.id, status: body.status, priority: body.priority });
  const { error: updateError } = await admin.from('studybolt_feedback').update({ status: body.status, priority: body.priority, admin_reply: body.reply.trim() || null, updated_at: new Date().toISOString() }).eq('id', report.id);
  await finishAudit(admin, auditId, !updateError);
  if (updateError) throw updateError;
  return json({ ok: true });
}

async function userAction(admin: SupabaseClient, actorId: string, body: Record<string, unknown>): Promise<Response> {
  if (typeof body.userId !== 'string' || !UUID_PATTERN.test(body.userId) || !ADMIN_USER_ACTIONS.has(String(body.action))) return json({ error: 'Choose a valid learner and account action.' }, 400);
  const action = body.action as AdminUserAction;
  const [{ data: { user: target }, error: userError }, { data: targetAdmin, error: adminError }] = await Promise.all([
    admin.auth.admin.getUserById(body.userId),
    admin.from('studybolt_admins').select('user_id').eq('user_id', body.userId).maybeSingle(),
  ]);
  if (adminError) throw adminError;
  if (userError || !target) return json({ error: 'This learner account no longer exists.' }, 404);
  const { data: studyBoltAccount, error: accountError } = await admin.from('studybolt_accounts').select('user_id').eq('user_id', target.id).maybeSingle();
  if (accountError) throw accountError;
  if (!studyBoltAccount) return json({ error: 'This account is not registered with StudyBolt.' }, 404);
  const denied = accountActionError(actorId, target.id, Boolean(targetAdmin));
  if (denied) return json({ error: denied }, 400);

  if (action !== 'revoke_complimentary') {
    const { data: usage, error: usageError } = await admin.rpc('studybolt_admin_ai_used', { p_user_id: target.id });
    if (usageError) throw usageError;
    if (usage === null) return json({ error: 'Cloud AI quotas are not configured for this StudyBolt backend.' }, 503);
  }

  if (action === 'reset_ai_quota') {
    const { error } = await admin.rpc('studybolt_admin_reset_usage', { p_user_id: target.id, p_admin_id: actorId });
    if (error) throw error;
    return json({ ok: true });
  }
  const auditId = await startAudit(admin, actorId, target.id, action, { email: target.email });
  try {
    const metadata = { ...target.app_metadata, studybolt_complimentary_until: action === 'grant_complimentary' ? complimentaryExpiry(target.app_metadata?.studybolt_complimentary_until) : null };
    const { error } = await admin.auth.admin.updateUserById(target.id, { app_metadata: metadata });
    if (error) throw error;
  } catch (error) {
    await finishAudit(admin, auditId, false);
    throw error;
  }
  await finishAudit(admin, auditId, true);
  return json({ ok: true });
}

async function startAudit(admin: SupabaseClient, actorId: string, targetId: string, action: string, details: Record<string, unknown>): Promise<string> {
  const { data, error } = await admin.from('studybolt_admin_audit').insert({ admin_user_id: actorId, target_user_id: targetId, action, details }).select('id').single();
  if (error || !data) throw error ?? new Error('Audit creation failed');
  return data.id;
}

async function finishAudit(admin: SupabaseClient, id: string, success: boolean) {
  const { error } = await admin.from('studybolt_admin_audit').update({ outcome: success ? 'succeeded' : 'failed' }).eq('id', id);
  if (error) throw error;
}

function pageNumber(value: unknown): number { return Math.max(1, Math.min(100000, Number.isInteger(value) ? Number(value) : 1)); }
function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
