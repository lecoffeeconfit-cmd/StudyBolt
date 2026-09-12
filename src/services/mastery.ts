import type { StudyPack } from '../models';

export interface MasteryBreakdown {
  overall: number;
  notes: number;
  flashcards: number;
  quiz: number;
  test: number;
  weakCount: number;
}

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function calculateMastery(deck: StudyPack): MasteryBreakdown {
  const notes = deck.notes.length ? (deck.reviewedNoteIds.length / deck.notes.length) * 100 : 0;
  const flashcardPoints = deck.flashcards.reduce((total, card) => {
    if (card.confidence === 'known') return total + 1;
    if (card.confidence === 'learning') return total + 0.5;
    return total;
  }, 0);
  const flashcards = deck.flashcards.length ? (flashcardPoints / deck.flashcards.length) * 100 : 0;
  const quiz = deck.quizAttempts.length ? deck.quizAttempts[deck.quizAttempts.length - 1] ?? 0 : 0;
  const test = deck.testAttempts?.length ? deck.testAttempts[deck.testAttempts.length - 1] ?? 0 : 0;
  const overall = deck.testAttempts?.length
    ? notes * 0.2 + flashcards * 0.3 + quiz * 0.2 + test * 0.3
    : notes * 0.25 + flashcards * 0.35 + quiz * 0.4;

  return {
    overall: clamp(overall),
    notes: clamp(notes),
    flashcards: clamp(flashcards),
    quiz: clamp(quiz),
    test: clamp(test),
    weakCount: deck.flashcards.filter((card) => card.confidence !== 'known').length,
  };
}

export function calculateCourseMastery(decks: StudyPack[]): number {
  if (!decks.length) return 0;
  return clamp(decks.reduce((sum, deck) => sum + calculateMastery(deck).overall, 0) / decks.length);
}
