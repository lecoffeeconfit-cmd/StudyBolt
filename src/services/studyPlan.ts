import type { QuizQuestionCount, StudyModality, StudyPack, StudyPlan, StudyPlanDay, StudyScope } from '../models';
import { buildAssessment } from './assessment';
import { calculateMastery } from './mastery';

export const RECOMMENDED_MODALITIES: StudyModality[] = ['notes', 'audio', 'flashcards', 'quiz', 'test'];

export const MODALITY_LABELS: Record<StudyModality, string> = {
  notes: 'Simplified Notes',
  audio: 'Quick Review Audio',
  flashcards: 'Active Recall Cards',
  quiz: 'Practice Quiz',
  test: 'Full PowerPoint Test',
};

const MODALITY_ORDER: Record<StudyModality, number> = {
  notes: 0,
  audio: 1,
  flashcards: 2,
  quiz: 3,
  test: 4,
};

export interface StudyPlanOptions {
  durationDays: StudyPlan['durationDays'];
  scope: StudyScope;
  modalities: StudyModality[];
  quizQuestionCount: QuizQuestionCount;
  remindersEnabled?: boolean;
}

export function estimateStudyMinutesByModality(
  decks: StudyPack[],
  quizQuestionCount: QuizQuestionCount,
): Record<StudyModality, number> {
  const pages = decks.reduce((sum, deck) => sum + deck.pageCount, 0);
  const notes = decks.reduce((sum, deck) => sum + deck.notes.flatMap((note) => note.bullets).length, 0);
  const words = decks.reduce((sum, deck) => sum + deck.quickReview.split(/\s+/).filter(Boolean).length, 0);
  const cards = decks.reduce((sum, deck) => sum + deck.flashcards.length, 0);
  const comprehensiveQuestions = decks.reduce((sum, deck) => sum + buildAssessment(deck, 'comprehensive').length, 0);
  const averageMastery = decks.length
    ? decks.reduce((sum, deck) => sum + calculateMastery(deck).overall, 0) / decks.length
    : 0;
  const learningFactor = 1 + (100 - averageMastery) / 300;

  return {
    notes: Math.max(10, Math.round((notes * 1.6 + pages * 0.18) * learningFactor)),
    audio: Math.max(6, Math.round(words / 135)),
    flashcards: Math.max(10, Math.round(cards * 1.35 * learningFactor)),
    quiz: Math.max(12, Math.round(quizQuestionCount * 1.25 * decks.length)),
    test: Math.max(15, Math.round(comprehensiveQuestions * 1.35)),
  };
}

function scheduledDays(modality: StudyModality, durationDays: number): number[] {
  const last = durationDays - 1;
  const count = modality === 'flashcards'
    ? Math.min(durationDays, Math.max(1, durationDays <= 3 ? durationDays : Math.ceil(durationDays * 0.55)))
    : modality === 'quiz'
      ? Math.min(durationDays, Math.max(1, Math.ceil(durationDays * 0.3)))
      : modality === 'test'
        ? 1
        : Math.min(durationDays, durationDays >= 7 ? 2 : 1);
  const start = modality === 'quiz' ? Math.floor(last * 0.55) : modality === 'test' ? last : 0;
  const end = modality === 'notes' || modality === 'audio' ? Math.max(0, Math.floor(last * 0.45)) : last;
  if (count === 1) return [modality === 'test' ? last : start];
  return Array.from({ length: count }, (_, index) => Math.round(start + ((end - start) * index) / (count - 1)));
}

export function buildStudyPlan(decks: StudyPack[], options: StudyPlanOptions): StudyPlan {
  const modalities = [...new Set(options.modalities)].sort((a, b) => MODALITY_ORDER[a] - MODALITY_ORDER[b]);
  const estimates = estimateStudyMinutesByModality(decks, options.quizQuestionCount);
  const dayBlocks: StudyPlanDay['blocks'][] = Array.from({ length: options.durationDays }, () => []);

  modalities.forEach((modality) => {
    if (modality === 'test' && decks.length > 1) {
      decks.forEach((deck, deckIndex) => {
        const dayIndex = Math.max(0, options.durationDays - decks.length + deckIndex);
        dayBlocks[dayIndex]?.push({
          id: `day-${dayIndex}-test-${deck.id}`,
          modality,
          label: `Full Test · ${deck.title}`,
          minutes: Math.max(15, Math.round(buildAssessment(deck, 'comprehensive').length * 1.35)),
          complete: false,
        });
      });
      return;
    }
    const days = scheduledDays(modality, options.durationDays);
    const baseMinutes = Math.max(5, Math.floor(estimates[modality] / days.length));
    let remaining = estimates[modality];
    days.forEach((dayIndex, sessionIndex) => {
      const minutes = sessionIndex === days.length - 1 ? remaining : baseMinutes;
      remaining -= minutes;
      dayBlocks[dayIndex]?.push({
        id: `day-${dayIndex}-${modality}-${sessionIndex}`,
        modality,
        label: sessionIndex > 0 && modality === 'flashcards' ? 'Spaced Recall Cards' : MODALITY_LABELS[modality],
        minutes,
        complete: false,
      });
    });
  });

  const days = dayBlocks.map((blocks, index) => {
    const sorted = blocks.sort((a, b) => MODALITY_ORDER[a.modality] - MODALITY_ORDER[b.modality]);
    return {
      id: `plan-day-${index}`,
      label: index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : `Day ${index + 1}`,
      subtitle: index === options.durationDays - 1
        ? 'Cumulative check and weak-spot review'
        : index === 0
          ? 'Build the source-order foundation'
          : sorted.length
            ? 'Spaced practice for durable recall'
            : 'Rest day — let the material settle',
      minutes: sorted.reduce((sum, block) => sum + block.minutes, 0),
      blocks: sorted,
      complete: false,
    };
  });

  return {
    durationDays: options.durationDays,
    scope: options.scope,
    modalities,
    quizQuestionCount: options.quizQuestionCount,
    remindersEnabled: options.remindersEnabled ?? false,
    days,
  };
}

export function getPlanProgress(plan: StudyPlan): number {
  const blocks = plan.days.flatMap((day) => day.blocks);
  if (!blocks.length) return 0;
  return Math.round((blocks.filter((block) => block.complete).length / blocks.length) * 100);
}
