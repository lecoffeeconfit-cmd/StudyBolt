import type { StudyBoltState, StudyPack } from '../models';

export interface HomePracticeEvidence {
  accuracy: number | null;
  correctAnswers: number;
  totalAnswers: number;
  quizCount: number;
  focus: { deck: StudyPack; topic: string; missed: number; total: number } | null;
}

/** Completed practice records only; opening notes and card confidence are not evidence. */
export function buildHomePracticeEvidence(state: Pick<StudyBoltState, 'decks' | 'activityEvents'>): HomePracticeEvidence {
  const decks = new Map(state.decks.map((deck) => [deck.id, deck]));
  const quizzes = state.activityEvents
    .filter((event) => !event.id.startsWith('seed-') && event.type === 'quiz' && event.assessmentKind === 'practice'
      && Number.isFinite(Date.parse(event.occurredAt))
      && event.quizAnswers?.some((answer) => decks.has(answer.sourceDeckId ?? event.deckId ?? '')))
    .slice().sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)).slice(0, 3);
  let correctAnswers = 0;
  let totalAnswers = 0;
  const topics = new Map<string, NonNullable<HomePracticeEvidence['focus']>>();
  for (const quiz of quizzes) {
    for (const answer of quiz.quizAnswers ?? []) {
      const deck = decks.get(answer.sourceDeckId ?? quiz.deckId ?? '');
      if (!deck) continue;
      totalAnswers += 1;
      if (answer.correct) correctAnswers += 1;
      // A section must resolve to a real source title before we recommend it.
      const topic = deck.outline.find((section) => section.id === answer.sourceSectionId)?.title;
      if (!topic) continue;
      const key = JSON.stringify([deck.id, answer.sourceSectionId]);
      const summary = topics.get(key) ?? { deck, topic, missed: 0, total: 0 };
      summary.total += 1;
      if (!answer.correct) summary.missed += 1;
      topics.set(key, summary);
    }
  }
  return {
    accuracy: totalAnswers ? Math.round(correctAnswers / totalAnswers * 100) : null,
    correctAnswers, totalAnswers, quizCount: quizzes.length,
    focus: [...topics.values()].filter((topic) => topic.missed > 0)
      .sort((a, b) => b.missed - a.missed || b.missed / b.total - a.missed / a.total)[0] ?? null,
  };
}

/** The player reopens in Summary mode, so only a recorded Summary position is resumable here. */
export function findHomeAudioResume(state: Pick<StudyBoltState, 'decks' | 'activityEvents'>): StudyPack | null {
  const seen = new Set<string>();
  const audioEvents = state.activityEvents.filter((event) => !event.id.startsWith('seed-') && event.type === 'audio' && event.deckId
    && Number.isFinite(Date.parse(event.occurredAt)))
    .slice().sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
  for (const event of audioEvents) {
    if (!event.deckId || seen.has(event.deckId)) continue;
    seen.add(event.deckId);
    if (event.audioMode !== 'summary' || (event.completionPercent ?? 0) >= 100) continue;
    const deck = state.decks.find((item) => item.id === event.deckId);
    if (!deck || !Number.isFinite(deck.audioPosition) || deck.audioPosition <= 0) continue;
    const wordCount = (deck.audioSummary || deck.quickReview).split(/\s+/).filter(Boolean).length;
    if (deck.audioPosition < wordCount) return deck;
  }
  return null;
}
