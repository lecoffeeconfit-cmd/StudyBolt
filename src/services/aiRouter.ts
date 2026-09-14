import type { AiRequestChannel, AiTutorAction, AiTutorContext, AiTutorConversation, AiTutorDepth, AiTutorQuota, AiTutorResponse } from '../models';
import { askAiTutor, type TutorCallResult } from './aiTutor';
import { askOnDeviceTutor, canAttemptOnDeviceAI, type OnDeviceAIAvailability } from './onDeviceAI';

export type AiRouteUsed = 'on-device' | 'cloud' | 'cache' | 'none';

const RESPONSE_CACHE_TTL_MS = 15 * 60 * 1000;
const responseCache = new Map<string, { response: AiTutorResponse; expiresAt: number }>();

function cacheKey(action: AiTutorAction, context: AiTutorContext): string {
  return JSON.stringify([action, context.studySetTitle, context.currentChunk.id, context.currentChunk.text.slice(0, 1_200), context.mastery]);
}

export interface StudyBoltAIResult {
  response?: AiTutorResponse;
  quota?: AiTutorQuota;
  availability: OnDeviceAIAvailability;
  routeUsed: AiRouteUsed;
  fallbackReason?: string;
  error?: string;
  code?: TutorCallResult['code'];
}

/** The one client entry point for contextual AI. Device-first, cloud last. */
export async function runStudyBoltAI({
  action,
  question,
  context,
  accessToken,
  depth = 'normal',
  conversation,
  channel = 'text',
}: {
  action: AiTutorAction;
  question?: string;
  context: AiTutorContext;
  accessToken?: string | null;
  depth?: AiTutorDepth;
  conversation?: AiTutorConversation;
  channel?: AiRequestChannel;
}): Promise<StudyBoltAIResult> {
  const cacheable = !question?.trim() && !(conversation?.turns?.length) && ['explain', 'teach', 'quick-answer', 'deep-dive', 'simplify', 'example', 'important', 'confuse'].includes(action);
  const key = cacheable ? cacheKey(action, context) : '';
  const cached = key ? responseCache.get(key) : undefined;
  if (cached && cached.expiresAt > Date.now()) {
    return { response: cached.response, availability: await getCachedAvailability(), routeUsed: 'cache' };
  }
  if (cached) responseCache.delete(key);
  const localResult = await askOnDeviceTutor({ action, question, context, conversation });
  if (localResult.response) {
    if (key) responseCache.set(key, { response: localResult.response, expiresAt: Date.now() + RESPONSE_CACHE_TTL_MS });
    return { response: localResult.response, availability: localResult.availability, routeUsed: 'on-device' };
  }
  if (canAttemptOnDeviceAI(localResult.availability)) {
    return {
      availability: localResult.availability,
      routeUsed: 'none',
      fallbackReason: 'on-device-preparing',
      error: localResult.error ?? localResult.availability.reason,
    };
  }
  if (!accessToken) {
    return {
      availability: localResult.availability,
      routeUsed: 'none',
      fallbackReason: 'sign-in-required',
      error: 'Sign in to ask StudyBolt about this section.',
    };
  }
  const cloudResult = await askAiTutor({ action, question, context, accessToken, depth, conversation, channel });
  if (key && cloudResult.response) responseCache.set(key, { response: cloudResult.response, expiresAt: Date.now() + RESPONSE_CACHE_TTL_MS });
  return {
    ...(cloudResult.response ? { response: cloudResult.response } : {}),
    ...(cloudResult.quota ? { quota: cloudResult.quota } : {}),
    availability: localResult.availability,
    routeUsed: cloudResult.response ? 'cloud' : 'none',
    fallbackReason: 'on-device-unavailable',
    ...(cloudResult.error ? { error: cloudResult.error } : {}),
    ...(cloudResult.code ? { code: cloudResult.code } : {}),
  };
}

async function getCachedAvailability(): Promise<OnDeviceAIAvailability> {
  return { status: 'unavailable', reason: 'Reused a recent grounded StudyBolt response without another AI request.' };
}
