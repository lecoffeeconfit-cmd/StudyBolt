import { createEmptyCard, fsrs, Rating } from 'ts-fsrs';
import type { Card as FSRSCard, FSRSHistory, Grade } from 'ts-fsrs';

import type { Flashcard, RetentionMode, StudyBoltState, StudyEvent } from '../models';

export type AdvancedRetentionMode = Exclude<RetentionMode, 'standard'>;

export interface RetentionCardSchedule {
  algorithm: AdvancedRetentionMode;
  dueAt: string;
  due: boolean;
  lastReviewedAt: string | null;
  stabilityDays: number;
  difficulty: number;
  retrievability: number | null;
  reviewCount: number;
  lapses: number;
  hasEvidence: boolean;
}

// Kept as an alias for callers that used the original FSRS-only name.
export type PersonalizedCardSchedule = RetentionCardSchedule;

const fsrsScheduler = fsrs({
  request_retention: 0.9,
  maximum_interval: 365,
  enable_fuzz: false,
});

interface ReviewObservation {
  at: Date;
  rating: Rating;
  quality: number;
}

function validDate(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(+date) ? date : null;
}

function smartCardId(deckId: string, questionId: string): string | null {
  const prefix = `smart-${deckId}-`;
  return questionId.startsWith(prefix) ? questionId.slice(prefix.length) : null;
}

function flashcardObservation(event: StudyEvent): ReviewObservation | null {
  const at = validDate(event.occurredAt);
  if (!at || !event.confidence) return null;
  if (event.confidence === 'new') return { at, rating: Rating.Again, quality: 2 };
  if (event.confidence === 'learning') return { at, rating: Rating.Hard, quality: 3 };
  return { at, rating: Rating.Good, quality: 5 };
}

function quizObservation(answer: NonNullable<StudyEvent['quizAnswers']>[number], fallbackAt: string): ReviewObservation | null {
  const at = validDate(answer.answeredAt ?? fallbackAt);
  if (!at) return null;
  if (!answer.correct) {
    return { at, rating: Rating.Again, quality: answer.confidence === 'very-sure' ? 1 : 2 };
  }
  if (answer.confidence === 'very-sure') return { at, rating: Rating.Easy, quality: 5 };
  if (answer.confidence === 'somewhat-sure') return { at, rating: Rating.Good, quality: 4 };
  return { at, rating: Rating.Hard, quality: 3 };
}

function reviewObservations(state: StudyBoltState, deckId: string, cardId: string): ReviewObservation[] {
  const history: ReviewObservation[] = [];
  state.activityEvents.forEach((event) => {
    if (event.type === 'flashcard-review' && event.deckId === deckId && event.cardId === cardId) {
      const observation = flashcardObservation(event);
      if (observation) history.push(observation);
    }
    if (event.type !== 'quiz' || event.deckId !== deckId) return;
    (event.quizAnswers ?? []).forEach((answer) => {
      if (smartCardId(deckId, answer.questionId) !== cardId) return;
      const observation = quizObservation(answer, event.occurredAt);
      if (observation) history.push(observation);
    });
  });
  return history.sort((a, b) => +a.at - +b.at);
}

function fsrsHistory(observations: ReviewObservation[]): FSRSHistory[] {
  return observations.map(({ at, rating }) => ({ rating: rating as Grade, review: at }));
}

function emptySchedule(algorithm: AdvancedRetentionMode, now: Date): RetentionCardSchedule {
  return {
    algorithm,
    dueAt: now.toISOString(),
    due: true,
    lastReviewedAt: null,
    stabilityDays: 0,
    difficulty: 0,
    retrievability: null,
    reviewCount: 0,
    lapses: 0,
    hasEvidence: false,
  };
}

function noEvidenceSchedule(card: Flashcard, algorithm: AdvancedRetentionMode, now: Date): RetentionCardSchedule {
  const due = new Date(now);
  if (card.confidence === 'known') due.setDate(due.getDate() + 7);
  return {
    algorithm,
    dueAt: due.toISOString(),
    due: card.confidence !== 'known',
    lastReviewedAt: null,
    stabilityDays: card.confidence === 'known' ? 7 : card.confidence === 'learning' ? 1 : 0,
    difficulty: card.confidence === 'known' ? 5 : card.confidence === 'learning' ? 7 : 8,
    retrievability: null,
    reviewCount: 0,
    lapses: 0,
    hasEvidence: false,
  };
}

function getFsrsSchedule(card: Flashcard, observations: ReviewObservation[], now: Date): RetentionCardSchedule {
  if (!observations.length) return noEvidenceSchedule(card, 'fsrs', now);
  const replay = fsrsScheduler.reschedule(createEmptyCard(observations[0]!.at), fsrsHistory(observations), { now });
  const latest = replay.collections[replay.collections.length - 1]?.card as FSRSCard | undefined;
  if (!latest) return noEvidenceSchedule(card, 'fsrs', now);

  const dueAt = new Date(latest.due);
  const lastReviewedAt = latest.last_review ? new Date(latest.last_review).toISOString() : null;
  const retrievability = Number.isFinite(latest.stability) && latest.stability > 0
    ? Math.max(0, Math.min(1, fsrsScheduler.get_retrievability(latest, now, false)))
    : null;
  return {
    algorithm: 'fsrs',
    dueAt: dueAt.toISOString(),
    due: +dueAt <= +now,
    lastReviewedAt,
    stabilityDays: latest.stability,
    difficulty: latest.difficulty,
    retrievability,
    reviewCount: observations.length,
    lapses: latest.lapses,
    hasEvidence: true,
  };
}

function sm2Difficulty(easeFactor: number): number {
  const normalized = Math.max(1.3, Math.min(2.5, easeFactor));
  return Math.max(1, Math.min(10, Math.round(10 - ((normalized - 1.3) / 1.2) * 9)));
}

function getSm2Schedule(card: Flashcard, observations: ReviewObservation[], now: Date): RetentionCardSchedule {
  if (!observations.length) return noEvidenceSchedule(card, 'sm2', now);

  let repetitions = 0;
  let intervalDays = 0;
  let easeFactor = 2.5;
  let lapses = 0;
  let lastReviewedAt: Date | null = null;

  observations.forEach(({ at, quality }) => {
    if (quality < 3) {
      repetitions = 0;
      intervalDays = 1;
      lapses += 1;
    } else {
      repetitions += 1;
      intervalDays = repetitions === 1 ? 1 : repetitions === 2 ? 6 : Math.max(1, Math.round(intervalDays * easeFactor));
    }
    easeFactor = Math.max(1.3, easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    lastReviewedAt = at;
  });

  const dueAt = new Date(lastReviewedAt!);
  dueAt.setDate(dueAt.getDate() + Math.max(1, intervalDays));
  const elapsedDays = Math.max(0, (+now - +lastReviewedAt!) / 86400000);
  const retrievability = Math.max(0, Math.min(1, Math.pow(0.9, elapsedDays / Math.max(1, intervalDays))));
  return {
    algorithm: 'sm2',
    dueAt: dueAt.toISOString(),
    due: +dueAt <= +now,
    lastReviewedAt: lastReviewedAt!.toISOString(),
    stabilityDays: Math.max(1, intervalDays),
    difficulty: sm2Difficulty(easeFactor),
    retrievability,
    reviewCount: observations.length,
    lapses,
    hasEvidence: true,
  };
}

export function getRetentionCardSchedule(
  state: StudyBoltState,
  deckId: string,
  cardId: string,
  mode: AdvancedRetentionMode,
  now = new Date(),
): RetentionCardSchedule {
  const deck = state.decks.find((item) => item.id === deckId);
  const card = deck?.flashcards.find((item) => item.id === cardId);
  if (!card) return emptySchedule(mode, now);
  const observations = reviewObservations(state, deckId, cardId);
  return mode === 'sm2' ? getSm2Schedule(card, observations, now) : getFsrsSchedule(card, observations, now);
}

export function getPersonalizedCardSchedule(
  state: StudyBoltState,
  deckId: string,
  cardId: string,
  now = new Date(),
): PersonalizedCardSchedule {
  return getRetentionCardSchedule(state, deckId, cardId, 'fsrs', now);
}
