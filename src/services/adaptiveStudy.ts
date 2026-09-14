import type {
  AnswerConfidence,
  QuizDifficulty,
  QuizQuestionType,
  StudyBoltState,
  StudyPack,
} from '../models';
import { buildAnalytics } from './analytics';

export type SmartStudyMode = 'smart' | 'pretest' | 'cram';

export interface SmartStudyItem {
  id: string;
  cardId: string;
  deckId: string;
  deckTitle: string;
  courseName: string;
  sectionId: string;
  sourceLabel: string;
  prompt: string;
  answer: string;
  explanation: string;
  format: QuizQuestionType;
  difficulty: QuizDifficulty;
  options?: string[];
  correctIndex?: number;
  reason: string;
  checkpoint: boolean;
}

export interface SmartStudyBrief {
  mode: SmartStudyMode;
  items: SmartStudyItem[];
  dueReviews: number;
  weakTopics: number;
  recentMistakes: number;
  atRisk: number;
  estimatedMinutes: number;
  examDaysLeft: number | null;
  examConceptsRemaining: number;
}

export interface MistakeNotebookItem {
  id: string;
  deckId: string;
  deckTitle: string;
  courseName: string;
  prompt: string;
  answer: string;
  explanation: string;
  sourceLabel: string;
  misses: number;
  confidentlyWrong: number;
  example: string;
}

const stopWords = new Set(['about', 'after', 'again', 'against', 'also', 'because', 'been', 'before', 'being', 'between', 'could', 'does', 'from', 'have', 'into', 'more', 'most', 'only', 'other', 'should', 'than', 'that', 'their', 'there', 'these', 'they', 'this', 'through', 'uses', 'using', 'what', 'when', 'where', 'which', 'while', 'with', 'would']);

function daysUntil(value?: string): number | null {
  if (!value) return null;
  const target = new Date(value);
  if (!Number.isFinite(+target)) return null;
  return Math.max(0, Math.ceil((+target - Date.now()) / 86400000));
}

function missCounts(state: StudyBoltState) {
  const byQuestion = new Map<string, { misses: number; confidentlyWrong: number }>();
  const bySection = new Map<string, number>();
  state.activityEvents.filter((event) => event.type === 'quiz' && (event.deckId || event.quizAnswers?.some((answer) => answer.sourceDeckId))).forEach((event) => {
    (event.quizAnswers ?? []).forEach((answer) => {
      if (answer.correct) return;
      const answerDeckId = answer.sourceDeckId ?? event.deckId;
      if (!answerDeckId) return;
      const questionKey = `${answerDeckId}:${answer.originQuestionId ?? answer.questionId}`;
      const sectionKey = `${answerDeckId}:${answer.sourceSectionId}`;
      const current = byQuestion.get(questionKey) ?? { misses: 0, confidentlyWrong: 0 };
      current.misses += 1;
      if (answer.confidence === 'very-sure') current.confidentlyWrong += 1;
      byQuestion.set(questionKey, current);
      bySection.set(sectionKey, (bySection.get(sectionKey) ?? 0) + 1);
    });
  });
  return { byQuestion, bySection };
}

function meaningfulWord(answer: string): string | null {
  const words = answer.match(/[A-Za-z][A-Za-z-]{4,}/g) ?? [];
  return words.find((word) => !stopWords.has(word.toLowerCase())) ?? words[0] ?? null;
}

function multipleChoiceOptions(answer: string, deck: StudyPack, seed: number): { options: string[]; correctIndex: number } {
  const distractors = deck.flashcards
    .map((card) => card.back)
    .filter((candidate) => candidate !== answer)
    .slice(seed % Math.max(1, deck.flashcards.length - 1));
  const fallbacks = deck.notes.flatMap((note) => note.bullets).filter((candidate) => candidate !== answer);
  const alternatives = [...new Set([...distractors, ...fallbacks])].slice(0, 3);
  while (alternatives.length < 3) alternatives.push('This idea is not supported by the source material.');
  const correctIndex = seed % 4;
  const options = [...alternatives];
  options.splice(correctIndex, 0, answer);
  return { options, correctIndex };
}

function formatForMastery(mastery: number, seed: number): QuizQuestionType {
  if (mastery < 40) return seed % 2 === 0 ? 'multiple-choice' : 'true-false';
  if (mastery < 72) return seed % 2 === 0 ? 'short-answer' : 'fill-blank';
  return seed % 2 === 0 ? 'application' : 'short-answer';
}

function difficultyForMastery(mastery: number): QuizDifficulty {
  return mastery >= 72 ? 'hard' : mastery >= 40 ? 'medium' : 'easy';
}

function makeCardItem(
  deck: StudyPack,
  cardIndex: number,
  mastery: number,
  reason: string,
  checkpoint: boolean,
): SmartStudyItem {
  const card = deck.flashcards[cardIndex]!;
  const format = formatForMastery(mastery, cardIndex);
  const note = deck.notes.find((item) => item.source.sectionId === card.source.sectionId);
  let prompt = card.front;
  let options: string[] | undefined;
  let correctIndex: number | undefined;
  if (format === 'multiple-choice') {
    const choice = multipleChoiceOptions(card.back, deck, cardIndex);
    options = choice.options;
    correctIndex = choice.correctIndex;
  } else if (format === 'true-false') {
    const isTrue = cardIndex % 3 !== 0;
    prompt = isTrue ? card.back : `This is accurate: ${deck.flashcards[(cardIndex + 1) % deck.flashcards.length]?.back ?? card.back}`;
    options = ['True', 'False'];
    correctIndex = isTrue ? 0 : 1;
  } else if (format === 'fill-blank') {
    const word = meaningfulWord(card.back);
    if (word) prompt = `Fill in the key idea: ${card.back.replace(word, '_____')}`;
  } else if (format === 'application') {
    prompt = note?.recallPrompts?.[0] ?? `Use ${note?.title ?? 'this concept'} to explain a realistic example.`;
  }
  return {
    id: `smart-${deck.id}-${card.id}`,
    cardId: card.id,
    deckId: deck.id,
    deckTitle: deck.title,
    courseName: deck.courseName,
    sectionId: card.source.sectionId,
    sourceLabel: card.source.label,
    prompt,
    answer: card.back,
    explanation: card.explanation ?? note?.keyIdea ?? card.back,
    format,
    difficulty: difficultyForMastery(mastery),
    reason,
    checkpoint,
    ...(options ? { options, correctIndex } : {}),
  };
}

function interleave<T extends { deckId: string }>(items: T[]): T[] {
  const groups = new Map<string, T[]>();
  items.forEach((item) => groups.set(item.deckId, [...(groups.get(item.deckId) ?? []), item]));
  const output: T[] = [];
  while ([...groups.values()].some((group) => group.length)) {
    groups.forEach((group) => {
      const next = group.shift();
      if (next) output.push(next);
    });
  }
  return output;
}

export function buildSmartStudyBrief(state: StudyBoltState, mode: SmartStudyMode = 'smart', focusDeckId?: string): SmartStudyBrief {
  const analytics = buildAnalytics(state);
  const { bySection } = missCounts(state);
  const insightByCard = new Map(
    [...analytics.weakConcepts, ...(analytics.atRiskConcepts ?? []), ...analytics.advanced.forgettingRisk, ...analytics.unseenConcepts]
      .map((concept) => [concept.id, concept] as const),
  );
  const candidateDecks = focusDeckId ? state.decks.filter((deck) => deck.id === focusDeckId) : state.decks;
  const candidates = candidateDecks.flatMap((deck) => deck.flashcards.map((card, cardIndex) => {
    const insight = insightByCard.get(`${deck.id}:${card.id}`);
    const mastery = insight?.mastery ?? (card.confidence === 'known' ? 82 : card.confidence === 'learning' ? 52 : 15);
    const misses = bySection.get(`${deck.id}:${card.source.sectionId}`) ?? 0;
    const due = insight?.due ?? card.confidence !== 'known';
    const atRisk = insight?.status === 'at-risk' || insight?.status === 'forgotten' || (insight?.forgettingRisk ?? 0) >= 35;
    const unseen = insight?.status === 'unseen' || card.confidence === 'new';
    const priority = mode === 'pretest'
      ? (unseen ? 160 : 80 - mastery)
      : mode === 'cram'
        ? misses * 35 + (100 - mastery) * 1.4 + (cardIndex < 3 ? 18 : 0)
        : (due ? 45 : 0) + misses * 30 + (100 - mastery) + (atRisk ? 35 : 0);
    const reason = mode === 'pretest'
      ? unseen ? 'Not tested yet' : 'Diagnostic check'
      : misses >= 2 ? `Missed ${misses} times`
        : atRisk ? 'At risk of fading'
          : due ? 'Due for review'
            : mode === 'cram' ? 'High-yield exam topic' : 'Weak concept';
    return { deck, cardIndex, mastery, priority, reason, checkpoint: Boolean(due && mastery >= 65), unseen, due, atRisk, misses };
  }));
  const eligible = mode === 'pretest' ? candidates.filter((item) => item.unseen || item.mastery < 80) : candidates;
  const ranked = eligible.sort((a, b) => b.priority - a.priority).slice(0, mode === 'cram' ? 12 : mode === 'pretest' ? 8 : 10);
  const items = interleave(ranked.map((item) => makeCardItem(item.deck, item.cardIndex, item.mastery, item.reason, item.checkpoint)));
  const examDaysLeft = daysUntil(state.plan.targetDate);
  const examConceptsRemaining = candidates.filter((candidate) => candidate.mastery < 80).length;
  return {
    mode,
    items,
    dueReviews: candidates.filter((candidate) => candidate.due).length,
    weakTopics: candidates.filter((candidate) => candidate.mastery < 65).length,
    recentMistakes: new Set(candidates.filter((candidate) => candidate.misses > 0).map((candidate) => `${candidate.deck.id}:${candidate.deck.flashcards[candidate.cardIndex]?.source.sectionId}`)).size,
    atRisk: candidates.filter((candidate) => candidate.atRisk).length,
    estimatedMinutes: Math.max(5, Math.round(items.length * (mode === 'cram' ? 1.1 : 1.4))),
    examDaysLeft,
    examConceptsRemaining,
  };
}

export function buildMistakeNotebook(state: StudyBoltState): MistakeNotebookItem[] {
  const { byQuestion } = missCounts(state);
  return [...byQuestion.entries()].filter(([, value]) => value.misses >= 2).flatMap(([key, value]) => {
    const separator = key.indexOf(':');
    const deckId = key.slice(0, separator);
    const questionId = key.slice(separator + 1);
    const deck = state.decks.find((item) => item.id === deckId);
    const question = deck?.quiz.find((item) => item.id === questionId);
    const smartCardId = deck && questionId.startsWith(`smart-${deck.id}-`) ? questionId.slice(`smart-${deck.id}-`.length) : undefined;
    const card = deck?.flashcards.find((item) => item.id === smartCardId);
    if (!deck || (!question && !card)) return [];
    const source = question?.source ?? card!.source;
    const note = deck.notes.find((item) => item.source.sectionId === source.sectionId);
    return [{
      id: key,
      deckId,
      deckTitle: deck.title,
      courseName: deck.courseName,
      prompt: question?.prompt ?? card!.front,
      answer: question ? question.options[question.correctIndex] ?? question.explanation : card!.back,
      explanation: question?.explanation ?? card!.explanation ?? note?.keyIdea ?? card!.back,
      sourceLabel: source.label,
      misses: value.misses,
      confidentlyWrong: value.confidentlyWrong,
      example: note?.examples?.[0] ?? note?.keyIdea ?? `Try explaining why “${question ? question.options[question.correctIndex] : card!.back}” is correct without looking at the choices.`,
    }];
  }).sort((a, b) => b.misses - a.misses);
}

export function confidenceLabel(confidence: AnswerConfidence | null): string {
  return confidence === 'very-sure' ? 'Confident' : confidence === 'somewhat-sure' ? 'Unsure' : 'Guess';
}
