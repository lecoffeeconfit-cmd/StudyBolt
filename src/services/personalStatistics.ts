import type { StudyBoltState } from '../models';

/**
 * Read-only display scope. Scores, answers and schedules are not recalculated or
 * saved here. Mixed sample/personal sessions stay in the optional all-data view.
 */
export function personalStatisticsState(state: StudyBoltState): StudyBoltState {
  const decks = state.decks.filter((deck) => deck.fileType !== 'demo');
  const ids = new Set(decks.map((deck) => deck.id));
  const courses = new Set(decks.map((deck) => deck.courseId));
  const activityEvents = state.activityEvents.filter((event) => {
    if (event.id.startsWith('seed-')) return false;
    if (event.quizAnswers?.length) return event.quizAnswers.every((answer) => ids.has(answer.sourceDeckId ?? event.deckId ?? ''));
    if (event.sourceDeckIds?.length) return event.sourceDeckIds.every((id) => ids.has(id));
    if (event.deckId) return ids.has(event.deckId);
    return event.type === 'focus';
  });
  const hasPersonalPlan = state.plan.scope.type === 'deck' ? ids.has(state.plan.scope.id) : courses.has(state.plan.scope.id);
  return {
    ...state,
    decks,
    classes: state.classes.filter((course) => courses.has(course.id)),
    activityEvents,
    flaggedItems: state.flaggedItems.filter((item) => ids.has(item.deckId)),
    conceptMastery: state.conceptMastery?.filter((item) => ids.has(item.sourceDeckId)),
    examAttempts: state.examAttempts?.filter((attempt) => attempt.sourceDeckIds.length > 0 && attempt.sourceDeckIds.every((id) => ids.has(id))),
    // The old global total cannot distinguish bundled history from personal work.
    // Recorded focus events and per-pack study time remain available to analytics.
    focusMinutes: activityEvents.filter((event) => event.type === 'focus').reduce((sum, event) => sum + Math.max(0, event.durationMinutes ?? 0), 0),
    plan: hasPersonalPlan ? state.plan : { ...state.plan, createdAt: undefined, targetDate: undefined, exam: undefined, days: [] },
  };
}
