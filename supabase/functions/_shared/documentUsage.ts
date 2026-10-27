import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';
import { effectiveStudyBoltPlan } from './adminPolicy.ts';
import { studyBoltLegalDocumentsApproved, studyBoltPrivacyPolicyUrl } from './legal.ts';

type PlanTier = 'free' | 'premium';
type CloudConfig = {
  model: string;
  inputPrice: number;
  cachedInputPrice: number;
  outputPrice: number;
  freeLimit: number;
  premiumLimit: number;
  softWarningRatio: number;
};

export type DocumentUsageContext = {
  admin: SupabaseClient<any>;
  user: User;
  plan: PlanTier;
  period: { start: string; end: string };
  config: CloudConfig;
};

export type DocumentUsageReservation = {
  reservationId: string;
  requestId: string;
  estimatedCost: number;
};

export async function authenticateDocumentRequest(request: Request): Promise<{ context: DocumentUsageContext } | { response: Response }> {
  const token = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) return { response: json({ error: 'Sign in to process study materials.', code: 'authentication_required' }, 401) };

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return { response: json({ error: 'Secure document processing is not configured yet.' }, 503) };

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return { response: json({ error: 'Your session expired. Sign in again to process this material.', code: 'authentication_required' }, 401) };

  if (!studyBoltPrivacyPolicyUrl() || !studyBoltLegalDocumentsApproved()) {
    return { response: json({ error: 'Secure AI processing is paused until the StudyBolt privacy policy is complete and approved.', code: 'privacy_policy_required' }, 503) };
  }

  const { data: row, error: configError } = await admin.from('ai_cloud_config').select('*').eq('config_id', true).single();
  if (configError || !row) return { response: json({ error: 'AI usage controls are not configured. Please try again later.' }, 503) };

  const now = new Date();
  const config: CloudConfig = {
    model: typeof row.model === 'string' && row.model.trim() ? row.model.trim() : 'gpt-5.6-luna',
    inputPrice: numberValue(row.input_price_per_million, 0.2),
    cachedInputPrice: numberValue(row.cached_input_price_per_million, 0.02),
    outputPrice: numberValue(row.output_price_per_million, 1.2),
    freeLimit: Math.max(1, Math.round(numberValue(row.free_interaction_limit, 10))),
    premiumLimit: Math.max(1, Math.round(numberValue(row.premium_interaction_limit, 250))),
    softWarningRatio: Math.min(0.98, Math.max(0.5, numberValue(row.soft_warning_ratio, 0.8))),
  };
  return { context: { admin, user, plan: effectiveStudyBoltPlan(user.app_metadata), period: monthlyPeriod(user, now), config } };
}

export function estimateDocumentCost(context: DocumentUsageContext, inputTokens: number, outputTokens: number): number {
  return roundUsd((Math.max(0, inputTokens) * context.config.inputPrice + Math.max(0, outputTokens) * context.config.outputPrice) / 1_000_000);
}

export async function reserveDocumentUsage(
  context: DocumentUsageContext,
  estimatedCost: number,
): Promise<{ reservation: DocumentUsageReservation } | { response: Response }> {
  // Settle abandoned reservations across accounts before checking shared spend
  // and concurrency caps. A per-user sweep lets old reservations from many
  // accounts fall out of the global budget window without being accounted for.
  const { error: staleReservationError } = await context.admin.rpc('release_stale_ai_reservations', { p_user_id: null });
  if (staleReservationError) return { response: json({ error: 'StudyBolt could not check AI access right now.' }, 503) };
  const requestId = crypto.randomUUID();
  const { data, error } = await context.admin.rpc('reserve_ai_cloud_usage', {
    p_user_id: context.user.id,
    p_request_id: requestId,
    p_period_start: context.period.start,
    p_period_end: context.period.end,
    p_plan_tier: context.plan,
    p_estimated_cost_usd: estimatedCost,
  });
  if (error || !data) return { response: json({ error: 'StudyBolt could not check AI access right now.' }, 503) };
  if (!data.allowed) return { response: await limitResponse(data, context) };
  const reservationId = String(data.reservationId ?? '');
  if (!reservationId) return { response: json({ error: 'StudyBolt could not secure this AI request.' }, 503) };
  return { reservation: { reservationId, requestId, estimatedCost } };
}

export async function releaseDocumentUsage(context: DocumentUsageContext, reservation: DocumentUsageReservation): Promise<void> {
  if (!reservation.reservationId || !reservation.requestId) return;
  await context.admin.rpc('release_ai_cloud_usage', { p_reservation_id: reservation.reservationId, p_request_id: reservation.requestId });
}

export async function reconcileDocumentUsage(
  context: DocumentUsageContext,
  reservation: DocumentUsageReservation,
  action: string,
  payload: Record<string, unknown>,
  metadata: Record<string, unknown>,
): Promise<boolean> {
  const usage = readUsage(payload);
  const actualCost = usage.inputTokens || usage.outputTokens
    ? calculateActualCost(context.config, usage)
    : reservation.estimatedCost;
  const { data, error } = await context.admin.rpc('reconcile_ai_cloud_usage', {
    p_reservation_id: reservation.reservationId,
    p_request_id: reservation.requestId,
    p_action: action,
    p_route_used: 'cloud',
    p_model: context.config.model,
    p_depth: 'normal',
    p_input_tokens: usage.inputTokens,
    p_cached_input_tokens: usage.cachedInputTokens,
    p_output_tokens: usage.outputTokens,
    p_reasoning_tokens: usage.reasoningTokens,
    p_estimated_cost_usd: reservation.estimatedCost,
    p_actual_cost_usd: actualCost,
    p_metadata: metadata,
  });
  return !error && data === true;
}

function monthlyPeriod(user: User, now: Date): { start: string; end: string } {
  const configuredAnchor = user.app_metadata?.subscription_cycle_anchor;
  const parsedAnchor = typeof configuredAnchor === 'string' ? Number(configuredAnchor) : NaN;
  const anchorDay = Number.isInteger(parsedAnchor) && parsedAnchor >= 1 && parsedAnchor <= 28
    ? parsedAnchor
    : Math.min(new Date(user.created_at).getUTCDate() || 1, 28);
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth();
  if (now.getUTCDate() < anchorDay) month -= 1;
  return {
    start: new Date(Date.UTC(year, month, anchorDay)).toISOString().slice(0, 10),
    end: new Date(Date.UTC(year, month + 1, anchorDay)).toISOString().slice(0, 10),
  };
}

async function limitResponse(value: Record<string, unknown>, context: DocumentUsageContext): Promise<Response> {
  const reason = String(value.reason ?? 'limit');
  const monthlyLimit = context.plan === 'premium' ? context.config.premiumLimit : context.config.freeLimit;
  const { data } = await context.admin.from('ai_usage_periods').select('interaction_count')
    .eq('user_id', context.user.id).eq('period_start', context.period.start).maybeSingle();
  const used = typeof data?.interaction_count === 'number' ? data.interaction_count : 0;
  const monthly = reason === 'monthly_limit';
  const userBudget = reason === 'cloud_budget';
  const globalBudget = reason === 'global_daily_budget';
  const error = monthly
    ? `You’ve used this period’s ${monthlyLimit} StudyBolt AI interactions. Try again when your allowance renews.`
    : userBudget
      ? 'You’ve reached this period’s StudyBolt AI budget. Try again when your allowance renews.'
    : globalBudget
      ? 'StudyBolt AI is taking a short budget break. Please try again later.'
      : 'StudyBolt AI needs a short pause before another request. Try again soon.';
  return json({
    error,
    code: monthly ? 'monthly_limit' : userBudget || globalBudget ? 'cloud_budget' : 'rate_limit',
    quota: { used, limit: monthlyLimit, remaining: Math.max(monthlyLimit - used, 0), periodStart: context.period.start, periodEnd: context.period.end, plan: context.plan },
  }, 429);
}

function readUsage(payload: Record<string, unknown>) {
  const usage = isRecord(payload.usage) ? payload.usage : {};
  const inputDetails = isRecord(usage.input_tokens_details) ? usage.input_tokens_details : {};
  const outputDetails = isRecord(usage.output_tokens_details) ? usage.output_tokens_details : {};
  return {
    inputTokens: numberValue(usage.input_tokens, 0),
    cachedInputTokens: numberValue(inputDetails.cached_tokens, 0),
    outputTokens: numberValue(usage.output_tokens, 0),
    reasoningTokens: numberValue(outputDetails.reasoning_tokens, 0),
  };
}

function calculateActualCost(config: CloudConfig, usage: ReturnType<typeof readUsage>): number {
  const uncached = Math.max(usage.inputTokens - usage.cachedInputTokens, 0);
  return roundUsd((uncached * config.inputPrice + usage.cachedInputTokens * config.cachedInputPrice + usage.outputTokens * config.outputPrice) / 1_000_000);
}

function numberValue(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function roundUsd(value: number): number {
  return Math.max(0, Math.round(value * 1_000_000) / 1_000_000);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } });
}
