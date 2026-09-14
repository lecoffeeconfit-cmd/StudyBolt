import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

type PlanTier = 'free' | 'premium';
type TutorDepth = 'quick' | 'normal' | 'deep';
type TutorAction = 'explain' | 'teach' | 'quick-answer' | 'deep-dive' | 'simplify' | 'example' | 'quiz' | 'socratic' | 'ask' | 'teach-back' | 'important' | 'confuse' | 'grade-exam';

interface TutorChunk { id: string; title: string; text: string; }
interface ConversationTurn { role: 'user' | 'assistant'; content: string; }
interface GradingItem { questionId: string; prompt: string; studentAnswer: string; expectedAnswer: string; explanation: string; concept: string; source: string; localPartialCredit: number; }
interface TutorRequest {
  action: TutorAction;
  question?: string;
  depth?: TutorDepth;
  channel?: 'text' | 'voice' | 'exam';
  conversation?: { summary?: string; turns?: ConversationTurn[] };
  context?: { studySetTitle: string; subject: string; currentChunk: TutorChunk; nearbyChunks: TutorChunk[]; currentQuestion?: { prompt?: string; userAnswer?: string; correctAnswer?: string; concept?: string; source?: string }; mastery?: number };
  gradingItems?: GradingItem[];
}
interface AiConfig {
  model: string;
  default_reasoning: 'none' | 'low' | 'medium' | 'high';
  input_price_per_million: number;
  cached_input_price_per_million: number;
  output_price_per_million: number;
  free_interaction_limit: number;
  premium_interaction_limit: number;
  free_budget_usd: number;
  premium_budget_usd: number;
  soft_warning_ratio: number;
}

const ACTIONS = new Set<TutorAction>(['explain', 'teach', 'quick-answer', 'deep-dive', 'simplify', 'example', 'quiz', 'socratic', 'ask', 'teach-back', 'important', 'confuse', 'grade-exam']);
const DEPTHS = new Set<TutorDepth>(['quick', 'normal', 'deep']);
const MAX_CONTEXT_CHARS = 9_500;
const MAX_QUESTION_CHARS = 600;
const MAX_CONVERSATION_CHARS = 3_000;
const DEPTH_CAPS: Record<TutorDepth, number> = { quick: 300, normal: 600, deep: 1_000 };

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'GET' && request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Please sign in to ask StudyBolt.' }, 401);

  // OPENAI_API_KEY is deliberately read only in this server-side function.
  // It is never sent to Expo, React Native, or the browser.
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const openAiKey = Deno.env.get('OPENAI_API_KEY');
  if (!supabaseUrl || !serviceRoleKey || !openAiKey) return json({ error: 'StudyBolt AI is not configured yet.' }, 503);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error: userError } = await admin.auth.getUser(token);
  if (userError || !user) return json({ error: 'Your session expired. Please sign in again.' }, 401);
  const { data: configRow, error: configError } = await admin.from('ai_cloud_config').select('*').eq('config_id', true).single();
  if (configError || !configRow) return json({ error: 'StudyBolt AI configuration is unavailable.' }, 503);
  const config = normalizeConfig(configRow as Record<string, unknown>);

  const plan: PlanTier = user.app_metadata?.subscription_tier === 'premium' ? 'premium' : 'free';
  const period = monthlyPeriod(user, new Date());
  const monthlyLimit = plan === 'premium' ? config.premium_interaction_limit : config.free_interaction_limit;
  if (request.method === 'GET') return json({ quota: await currentQuota(admin, user.id, period, plan, monthlyLimit, config.soft_warning_ratio) });

  let body: TutorRequest;
  try { body = await request.json() as TutorRequest; } catch { return json({ error: 'That question could not be read. Please try again.' }, 400); }
  const validationError = validateTutorRequest(body);
  if (validationError) return json({ error: validationError }, 400);
  const depth: TutorDepth = DEPTHS.has(body.depth ?? 'normal') ? body.depth ?? 'normal' : 'normal';
  const maxOutputTokens = body.action === 'grade-exam' ? 1_800 : DEPTH_CAPS[depth];
  const requestId = crypto.randomUUID();
  const aiInput = buildTutorInput(body);
  const estimatedInputTokens = Math.min(4_200, Math.max(160, Math.ceil(aiInput.length / 4)));
  const estimatedCost = estimateCost(config, estimatedInputTokens, maxOutputTokens);
  // Reclaim reservations from interrupted/terminated requests before enforcing
  // concurrency and budget limits. The database function is service-role only.
  await admin.rpc('release_stale_ai_reservations', { p_user_id: user.id });
  const { data: reservation, error: reservationError } = await admin.rpc('reserve_ai_cloud_usage', {
    p_user_id: user.id, p_request_id: requestId, p_period_start: period.start, p_period_end: period.end,
    p_plan_tier: plan, p_estimated_cost_usd: estimatedCost,
  });
  if (reservationError || !reservation) return json({ error: 'StudyBolt could not check AI access right now.' }, 503);
  if (!reservation.allowed) return budgetError(reservation, plan, monthlyLimit);

  const reservationId = String(reservation.reservationId ?? '');
  const release = async () => { if (reservationId) await admin.rpc('release_ai_cloud_usage', { p_reservation_id: reservationId, p_request_id: requestId }); };
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST', headers: { Authorization: `Bearer ${openAiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model || 'gpt-5.6-luna', store: false, safety_identifier: user.id,
        prompt_cache_key: user.id,
        reasoning: { effort: depth === 'quick' ? 'none' : (config.default_reasoning || 'low') },
        max_output_tokens: maxOutputTokens, instructions: tutorInstructions(body.action, depth), input: aiInput,
        text: { verbosity: depth === 'deep' ? 'medium' : 'low', format: responseFormat(body.action) },
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) { await release(); return json({ error: 'StudyBolt couldn’t answer that right now.' }, 502); }

    const payload = await response.json() as Record<string, unknown>;
    const usage = readUsage(payload);
    const actualCost = usage.inputTokens || usage.outputTokens ? calculateActualCost(config, usage) : estimatedCost;
    await admin.rpc('reconcile_ai_cloud_usage', {
      p_reservation_id: reservationId, p_request_id: requestId, p_action: body.action, p_route_used: 'cloud',
      p_model: config.model || 'gpt-5.6-luna', p_depth: depth, p_input_tokens: usage.inputTokens,
      p_cached_input_tokens: usage.cachedInputTokens, p_output_tokens: usage.outputTokens,
      p_reasoning_tokens: usage.reasoningTokens, p_estimated_cost_usd: estimatedCost,
      p_actual_cost_usd: actualCost, p_metadata: { source: 'studybolt-ai-tutor', channel: body.channel ?? 'text', contextChars: aiInput.length },
    });
    const outputText = extractOutputText(payload);
    const parsed = JSON.parse(outputText) as Record<string, unknown>;
    if (body.action === 'grade-exam') {
      const gradingResponse = normalizeGradingResponse(parsed, body.gradingItems ?? []);
      if (!gradingResponse) throw new Error('Invalid grading response');
      return json({ ...gradingResponse, quota: await currentQuota(admin, user.id, period, plan, monthlyLimit, config.soft_warning_ratio) });
    }
    const tutorResponse = normalizeTutorResponse(parsed as { kind?: string; answer?: string; quiz?: { question?: string; options?: string[]; correctIndex?: number; explanation?: string } }, body.action);
    if (!tutorResponse) throw new Error('Invalid tutor response');
    return json({ ...tutorResponse, quota: await currentQuota(admin, user.id, period, plan, monthlyLimit, config.soft_warning_ratio) });
  } catch {
    await release();
    return json({ error: 'StudyBolt couldn’t answer that right now.' }, 502);
  }
});

function validateTutorRequest(body: TutorRequest): string | null {
  if (!body || typeof body !== 'object' || !ACTIONS.has(body.action)) return 'Choose a valid StudyBolt action.';
  if (body.depth && !DEPTHS.has(body.depth)) return 'Choose a valid response depth.';
  if (body.channel && body.channel !== 'text' && body.channel !== 'voice' && body.channel !== 'exam') return 'Choose a valid request channel.';
  if (body.action === 'grade-exam') {
    if (!Array.isArray(body.gradingItems) || body.gradingItems.length < 1 || body.gradingItems.length > 24) return 'Choose between 1 and 24 open answers to grade.';
    if (JSON.stringify(body.gradingItems).length > 16_000) return 'The grading batch is too large.';
    if (!body.gradingItems.every(validGradingItem)) return 'One or more open answers could not be graded.';
    return null;
  }
  if (!body.context || typeof body.context !== 'object') return 'The current study context is missing.';
  if (!cleanString(body.context.studySetTitle, 180) || !cleanString(body.context.subject, 120)) return 'The Study Pack context is incomplete.';
  if (!validChunk(body.context.currentChunk)) return 'StudyBolt could not identify the current section.';
  if (!Array.isArray(body.context.nearbyChunks) || body.context.nearbyChunks.length > 3 || !body.context.nearbyChunks.every(validChunk)) return 'The nearby study context is invalid.';
  if (body.action === 'ask' && !cleanString(body.question, MAX_QUESTION_CHARS)) return 'Type a question for StudyBolt.';
  if (body.conversation && JSON.stringify(body.conversation).length > MAX_CONVERSATION_CHARS) return 'That conversation is too long. Start a fresh follow-up.';
  if (JSON.stringify(body.context).length > MAX_CONTEXT_CHARS) return 'That study section is too large. Move to a smaller section and try again.';
  return null;
}
function validChunk(value: TutorChunk): boolean { return Boolean(value && cleanString(value.id, 120) && cleanString(value.title, 180) && cleanString(value.text, 2_800)); }
function validGradingItem(value: GradingItem): boolean {
  return Boolean(value && cleanString(value.questionId, 220) && cleanString(value.prompt, 700) && cleanString(value.studentAnswer, 1_200) && cleanString(value.expectedAnswer, 1_200) && cleanString(value.concept, 200));
}
function cleanString(value: unknown, max: number): string { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }

function tutorInstructions(action: TutorAction, depth: TutorDepth): string {
  if (action === 'grade-exam') return [
    'You are StudyBolt’s source-grounded semantic grader.',
    'Grade meaning, not exact wording. Award partial credit when the core idea is partly correct.',
    'Use only each supplied expected answer and explanation; do not add outside facts.',
    'Return one result for every supplied questionId in the same order. Keep feedback concise and say what is missing.',
  ].join(' ');
  return [
    'You are StudyBolt, a concise, encouraging tutor.',
    'Use only the supplied study material. If it does not support an answer, say so plainly instead of inventing information.',
    'Resolve words such as “this”, “that”, and “the last part” to CURRENT CHUNK first, then nearby context.',
    depth === 'quick' ? 'Answer in 1–3 compact sentences.' : depth === 'deep' ? 'Give a thorough but focused explanation with a short misconception check.' : 'Use clear chunks and short student-friendly paragraphs.',
    action === 'quiz' ? 'Create one grounded multiple-choice retrieval question with exactly four plausible options.' : action === 'socratic' ? 'Ask one focused guiding question. Do not reveal the complete answer unless the student asks.' : 'Set kind to answer and keep quiz empty.',
  ].join(' ');
}

function buildTutorInput(body: TutorRequest): string {
  if (body.action === 'grade-exam') return (body.gradingItems ?? []).map((item, index) => [
    `ITEM ${index + 1} · ID ${cleanString(item.questionId, 220)}`,
    `QUESTION: ${cleanString(item.prompt, 700)}`,
    `STUDENT ANSWER: ${cleanString(item.studentAnswer, 1_200)}`,
    `EXPECTED ANSWER: ${cleanString(item.expectedAnswer, 1_200)}`,
    `SOURCE EXPLANATION: ${cleanString(item.explanation, 1_200)}`,
    `CONCEPT: ${cleanString(item.concept, 200)}`,
    `SOURCE: ${cleanString(item.source, 200)}`,
    `LOCAL OVERLAP SCORE: ${Math.max(0, Math.min(1, Number(item.localPartialCredit) || 0))}`,
  ].join('\n')).join('\n\n').slice(0, 16_000);
  const context = body.context!;
  const prompts: Record<TutorAction, string> = {
    explain: 'Explain the current idea and why it matters.', teach: 'Teach the current idea step by step and end with one retrieval check.',
    'quick-answer': cleanString(body.question, MAX_QUESTION_CHARS) || 'Give a direct answer in no more than three short sentences.',
    'deep-dive': cleanString(body.question, MAX_QUESTION_CHARS) || 'Explain the current idea thoroughly, including connections and one misconception check.',
    simplify: 'Restate the current idea in simpler language.',
    example: 'Give one concrete example grounded in the supplied material.', quiz: 'Quiz the student on the current idea.',
    socratic: cleanString(body.question, MAX_QUESTION_CHARS) || 'Ask one guiding question that helps the student reason to the next step.',
    ask: cleanString(body.question, MAX_QUESTION_CHARS), 'teach-back': 'Evaluate the student explanation and name missing ideas or misconceptions.',
    important: 'Identify the five most important ideas in this material.', confuse: 'Name the most likely confusion or contrast with nearby ideas.', 'grade-exam': '',
  };
  const nearby = context.nearbyChunks.map((chunk) => `NEARBY — ${cleanString(chunk.title, 180)}\n${cleanString(chunk.text, 2_800)}`).join('\n\n');
  const examQuestion = context.currentQuestion
    ? `CURRENT QUESTION\n${cleanString(context.currentQuestion.prompt, 900)}\nUSER ANSWER\n${cleanString(context.currentQuestion.userAnswer, 900) || 'not answered'}\nCORRECT ANSWER\n${cleanString(context.currentQuestion.correctAnswer, 900) || 'not provided'}\nCONCEPT\n${cleanString(context.currentQuestion.concept, 240)}`
    : '';
  const mastery = typeof context.mastery === 'number' ? `ESTIMATED MASTERY: ${Math.max(0, Math.min(100, context.mastery))}%` : '';
  const conversation = body.conversation ? [
    body.conversation.summary ? `CONVERSATION SUMMARY\n${cleanString(body.conversation.summary, 1_000)}` : '',
    ...(body.conversation.turns ?? []).slice(-4).map((turn) => `${turn.role.toUpperCase()}: ${cleanString(turn.content, 500)}`),
  ].filter(Boolean).join('\n') : '';
  return [
    `STUDY SET: ${cleanString(context.studySetTitle, 180)}`, `SUBJECT: ${cleanString(context.subject, 120)}`,
    `CURRENT CHUNK — ${cleanString(context.currentChunk.title, 180)}\n${cleanString(context.currentChunk.text, 2_800)}`,
    nearby, examQuestion, mastery, conversation, `STUDENT REQUEST: ${prompts[body.action]}`,
  ].filter(Boolean).join('\n\n').slice(0, MAX_CONTEXT_CHARS);
}

function responseFormat(action: TutorAction) {
  if (action === 'grade-exam') return {
    type: 'json_schema', name: 'studybolt_exam_grading', strict: true,
    schema: {
      type: 'object', additionalProperties: false,
      properties: {
        kind: { type: 'string', enum: ['grading'] },
        grades: {
          type: 'array', minItems: 1, maxItems: 24,
          items: {
            type: 'object', additionalProperties: false,
            properties: {
              questionId: { type: 'string' },
              partialCredit: { type: 'number', minimum: 0, maximum: 1 },
              correct: { type: 'boolean' },
              feedback: { type: 'string' },
              missingIdeas: { type: 'array', items: { type: 'string' }, maxItems: 4 },
            },
            required: ['questionId', 'partialCredit', 'correct', 'feedback', 'missingIdeas'],
          },
        },
      },
      required: ['kind', 'grades'],
    },
  };
  return {
    type: 'json_schema', name: 'studybolt_tutor_response', strict: true,
    schema: { type: 'object', additionalProperties: false,
      properties: {
        kind: { type: 'string', enum: ['answer', 'quiz'] }, answer: { type: 'string' },
        quiz: { type: 'object', additionalProperties: false, properties: {
          question: { type: 'string' }, options: { type: 'array', items: { type: 'string' }, minItems: 0, maxItems: 4 },
          correctIndex: { type: 'integer', minimum: -1, maximum: 3 }, explanation: { type: 'string' },
        }, required: ['question', 'options', 'correctIndex', 'explanation'] },
      }, required: ['kind', 'answer', 'quiz'] },
  };
}

function readUsage(payload: Record<string, unknown>) {
  const usage = payload.usage && typeof payload.usage === 'object' ? payload.usage as Record<string, unknown> : {};
  const details = usage.input_tokens_details && typeof usage.input_tokens_details === 'object' ? usage.input_tokens_details as Record<string, unknown> : {};
  const outputDetails = usage.output_tokens_details && typeof usage.output_tokens_details === 'object' ? usage.output_tokens_details as Record<string, unknown> : {};
  return { inputTokens: numberValue(usage.input_tokens), cachedInputTokens: numberValue(details.cached_tokens), outputTokens: numberValue(usage.output_tokens), reasoningTokens: numberValue(outputDetails.reasoning_tokens) };
}
function numberValue(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0; }
function decimalValue(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function normalizeConfig(value: Record<string, unknown>): AiConfig {
  return {
    model: typeof value.model === 'string' && value.model.trim() ? value.model.trim() : 'gpt-5.6-luna',
    default_reasoning: value.default_reasoning === 'none' || value.default_reasoning === 'medium' || value.default_reasoning === 'high' ? value.default_reasoning : 'low',
    input_price_per_million: decimalValue(value.input_price_per_million, 0.2),
    cached_input_price_per_million: decimalValue(value.cached_input_price_per_million, 0.02),
    output_price_per_million: decimalValue(value.output_price_per_million, 1.2),
    free_interaction_limit: Math.max(1, Math.round(decimalValue(value.free_interaction_limit, 10))),
    premium_interaction_limit: Math.max(1, Math.round(decimalValue(value.premium_interaction_limit, 250))),
    free_budget_usd: Math.max(0, decimalValue(value.free_budget_usd, 0.01)),
    premium_budget_usd: Math.max(0, decimalValue(value.premium_budget_usd, 0.15)),
    soft_warning_ratio: Math.max(0.5, Math.min(0.98, decimalValue(value.soft_warning_ratio, 0.8))),
  };
}
function estimateCost(config: AiConfig, inputTokens: number, outputTokens: number): number { return roundUsd((inputTokens * config.input_price_per_million + outputTokens * config.output_price_per_million) / 1_000_000); }
function calculateActualCost(config: AiConfig, usage: { inputTokens: number; cachedInputTokens: number; outputTokens: number }): number {
  const uncached = Math.max(usage.inputTokens - usage.cachedInputTokens, 0);
  return roundUsd((uncached * config.input_price_per_million + usage.cachedInputTokens * config.cached_input_price_per_million + usage.outputTokens * config.output_price_per_million) / 1_000_000);
}
function roundUsd(value: number): number { return Math.max(0, Math.round(value * 1_000_000) / 1_000_000); }

function extractOutputText(payload: Record<string, unknown>): string {
  if (typeof payload.output_text === 'string') return payload.output_text;
  if (!Array.isArray(payload.output)) throw new Error('Missing output');
  for (const item of payload.output) {
    if (!item || typeof item !== 'object' || !Array.isArray((item as { content?: unknown }).content)) continue;
    for (const part of (item as { content: unknown[] }).content) if (part && typeof part === 'object' && (part as { type?: string }).type === 'output_text' && typeof (part as { text?: unknown }).text === 'string') return (part as { text: string }).text;
  }
  throw new Error('Missing output text');
}
function normalizeTutorResponse(value: { kind?: string; answer?: string; quiz?: { question?: string; options?: string[]; correctIndex?: number; explanation?: string } }, action: TutorAction) {
  if (action !== 'quiz') { const answer = cleanString(value.answer, 3_000); return answer ? { kind: 'answer', answer } : null; }
  const quiz = value.quiz;
  if (!quiz || !cleanString(quiz.question, 500) || !Array.isArray(quiz.options) || quiz.options.length !== 4 || !quiz.options.every((option) => Boolean(cleanString(option, 300)))) return null;
  if (!Number.isInteger(quiz.correctIndex) || (quiz.correctIndex ?? -1) < 0 || (quiz.correctIndex ?? 4) > 3) return null;
  return { kind: 'quiz', answer: '', quiz: { question: cleanString(quiz.question, 500), options: quiz.options.map((option) => cleanString(option, 300)), correctIndex: quiz.correctIndex, explanation: cleanString(quiz.explanation, 1_000) } };
}

function normalizeGradingResponse(value: Record<string, unknown>, items: GradingItem[]) {
  if (value.kind !== 'grading' || !Array.isArray(value.grades) || value.grades.length !== items.length) return null;
  const expectedIds = new Set(items.map((item) => item.questionId));
  const seenIds = new Set<string>();
  const grades = value.grades.flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return [];
    const grade = raw as Record<string, unknown>;
    const questionId = cleanString(grade.questionId, 220);
    const parsedCredit = decimalValue(grade.partialCredit, -1);
    if (!expectedIds.has(questionId) || seenIds.has(questionId) || parsedCredit < 0 || parsedCredit > 1) return [];
    seenIds.add(questionId);
    const partialCredit = Math.max(0, Math.min(1, parsedCredit));
    return [{
      questionId,
      partialCredit,
      correct: partialCredit >= 0.6,
      feedback: cleanString(grade.feedback, 1_000),
      missingIdeas: Array.isArray(grade.missingIdeas) ? grade.missingIdeas.map((item) => cleanString(item, 240)).filter(Boolean).slice(0, 4) : [],
    }];
  });
  return grades.length === items.length ? { kind: 'grading', grades } : null;
}

function monthlyPeriod(user: { created_at: string; app_metadata?: Record<string, unknown> }, now: Date) {
  const configuredAnchor = user.app_metadata?.subscription_cycle_anchor;
  const parsedAnchor = typeof configuredAnchor === 'string' ? Number(configuredAnchor) : NaN;
  const anchorDay = Number.isInteger(parsedAnchor) && parsedAnchor >= 1 && parsedAnchor <= 28 ? parsedAnchor : Math.min(new Date(user.created_at).getUTCDate() || 1, 28);
  let year = now.getUTCFullYear(); let month = now.getUTCMonth(); if (now.getUTCDate() < anchorDay) month -= 1;
  const start = new Date(Date.UTC(year, month, anchorDay)); const end = new Date(Date.UTC(year, month + 1, anchorDay));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}
async function currentQuota(admin: ReturnType<typeof createClient>, userId: string, period: { start: string; end: string }, plan: PlanTier, limit: number, softWarningRatio: number) {
  const { data } = await admin.from('ai_usage_periods').select('interaction_count').eq('user_id', userId).eq('period_start', period.start).maybeSingle();
  const used = typeof data?.interaction_count === 'number' ? data.interaction_count : 0;
  return { used, limit, remaining: Math.max(limit - used, 0), periodStart: period.start, periodEnd: period.end, plan, softWarning: used / Math.max(1, limit) >= softWarningRatio };
}
function budgetError(reservation: Record<string, unknown>, plan: PlanTier, limit: number): Response {
  const reason = String(reservation.reason ?? 'limit');
  const message = reason === 'cloud_budget' ? 'StudyBolt AI is taking a short budget break. Your saved StudyCast, device AI, and deterministic study plan still work.' : reason === 'monthly_limit' ? `You’ve used this month’s ${limit} StudyBolt AI interactions. Your saved StudyCast and study tools still work.` : reason === 'daily_limit' || reason === 'rolling_limit' ? 'StudyBolt AI needs a short pause before another request. Try again soon.' : reason === 'concurrency_limit' ? 'StudyBolt is finishing another AI request. Try again in a moment.' : 'StudyBolt AI is temporarily unavailable.';
  const code = reason === 'monthly_limit' || reason === 'cloud_budget' ? reason : 'rate_limit';
  return json({ error: message, code, quota: { used: Number(reservation.used ?? 0), limit: Number(reservation.limit ?? limit), remaining: Number(reservation.remaining ?? 0), periodStart: String(reservation.periodStart ?? ''), periodEnd: String(reservation.periodEnd ?? ''), plan } }, 429);
}
function json(payload: Record<string, unknown>, status = 200): Response { return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
