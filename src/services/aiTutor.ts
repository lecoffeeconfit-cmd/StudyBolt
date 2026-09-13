import type {
  AiTutorAction,
  AiTutorContext,
  AiTutorConversation,
  AiTutorDepth,
  AiTutorQuota,
  AiTutorResponse,
  NoteBlock,
  StudyPack,
} from '../models';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const hasPlaceholderAnonKey = supabaseAnonKey === 'PASTE_ANON_KEY_HERE';

export const isAiTutorConfigured = Boolean(supabaseUrl && supabaseAnonKey && !hasPlaceholderAnonKey);

export interface TutorCallResult {
  response?: AiTutorResponse;
  quota?: AiTutorQuota;
  error?: string;
  code?: 'monthly_limit' | 'cloud_budget' | 'rate_limit';
}

function noteText(note: NoteBlock): string {
  return [
    note.summary,
    ...note.bullets,
    ...(note.sections?.flatMap((section) => [section.heading, ...section.points]) ?? []),
    ...(note.connections ?? []),
    ...(note.examples ?? []),
    note.keyIdea,
  ].filter(Boolean).join(' ');
}

export function tutorContextAtPosition(deck: StudyPack, position: number, totalWords: number): AiTutorContext {
  const sourceNotes = deck.detailedNotes.length ? deck.detailedNotes : deck.notes;
  const fallback = sourceNotes.length ? sourceNotes : [{
    id: deck.outline[0]?.id ?? 'overview',
    title: deck.outline[0]?.title ?? deck.title,
    bullets: [deck.overview || deck.quickReview],
    source: { sectionId: deck.outline[0]?.id ?? 'overview', label: deck.outline[0]?.range ?? 'Overview' },
  } satisfies NoteBlock];
  const progress = totalWords > 0 ? Math.max(0, Math.min(1, position / totalWords)) : 0;
  const currentIndex = Math.min(fallback.length - 1, Math.floor(progress * fallback.length));
  const current = fallback[currentIndex] ?? fallback[0]!;
  const nearbyIndexes = [currentIndex - 1, currentIndex + 1].filter((index) => index >= 0 && index < fallback.length);

  return {
    studySetTitle: deck.title,
    subject: deck.courseName,
    currentChunk: {
      id: current.source.sectionId || current.id,
      title: current.title,
      text: noteText(current).slice(0, 4_000),
    },
    nearbyChunks: nearbyIndexes.map((index) => {
      const note = fallback[index]!;
      return {
        id: note.source.sectionId || note.id,
        title: note.title,
        text: noteText(note).slice(0, 3_000),
      };
    }),
  };
}

async function tutorRequest(path: string, accessToken: string, init?: RequestInit): Promise<Response> {
  return fetch(`${supabaseUrl}/functions/v1/studybolt-ai-tutor${path}`, {
    ...init,
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
}

async function readPayload(response: Response): Promise<Record<string, unknown>> {
  try {
    return await response.json() as Record<string, unknown>;
  } catch {
    return {};
  }
}

function isQuota(value: unknown): value is AiTutorQuota {
  if (!value || typeof value !== 'object') return false;
  const quota = value as Partial<AiTutorQuota>;
  return typeof quota.used === 'number'
    && typeof quota.limit === 'number'
    && typeof quota.remaining === 'number'
    && typeof quota.periodStart === 'string'
    && typeof quota.periodEnd === 'string'
    && (quota.plan === 'free' || quota.plan === 'premium');
}

function friendlyTutorError(status: number, payload: Record<string, unknown>): string {
  if (typeof payload.error === 'string' && payload.error.trim()) return payload.error;
  if (status === 401) return 'Sign in to ask StudyBolt about this section.';
  if (status === 429) return 'StudyBolt AI needs a short pause before another request.';
  return 'StudyBolt couldn’t answer that right now.';
}

export async function fetchTutorQuota(accessToken: string): Promise<TutorCallResult> {
  if (!isAiTutorConfigured) return { error: 'AI Tutor needs the secure StudyBolt backend connection.' };
  try {
    const response = await tutorRequest('', accessToken, { method: 'GET' });
    const payload = await readPayload(response);
    if (!response.ok || !isQuota(payload.quota)) return { error: friendlyTutorError(response.status, payload) };
    return { quota: payload.quota };
  } catch {
    return { error: 'StudyBolt AI is unavailable offline. StudyCast listening still works.' };
  }
}

export async function askAiTutor({
  action,
  question,
  context,
  accessToken,
  depth = 'normal',
  conversation,
}: {
  action: AiTutorAction;
  question?: string;
  context: AiTutorContext;
  accessToken: string;
  depth?: AiTutorDepth;
  conversation?: AiTutorConversation;
}): Promise<TutorCallResult> {
  if (!isAiTutorConfigured) return { error: 'AI Tutor needs the secure StudyBolt backend connection.' };
  try {
    const response = await tutorRequest('', accessToken, {
      method: 'POST',
      body: JSON.stringify({ action, question: question?.trim(), context, depth, conversation }),
    });
    const payload = await readPayload(response);
    const quota = isQuota(payload.quota) ? payload.quota : undefined;
    if (!response.ok) {
      return {
        error: friendlyTutorError(response.status, payload),
        ...(quota ? { quota } : {}),
        ...(payload.code === 'monthly_limit' || payload.code === 'cloud_budget' || payload.code === 'rate_limit' ? { code: payload.code } : {}),
      };
    }
    if ((payload.kind !== 'answer' && payload.kind !== 'quiz') || typeof payload.answer !== 'string' || !quota) {
      return { error: 'StudyBolt returned an incomplete answer. Please try again.' };
    }
    const responseValue: AiTutorResponse = {
      kind: payload.kind,
      answer: payload.answer,
      quota,
      provider: 'cloud',
      ...(payload.quiz && typeof payload.quiz === 'object' ? { quiz: payload.quiz as AiTutorResponse['quiz'] } : {}),
    };
    return { response: responseValue, quota };
  } catch {
    return { error: 'StudyBolt AI is unavailable offline. StudyCast listening still works.' };
  }
}
