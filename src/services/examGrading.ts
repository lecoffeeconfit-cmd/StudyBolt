import type { AiTutorQuota, QuizAnswerRecord, QuizQuestion } from '../models';
import { isAiTutorConfigured, studyBoltAiRequest } from './aiTutor';

export interface SemanticGradingResult {
  answers: QuizAnswerRecord[];
  quota?: AiTutorQuota;
  usedCloud: boolean;
  warning?: string;
}

interface GradePayload {
  questionId: string;
  partialCredit: number;
  correct: boolean;
  feedback: string;
  missingIdeas: string[];
}

const OPEN_TYPES = new Set(['short-answer', 'fill-blank', 'definition', 'application']);

function validQuota(value: unknown): value is AiTutorQuota {
  if (!value || typeof value !== 'object') return false;
  const quota = value as Partial<AiTutorQuota>;
  return typeof quota.used === 'number'
    && typeof quota.limit === 'number'
    && typeof quota.remaining === 'number'
    && typeof quota.periodStart === 'string'
    && typeof quota.periodEnd === 'string'
    && (quota.plan === 'free' || quota.plan === 'premium');
}

function parseGrade(value: unknown): GradePayload | null {
  if (!value || typeof value !== 'object') return null;
  const grade = value as Partial<GradePayload>;
  if (typeof grade.questionId !== 'string' || typeof grade.partialCredit !== 'number' || typeof grade.correct !== 'boolean' || typeof grade.feedback !== 'string') return null;
  return {
    questionId: grade.questionId,
    partialCredit: Math.max(0, Math.min(1, grade.partialCredit)),
    correct: grade.correct,
    feedback: grade.feedback.trim().slice(0, 1_000),
    missingIdeas: Array.isArray(grade.missingIdeas) ? grade.missingIdeas.filter((item): item is string => typeof item === 'string').map((item) => item.trim().slice(0, 240)).filter(Boolean).slice(0, 4) : [],
  };
}

/** One bounded, server-metered request grades all eligible open answers together.
 * Local scores remain authoritative whenever offline, signed out, or over quota. */
export async function gradeOpenExamAnswers({
  questions,
  answers,
  accessToken,
}: {
  questions: QuizQuestion[];
  answers: QuizAnswerRecord[];
  accessToken?: string | null;
}): Promise<SemanticGradingResult> {
  if (!accessToken || !isAiTutorConfigured) return { answers, usedCloud: false };
  const answerById = new Map(answers.map((answer) => [answer.questionId, answer]));
  const gradingItems = questions
    .filter((question) => OPEN_TYPES.has(question.type) && Boolean(answerById.get(question.id)?.openAnswer?.trim()))
    .map((question) => {
      const answer = answerById.get(question.id)!;
      return {
        questionId: question.id,
        prompt: question.prompt.slice(0, 700),
        studentAnswer: answer.openAnswer!.slice(0, 1_200),
        expectedAnswer: (question.acceptedAnswers?.[0] ?? question.explanation).slice(0, 1_200),
        explanation: question.explanation.slice(0, 1_200),
        concept: (question.conceptTitle ?? question.source.label).slice(0, 200),
        source: question.source.label.slice(0, 200),
        localPartialCredit: answer.partialCredit ?? 0,
      };
    });
  if (!gradingItems.length) return { answers, usedCloud: false };

  // Keep the request bounded; unsubmitted overflow retains deterministic local grading.
  const bounded: typeof gradingItems = [];
  let characters = 0;
  gradingItems.forEach((item) => {
    const size = JSON.stringify(item).length;
    if (bounded.length < 24 && characters + size <= 15_000) {
      bounded.push(item);
      characters += size;
    }
  });

  try {
    const response = await studyBoltAiRequest('', accessToken, {
      method: 'POST',
      body: JSON.stringify({ action: 'grade-exam', channel: 'exam', gradingItems: bounded }),
    });
    const payload = await response.json() as Record<string, unknown>;
    if (!response.ok || payload.kind !== 'grading' || !Array.isArray(payload.grades)) {
      return { answers, usedCloud: false, warning: typeof payload.error === 'string' ? payload.error : 'Semantic grading was unavailable, so StudyBolt used its offline grading.' };
    }
    const grades = new Map(payload.grades.map(parseGrade).filter((grade): grade is GradePayload => Boolean(grade)).map((grade) => [grade.questionId, grade]));
    const updated = answers.map((answer) => {
      const grade = grades.get(answer.questionId);
      if (!grade) return answer;
      return {
        ...answer,
        correct: grade.correct,
        partialCredit: grade.partialCredit,
        gradingFeedback: grade.feedback,
        missingIdeas: grade.missingIdeas,
        gradingProvider: 'cloud' as const,
      };
    });
    const quota = validQuota(payload.quota) ? payload.quota : undefined;
    return { answers: updated, usedCloud: grades.size > 0, ...(quota ? { quota } : {}) };
  } catch {
    return { answers, usedCloud: false, warning: 'Semantic grading timed out or is offline, so StudyBolt used its source-grounded local grading.' };
  }
}
