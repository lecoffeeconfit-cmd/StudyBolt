import type { AiTutorAction, AiTutorContext, AiTutorConversation, AiTutorDepth, AiTutorQuota, AiTutorResponse } from '../models';
import { askAiTutor, type TutorCallResult } from './aiTutor';
import { askOnDeviceTutor, canAttemptOnDeviceAI, type OnDeviceAIAvailability } from './onDeviceAI';

export type AiRouteUsed = 'on-device' | 'cloud' | 'none';

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
}: {
  action: AiTutorAction;
  question?: string;
  context: AiTutorContext;
  accessToken?: string | null;
  depth?: AiTutorDepth;
  conversation?: AiTutorConversation;
}): Promise<StudyBoltAIResult> {
  const localResult = await askOnDeviceTutor({ action, question, context, conversation });
  if (localResult.response) {
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
  const cloudResult = await askAiTutor({ action, question, context, accessToken, depth, conversation });
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
