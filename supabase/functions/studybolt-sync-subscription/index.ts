import { createClient } from 'npm:@supabase/supabase-js@2';
import { studyBoltLegalDocumentsApproved, studyBoltPrivacyPolicyUrl, studyBoltTermsOfServiceUrl } from '../_shared/legal.ts';
import { fetchRevenueCatEntitlement } from '../_shared/revenuecat.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return json({ status: 'ok' });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const token = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) return json({ error: 'Sign in to check your subscription.' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  // API v1 subscriber reads accept the app's SDK key. A privileged key is not
  // needed to verify an entitlement; keep the old secret name as a fallback.
  const revenueCatKey = Deno.env.get('REVENUECAT_API_KEY') || Deno.env.get('REVENUECAT_SECRET_API_KEY');
  const webhookSecret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  const entitlementId = Deno.env.get('REVENUECAT_PREMIUM_ENTITLEMENT')?.trim();
  if (!supabaseUrl || !serviceRoleKey || !revenueCatKey || !webhookSecret || !entitlementId
    || !studyBoltPrivacyPolicyUrl() || !studyBoltTermsOfServiceUrl() || !studyBoltLegalDocumentsApproved()) {
    return json({ error: 'Subscription status is not configured yet.' }, 503);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return json({ error: 'Your session expired. Sign in again.' }, 401);

  const { data: acquired, error: throttleError } = await admin.rpc('acquire_studybolt_subscription_sync', { p_user_id: user.id });
  if (throttleError) return json({ error: 'StudyBolt could not check subscription status.' }, 503);
  if (acquired !== true) return json({ status: 'throttled' }, 429);

  try {
    const state = await fetchRevenueCatEntitlement(user.id, entitlementId, revenueCatKey);
    const { data, error } = await admin.rpc('apply_studybolt_subscription_event', {
      p_event_id: `status-sync:${crypto.randomUUID()}`,
      p_user_id: user.id,
      p_event_type: 'STATUS_SYNC',
      p_event_timestamp_ms: Date.now(),
      p_is_premium: state.active,
      p_expires_at: state.expiresAt,
    });
    if (error) return json({ error: 'StudyBolt could not update subscription status.' }, 503);
    const status = isRecord(data) && typeof data.status === 'string' ? data.status : 'processed';
    return json({ status, plan: state.active ? 'premium' : 'free', expiresAt: state.expiresAt });
  } catch {
    return json({ error: 'StudyBolt could not confirm your store subscription yet. Please try again.' }, 502);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
