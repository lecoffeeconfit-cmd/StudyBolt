import type {
  ExamDifficulty,
  ExamSettings,
  QuizAnswerRecord,
  QuizDifficulty,
  QuizQuestion,
  QuizQuestionType,
  StudyBoltState,
  StudyPack,
} from '../models';

export type AssessmentKind = 'practice' | 'comprehensive';

const fallbackDistractors = [
  'It is unrelated to the source material.',
  'It reverses the relationship described in the lecture.',
  'It applies only outside the scope of this presentation.',
];

function withAnswer(correct: string, candidates: string[], seed: number): { options: string[]; correctIndex: number } {
  const distractors = [...new Set(candidates.filter((candidate) => candidate && candidate !== correct))].slice(0, 3);
  while (distractors.length < 3) distractors.push(fallbackDistractors[distractors.length] ?? 'None of these');
  const correctIndex = seed % 4;
  const options = [...distractors];
  options.splice(correctIndex, 0, correct);
  return { options, correctIndex };
}

function practiceQuestions(deck: StudyPack): QuizQuestion[] {
  const answerPool = deck.flashcards.map((card) => card.back);
  const bulletPool = deck.notes.flatMap((note) => note.bullets);
  const cards = deck.flashcards.map((card, index) => {
    const answer = withAnswer(card.back, [...answerPool, ...bulletPool], index + 1);
    return {
      id: `practice-card-${deck.id}-${card.id}`,
      type: 'multiple-choice' as const,
      prompt: `Which answer best fits this recall prompt: ${card.front}`,
      ...answer,
      explanation: card.explanation ?? card.back,
      source: card.source,
    };
  });
  const notes = deck.notes.flatMap((note, noteIndex) => note.bullets.slice(0, 3).map((bullet, bulletIndex) => {
    const otherTopicBullets = deck.notes.filter((item) => item.id !== note.id).flatMap((item) => item.bullets);
    const prompts = [
      `Which detail correctly belongs with “${note.title}”?`,
      `Which source-backed statement should be kept in a summary of “${note.title}”?`,
      `While reviewing “${note.title},” which idea should you retrieve?`,
    ];
    const answer = withAnswer(bullet, otherTopicBullets, noteIndex + bulletIndex + 2);
    return {
      id: `practice-note-${deck.id}-${note.id}-${bulletIndex}`,
      type: 'multiple-choice' as const,
      prompt: prompts[bulletIndex] ?? `Which detail correctly belongs with “${note.title}”?`,
      ...answer,
      explanation: note.keyIdea ?? bullet,
      source: note.source,
    };
  }));
  return [...deck.quiz, ...cards, ...notes];
}

function comprehensiveQuestions(deck: StudyPack): QuizQuestion[] {
  const noteQuestions = deck.notes.flatMap((note, noteIndex) => note.bullets.map((bullet, bulletIndex) => {
    const otherTopicBullets = deck.notes.filter((item) => item.id !== note.id).flatMap((item) => item.bullets);
    const prompts = [
      `Which statement is supported by the presentation’s “${note.title}” section?`,
      `Which detail correctly belongs in a complete explanation of “${note.title}”?`,
      `A student is reviewing “${note.title}.” Which claim should they keep?`,
      `Which source-backed idea about “${note.title}” is accurate?`,
      `For a cumulative exam, which statement best represents “${note.title}”?`,
      `Which claim from “${note.title}” is consistent with the lecture?`,
    ];
    const answer = withAnswer(bullet, otherTopicBullets, noteIndex * 3 + bulletIndex);
    return {
      id: `test-note-${deck.id}-${note.id}-${bulletIndex}`,
      type: 'multiple-choice' as const,
      prompt: prompts[bulletIndex] ?? prompts[bulletIndex % prompts.length] ?? `Which source-backed idea about “${note.title}” is accurate?`,
      ...answer,
      explanation: `${bullet} Source: ${note.source.label}.`,
      source: note.source,
    };
  }));
  const cardQuestions = deck.flashcards.map((card, index) => {
    const answer = withAnswer(card.back, deck.flashcards.map((item) => item.back), index + 2);
    return {
      id: `test-card-${deck.id}-${card.id}`,
      type: 'multiple-choice' as const,
      prompt: `On a cumulative test, what is the strongest explanation for: ${card.front}`,
      ...answer,
      explanation: card.explanation ?? card.back,
      source: card.source,
    };
  });
  const coveredSections = new Set([...noteQuestions, ...cardQuestions].map((question) => question.source.sectionId));
  const coverageQuestions = deck.outline
    .filter((section) => !coveredSections.has(section.id))
    .map((section, index) => {
      const correct = `Review the concepts summarized in ${section.title}.`;
      const answer = withAnswer(correct, deck.outline.filter((item) => item.id !== section.id).map((item) => `Review only ${item.title}.`), index);
      return {
        id: `test-coverage-${deck.id}-${section.id}`,
        type: 'multiple-choice' as const,
        prompt: `Which review action best ensures the “${section.title}” section is included in your full-presentation test?`,
        ...answer,
        explanation: `${section.title} is part of the source outline (${section.range}), so it remains in the cumulative coverage map.`,
        source: { sectionId: section.id, label: section.range },
      };
    });
  return [...noteQuestions, ...cardQuestions, ...coverageQuestions];
}

export function buildAssessment(deck: StudyPack, kind: AssessmentKind, requestedCount?: number): QuizQuestion[] {
  const questions = kind === 'practice' ? practiceQuestions(deck) : comprehensiveQuestions(deck);
  if (!requestedCount) return questions;
  return questions.slice(0, Math.min(requestedCount, questions.length));
}

export function getAssessmentCoverage(deck: StudyPack, questions: QuizQuestion[]): { covered: number; total: number } {
  const covered = new Set(questions.map((question) => question.source.sectionId));
  return {
    covered: deck.outline.filter((section) => covered.has(section.id)).length,
    total: deck.outline.length,
  };
}

export interface ExamReadiness {
  score: number;
  ready: string[];
  needsReview: string[];
  conceptCount: number;
}

export interface AdaptiveExamBuild {
  id: string;
  title: string;
  sourceDeckIds: string[];
  sourceLabels: string[];
  questions: QuizQuestion[];
  readiness: ExamReadiness;
}

interface CandidateSignal {
  mastery: number;
  misses: number;
  exposures: number;
  lastSeenAt: string | null;
  untested: boolean;
}

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(value)));

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function topicFor(deck: StudyPack, question: QuizQuestion): { id: string; title: string } {
  const note = deck.notes.find((item) => item.source.sectionId === question.source.sectionId);
  return {
    id: question.conceptId ?? `${deck.id}:section:${question.source.sectionId}`,
    title: question.conceptTitle ?? note?.title ?? question.source.label,
  };
}

function answerText(question: QuizQuestion): string {
  return question.options[question.correctIndex] ?? question.explanation;
}

function questionDifficulty(value: ExamDifficulty, mastery: number, index: number): QuizDifficulty {
  if (value === 'easy' || value === 'hard' || value === 'medium') return value;
  if (value === 'adaptive') return mastery < 45 ? 'easy' : mastery >= 75 ? 'hard' : 'medium';
  return index % 3 === 0 ? 'easy' : index % 3 === 1 ? 'medium' : 'hard';
}

function meaningfulTokens(value: string): string[] {
  const ignored = new Set(['about', 'after', 'again', 'also', 'because', 'being', 'between', 'could', 'from', 'have', 'into', 'more', 'most', 'only', 'that', 'their', 'there', 'these', 'this', 'through', 'what', 'when', 'where', 'which', 'while', 'with', 'would']);
  return [...new Set(normalized(value).split(' ').filter((word) => word.length >= 4 && !ignored.has(word)))];
}

function signalFor(state: StudyBoltState, deck: StudyPack, question: QuizQuestion, conceptId: string): CandidateSignal {
  const matchingCard = deck.flashcards.find((card) => card.source.sectionId === question.source.sectionId && (conceptId.endsWith(card.id) || normalized(card.front) === normalized(question.conceptTitle ?? '')));
  const selfMastery = matchingCard?.confidence === 'known' ? 86 : matchingCard?.confidence === 'learning' ? 52 : 12;
  const observations = state.activityEvents.flatMap((event) => event.type === 'quiz' && event.quizAnswers ? event.quizAnswers.map((answer) => ({ event, answer })) : [])
    .filter(({ event, answer }) => (event.deckId === deck.id || answer.sourceDeckId === deck.id) && answer.sourceSectionId === question.source.sectionId);
  const correct = observations.filter(({ answer }) => answer.correct).length;
  const accuracy = observations.length ? (correct / observations.length) * 100 : null;
  const mastery = accuracy === null ? selfMastery : selfMastery * 0.55 + accuracy * 0.45;
  const lastSeenAt = observations.map(({ answer, event }) => answer.answeredAt ?? event.occurredAt).sort((a, b) => +new Date(b) - +new Date(a))[0] ?? null;
  return { mastery, misses: observations.filter(({ answer }) => !answer.correct).length, exposures: observations.length, lastSeenAt, untested: observations.length === 0 && (matchingCard?.confidence ?? 'new') === 'new' };
}

function toExamQuestion(
  question: QuizQuestion,
  deck: StudyPack,
  topic: { id: string; title: string },
  type: QuizQuestionType,
  difficulty: QuizDifficulty,
  examId: string,
): QuizQuestion {
  const correct = answerText(question);
  const note = deck.notes.find((item) => item.source.sectionId === question.source.sectionId);
  let prompt = question.prompt;
  let options = [...question.options];
  let correctIndex = question.correctIndex;
  let correctIndices = question.correctIndices;
  const acceptedAnswers = [correct, ...(question.acceptedAnswers ?? [])].filter(Boolean);

  if (type === 'true-false') {
    prompt = `True or false: ${correct}`;
    options = ['True', 'False'];
    correctIndex = 0;
    correctIndices = undefined;
  } else if (type === 'fill-blank') {
    const token = meaningfulTokens(correct)[0];
    prompt = token ? `Fill in the blank: ${correct.replace(new RegExp(`\\b${token}\\b`, 'i'), '_____')}` : `Fill in the key idea: ${question.prompt}`;
    options = [];
    correctIndex = 0;
    correctIndices = undefined;
  } else if (type === 'short-answer' || type === 'definition') {
    prompt = type === 'definition' ? `Define “${topic.title}” in your own words.` : `In your own words, answer: ${question.prompt}`;
    options = [];
    correctIndex = 0;
    correctIndices = undefined;
  } else if (type === 'application') {
    prompt = note?.recallPrompts?.[0] ?? `Apply this idea to a new situation: ${question.prompt}`;
  } else if (type === 'multiple-select') {
    const secondCorrect = note?.bullets.find((bullet) => normalized(bullet) !== normalized(correct));
    if (secondCorrect && options.length < 5) {
      options = [correct, secondCorrect, ...options.filter((option) => option !== correct && option !== secondCorrect)].slice(0, 4);
      correctIndex = 0;
      correctIndices = [0, 1];
    } else {
      correctIndices = [correctIndex];
    }
  }

  return {
    ...question,
    id: `${examId}:${deck.id}:${question.id}:${type}`,
    examId,
    sourceDeckId: deck.id,
    conceptId: topic.id,
    conceptTitle: topic.title,
    type,
    prompt,
    options,
    correctIndex,
    ...(correctIndices ? { correctIndices } : {}),
    acceptedAnswers,
    difficulty,
    importance: question.importance ?? (note?.keyIdea ? 0.9 : 0.7),
    masteryImpact: type === 'short-answer' || type === 'definition' || type === 'application' || type === 'fill-blank' ? 1.2 : 1,
    aiGenerated: question.aiGenerated ?? false,
    createdAt: question.createdAt ?? new Date().toISOString(),
  };
}

function seededShuffle<T>(values: T[], seed: string): T[] {
  const output = [...values];
  let state = [...seed].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);
  for (let index = output.length - 1; index > 0; index -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const swap = state % (index + 1);
    const current = output[index];
    output[index] = output[swap]!;
    output[swap] = current!;
  }
  return output;
}

function randomizeAnswerOrder(question: QuizQuestion, seed: string): QuizQuestion {
  if (!question.options.length) return question;
  const order = seededShuffle(question.options.map((_, index) => index), seed);
  const correctIndexes = question.correctIndices ?? [question.correctIndex];
  const remapped = correctIndexes.map((index) => order.indexOf(index)).filter((index) => index >= 0).sort((a, b) => a - b);
  return {
    ...question,
    options: order.map((index) => question.options[index]!),
    correctIndex: remapped[0] ?? 0,
    ...(remapped.length > 1 ? { correctIndices: remapped } : {}),
  };
}

export function getExamReadiness(state: StudyBoltState, sourceDeckIds: string[]): ExamReadiness {
  const decks = state.decks.filter((deck) => sourceDeckIds.includes(deck.id));
  const concepts = decks.flatMap((deck) => deck.flashcards.map((card) => {
    const topic = { id: `${deck.id}:card:${card.id}`, title: card.front };
    const sourceQuestion: QuizQuestion = { id: card.id, type: 'short-answer', prompt: card.front, options: [card.back], correctIndex: 0, explanation: card.explanation ?? card.back, source: card.source };
    return { topic, signal: signalFor(state, deck, sourceQuestion, topic.id) };
  }));
  const scores = concepts.map(({ signal }) => signal.mastery);
  const score = concepts.length ? clamp(scores.reduce((sum, value) => sum + value, 0) / concepts.length) : 0;
  const ready = concepts.filter(({ signal }) => signal.mastery >= 75 && !signal.untested).sort((a, b) => b.signal.mastery - a.signal.mastery).slice(0, 5).map(({ topic }) => topic.title);
  const needsReview = concepts.filter(({ signal }) => signal.mastery < 70 || signal.untested).sort((a, b) => a.signal.mastery - b.signal.mastery).slice(0, 5).map(({ topic }) => topic.title);
  return { score, ready, needsReview, conceptCount: concepts.length };
}

/** Extends the existing assessment builder with source-aware adaptive selection. */
export function buildAdaptiveExam(state: StudyBoltState, settings: ExamSettings): AdaptiveExamBuild {
  const examId = `exam-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const decks = state.decks.filter((deck) => settings.sourceDeckIds.includes(deck.id)).sort((a, b) => a.order - b.order);
  const sourceLabels = decks.map((deck) => `${deck.courseName} · ${deck.title}`);
  const requestedTypes: QuizQuestionType[] = settings.questionTypes.length ? settings.questionTypes : ['multiple-choice'];
  const excluded = new Set(settings.excludedQuestionIds ?? []);
  const targetIds = new Set(settings.targetedConceptIds ?? []);
  const candidates = decks.flatMap((deck) => {
    const pool = [...deck.quiz, ...buildAssessment(deck, 'comprehensive')];
    const unique = [...new Map(pool.map((question) => [question.id, question])).values()];
    return unique.filter((question) => !settings.sourceSectionIds?.length || settings.sourceSectionIds.includes(question.source.sectionId)).map((question, index) => {
      const topic = topicFor(deck, question);
      const signal = signalFor(state, deck, question, topic.id);
      const targeted = targetIds.size > 0 && (targetIds.has(topic.id) || targetIds.has(question.source.sectionId) || [...targetIds].some((value) => normalized(value) === normalized(topic.title)));
      const bucketWeight = signal.untested ? 32 : signal.mastery < 45 ? 40 : signal.mastery < 75 ? 30 : 15;
      const priority = (targetIds.size && !targeted ? -200 : 0) + bucketWeight + signal.misses * 12 + (question.importance ?? 0.7) * 10 + (signal.untested ? 10 : 0) - Math.min(8, signal.exposures) + (signal.lastSeenAt ? Math.max(0, Math.min(7, (Date.now() - +new Date(signal.lastSeenAt)) / 86400000)) : 6);
      return { deck, question, topic, signal, priority, index, targeted };
    });
  }).filter((candidate) => !excluded.has(candidate.question.id));
  const ranked = candidates.sort((a, b) => b.priority - a.priority);
  const chosen: typeof ranked = [];
  const seenPrompts = new Set<string>();
  const desired = Math.max(1, Math.min(50, Math.round(settings.questionCount || 10)));
  const addCandidate = (candidate: typeof ranked[number]) => {
    const key = `${candidate.topic.id}:${normalized(candidate.question.prompt)}`;
    if (seenPrompts.has(key)) return false;
    seenPrompts.add(key);
    chosen.push(candidate);
    return true;
  };
  // Give each selected source a first pass so a cumulative exam does not let one pack dominate.
  decks.forEach((deck) => {
    const candidate = ranked.find((item) => item.deck.id === deck.id && (targetIds.size === 0 || item.targeted));
    if (candidate) addCandidate(candidate);
  });
  ranked.forEach((candidate) => { if (chosen.length < desired) addCandidate(candidate); });
  let questions = chosen.map((candidate, index) => toExamQuestion(candidate.question, candidate.deck, candidate.topic, requestedTypes[index % requestedTypes.length]!, questionDifficulty(settings.difficulty, candidate.signal.mastery, index), examId));
  if (settings.randomizeQuestions) questions = seededShuffle(questions, examId);
  if (settings.randomizeAnswers) questions = questions.map((question, index) => randomizeAnswerOrder(question, `${examId}:${index}`));
  return { id: examId, title: settings.title.trim() || `${decks[0]?.courseName ?? 'Study'} Adaptive Exam`, sourceDeckIds: decks.map((deck) => deck.id), sourceLabels, questions: questions.slice(0, desired), readiness: getExamReadiness(state, settings.sourceDeckIds) };
}

function normalizedAnswer(value: string): string {
  return normalized(value).replace(/\b(a|an|the)\b/g, '').trim();
}

export function evaluateExamAnswer(question: QuizQuestion, selectedIndices: number[] = [], openAnswer = ''): { correct: boolean; partialCredit: number } {
  if (question.options.length) {
    const expected = [...(question.correctIndices ?? [question.correctIndex])].sort((a, b) => a - b);
    const actual = [...new Set(selectedIndices)].sort((a, b) => a - b);
    const exact = expected.length === actual.length && expected.every((value, index) => value === actual[index]);
    return { correct: exact, partialCredit: exact ? 1 : 0 };
  }
  const value = normalizedAnswer(openAnswer);
  if (!value) return { correct: false, partialCredit: 0 };
  const expectedValues = [answerText(question), ...(question.acceptedAnswers ?? [])].map(normalizedAnswer).filter(Boolean);
  if (expectedValues.some((expected) => value === expected || value.includes(expected) || expected.includes(value))) return { correct: true, partialCredit: 1 };
  const expectedTokens = meaningfulTokens(expectedValues[0] ?? '');
  const actualTokens = new Set(meaningfulTokens(value));
  const overlap = expectedTokens.filter((token) => actualTokens.has(token)).length;
  const partialCredit = expectedTokens.length ? Math.min(1, overlap / Math.min(expectedTokens.length, 5)) : 0;
  return { correct: partialCredit >= 0.6, partialCredit };
}

export function calculateExamScore(questions: QuizQuestion[], answers: QuizAnswerRecord[]): number {
  if (!questions.length) return 0;
  const byId = new Map(answers.map((answer) => [answer.questionId, answer]));
  let possible = 0;
  let earned = 0;
  questions.forEach((question) => {
    const answer = byId.get(question.id);
    const difficultyWeight = question.difficulty === 'hard' ? 1.2 : question.difficulty === 'easy' ? 0.85 : 1;
    const typeWeight = ['short-answer', 'fill-blank', 'definition', 'application'].includes(question.type) ? 1.15 : 1;
    const weight = difficultyWeight * typeWeight * (question.masteryImpact ?? 1);
    possible += weight;
    earned += weight * (answer?.partialCredit ?? (answer?.correct ? 1 : 0));
  });
  return clamp((earned / Math.max(0.01, possible)) * 100);
}

export function estimateMasteryAfter(before: number, score: number, questionCount: number): number {
  const evidenceWeight = Math.min(0.22, 0.08 + questionCount / 250);
  return clamp(before + (score - before) * evidenceWeight);
}
