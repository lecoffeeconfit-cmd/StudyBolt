import { Platform } from 'react-native';

import StudyBoltOnDeviceAI from '../../modules/studybolt-on-device-ai';
import type { AiTutorAction, AiTutorContext, AiTutorConversation, AiTutorResponse } from '../models';

export type OnDeviceAIStatus = 'checking' | 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'unsupported';
export type OnDeviceAIProvider = 'apple-intelligence' | 'gemini-nano';

export interface OnDeviceAIAvailability {
  status: OnDeviceAIStatus;
  provider?: OnDeviceAIProvider;
  reason: string;
}

export interface OnDeviceTutorResult {
  availability: OnDeviceAIAvailability;
  response?: AiTutorResponse;
  error?: string;
}

export const initialOnDeviceAIAvailability: OnDeviceAIAvailability = Platform.OS === 'web'
  ? { status: 'unsupported', reason: 'On-device phone AI is available only in native iOS and Android builds.' }
  : { status: 'checking', reason: 'Checking this phone for on-device AI.' };

export function canAttemptOnDeviceAI(availability: OnDeviceAIAvailability): boolean {
  return availability.status === 'checking'
    || availability.status === 'available'
    || availability.status === 'downloadable'
    || availability.status === 'downloading';
}

export async function getOnDeviceAIAvailability(): Promise<OnDeviceAIAvailability> {
  if (!StudyBoltOnDeviceAI) {
    return {
      status: 'unsupported',
      reason: Platform.OS === 'web'
        ? 'On-device phone AI is unavailable on the web.'
        : 'Install a StudyBolt development or production build to use the phone’s internal AI.',
    };
  }
  try {
    const result = await StudyBoltOnDeviceAI.getAvailability();
    return normalizeAvailability(result);
  } catch {
    return { status: 'unavailable', reason: 'StudyBolt could not check this phone’s internal AI.' };
  }
}

export async function askOnDeviceTutor({
  action,
  question,
  context,
  conversation,
}: {
  action: AiTutorAction;
  question?: string;
  context: AiTutorContext;
  conversation?: AiTutorConversation;
}): Promise<OnDeviceTutorResult> {
  let availability = await getOnDeviceAIAvailability();
  if (!StudyBoltOnDeviceAI || availability.status === 'unsupported' || availability.status === 'unavailable') {
    return { availability };
  }

  if (availability.status === 'downloadable') {
    try {
      availability = normalizeAvailability(await StudyBoltOnDeviceAI.downloadModel());
    } catch {
      return {
        availability,
        error: 'Your phone’s private AI model could not be prepared. Check your connection and try again.',
      };
    }
  }

  if (availability.status !== 'available') {
    return {
      availability,
      error: availability.status === 'downloading'
        ? 'Your phone is still preparing its private AI model. Try again when the download finishes.'
        : availability.reason,
    };
  }

  try {
    const raw = await StudyBoltOnDeviceAI.generate(buildPrompt(action, question, context, conversation), buildInstructions(action));
    const response = parseTutorResponse(raw.text, action);
    if (!response) {
      return { availability, error: 'Your phone’s AI returned an incomplete answer. Please try again.' };
    }
    return { availability, response };
  } catch {
    return { availability, error: 'Your phone’s AI couldn’t answer that right now. Your study material stayed on this device.' };
  }
}

function normalizeAvailability(value: { status?: string; provider?: string; reason?: string }): OnDeviceAIAvailability {
  const validStatus = value.status === 'available'
    || value.status === 'downloadable'
    || value.status === 'downloading'
    || value.status === 'unavailable';
  const provider = value.provider === 'apple-intelligence' || value.provider === 'gemini-nano'
    ? value.provider
    : undefined;
  return {
    status: validStatus ? value.status as OnDeviceAIStatus : 'unavailable',
    ...(provider ? { provider } : {}),
    reason: typeof value.reason === 'string' && value.reason.trim()
      ? value.reason
      : 'The phone’s internal AI is unavailable right now.',
  };
}

function buildInstructions(action: AiTutorAction): string {
  return [
    'You are StudyBolt, a concise and encouraging tutor.',
    'Use only the supplied study material. Never invent missing facts.',
    'Treat CURRENT CHUNK as what words like “this” and “the last part” refer to.',
    'Use short, clear explanations appropriate for a student.',
    action === 'quiz'
      ? 'Return only valid JSON: {"kind":"quiz","answer":"","quiz":{"question":"...","options":["...","...","...","..."],"correctIndex":0,"explanation":"..."}}.'
      : 'Return only valid JSON: {"kind":"answer","answer":"100–250 word answer"}.',
  ].join(' ');
}

function buildPrompt(action: AiTutorAction, question: string | undefined, context: AiTutorContext, conversation?: AiTutorConversation): string {
  const requests: Record<AiTutorAction, string> = {
    explain: 'Explain the current idea and why it matters.',
    simplify: 'Restate the current idea in simpler language without losing its meaning.',
    example: 'Give one concrete, grounded example. Label an analogy if you use one.',
    quiz: 'Create one multiple-choice retrieval question about the current idea.',
    ask: question?.trim().slice(0, 600) || 'Explain the current idea.',
    'teach-back': question?.trim().slice(0, 600) || 'Check the student explanation for missing ideas and misconceptions.',
    important: 'Identify the most important ideas in the supplied study material.',
    confuse: 'Name the most likely confusion between the current idea and nearby ideas.',
  };
  const nearby = context.nearbyChunks
    .slice(0, 2)
    .map((chunk) => `NEARBY — ${chunk.title}\n${chunk.text.slice(0, 2_500)}`)
    .join('\n\n');
  const recentConversation = (conversation?.turns ?? []).slice(-4).map((turn) => `${turn.role.toUpperCase()}: ${turn.content.slice(0, 500)}`).join('\n');
  const questionContext = context.currentQuestion
    ? `CURRENT QUESTION — ${context.currentQuestion.prompt}\nUSER ANSWER — ${context.currentQuestion.userAnswer ?? 'not answered'}\nCORRECT ANSWER — ${context.currentQuestion.correctAnswer ?? 'not provided'}\nCONCEPT — ${context.currentQuestion.concept ?? 'current section'}`
    : '';
  return [
    `STUDY SET: ${context.studySetTitle.slice(0, 180)}`,
    `SUBJECT: ${context.subject.slice(0, 120)}`,
    `CURRENT CHUNK — ${context.currentChunk.title.slice(0, 180)}\n${context.currentChunk.text.slice(0, 3_500)}`,
    nearby,
    questionContext,
    context.mastery === undefined ? '' : `ESTIMATED MASTERY: ${context.mastery}%`,
    recentConversation ? `RECENT CONVERSATION\n${recentConversation}` : '',
    `STUDENT REQUEST: ${requests[action]}`,
  ].filter(Boolean).join('\n\n').slice(0, 9_500);
}

function parseTutorResponse(raw: string, action: AiTutorAction): AiTutorResponse | null {
  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    return action === 'quiz' ? null : plainAnswer(raw);
  }
  try {
    const value = JSON.parse(raw.slice(firstBrace, lastBrace + 1)) as {
      kind?: string;
      answer?: string;
      quiz?: { question?: string; options?: string[]; correctIndex?: number; explanation?: string };
    };
    if (action !== 'quiz') {
      const answer = typeof value.answer === 'string' ? value.answer.trim().slice(0, 3_000) : '';
      return answer ? { kind: 'answer', answer, provider: 'on-device' } : null;
    }
    const quiz = value.quiz;
    if (!quiz || typeof quiz.question !== 'string' || !Array.isArray(quiz.options) || quiz.options.length !== 4) return null;
    if (!quiz.options.every((option) => typeof option === 'string' && option.trim())) return null;
    if (!Number.isInteger(quiz.correctIndex) || (quiz.correctIndex ?? -1) < 0 || (quiz.correctIndex ?? 4) > 3) return null;
    return {
      kind: 'quiz',
      answer: '',
      provider: 'on-device',
      quiz: {
        question: quiz.question.trim().slice(0, 500),
        options: quiz.options.map((option) => option.trim().slice(0, 300)),
        correctIndex: quiz.correctIndex!,
        explanation: typeof quiz.explanation === 'string' ? quiz.explanation.trim().slice(0, 1_000) : '',
      },
    };
  } catch {
    return action === 'quiz' || raw.trimStart().startsWith('{') ? null : plainAnswer(raw);
  }
}

function plainAnswer(raw: string): AiTutorResponse | null {
  const answer = raw
    .replace(/^```(?:json|text)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
    .slice(0, 3_000);
  return answer ? { kind: 'answer', answer, provider: 'on-device' } : null;
}
