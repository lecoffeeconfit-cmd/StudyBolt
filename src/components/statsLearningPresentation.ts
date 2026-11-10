import type { QuizAnswerRecord, StudyBoltState, StudyEvent, StudyPack } from '../models';
import type { AnalyticsSnapshot } from '../services/analytics';
import type { LearningMasteryGroup, LearningPracticeAction } from '../services/learningMastery';

/** Local display scope only. Never edits saved records, scores, or schedules. */
export function statsClassState(state: StudyBoltState, group: LearningMasteryGroup): StudyBoltState {
  const ids = new Set(group.packs.map(pack => pack.id));
  const decks = state.decks.filter(pack => ids.has(pack.id));
  const courseIds = new Set(decks.map(pack => pack.courseId));
  const belongs = (event: StudyEvent) => {
    const sources = eventSources(event);
    if (sources.length) return sources.every(id => ids.has(id));
    return event.type !== 'quiz' && Boolean(event.courseId && courseIds.has(event.courseId));
  };
  const activityEvents = state.activityEvents.filter(belongs);
  const hasPlan = state.plan.scope.type === 'deck' ? ids.has(state.plan.scope.id) : courseIds.has(state.plan.scope.id);
  return {
    ...state, decks, activityEvents,
    classes: state.classes.filter(course => group.id === `class:${course.id}` || courseIds.has(course.id)),
    flaggedItems: state.flaggedItems.filter(item => ids.has(item.deckId)),
    conceptMastery: state.conceptMastery?.filter(item => ids.has(item.sourceDeckId)),
    examAttempts: state.examAttempts?.filter(attempt => attempt.sourceDeckIds.length > 0 && attempt.sourceDeckIds.every(id => ids.has(id))),
    focusMinutes: activityEvents.filter(event => event.type === 'focus').reduce((sum, event) => sum + Math.max(0, event.durationMinutes ?? 0), 0),
    plan: hasPlan ? state.plan : { ...state.plan, createdAt: undefined, targetDate: undefined, exam: undefined, days: [] },
  };
}

export function eventSources(event: StudyEvent): string[] {
  const fallback = event.sourceDeckIds && event.sourceDeckIds.length > 1 ? undefined : event.deckId ?? event.sourceDeckIds?.[0];
  const sources = [event.deckId, ...event.sourceDeckIds ?? [], ...(event.quizAnswers ?? []).map(answer => answer.sourceDeckId ?? fallback)];
  // An answer in a mixed assessment with no source cannot be attributed safely.
  if (event.quizAnswers?.some(answer => !answer.sourceDeckId && !fallback)) return ['__unattributed__', ...sources.filter((id): id is string => Boolean(id))];
  return [...new Set(sources.filter((id): id is string => Boolean(id)))];
}

export interface StatsTopic {
  id: string; title: string; packId: string; packTitle: string; sectionId: string;
  signal: number | null; attempted: number; correct: number; incorrect: number; accuracy: number | null; reviews: number;
}

export interface StatsResult { id: string; at: string; score: number; title: string }

export function statsToolReady(pack: StudyPack, tool: LearningPracticeAction['tool']): boolean {
  const material = tool === 'notes' ? 'simpleNotes' : tool;
  const content = tool === 'notes' ? pack.notes : tool === 'flashcards' ? pack.flashcards : pack.quiz;
  return content.length > 0 && (!pack.generation || pack.generation.materials[material].status === 'ready');
}

export function statsPractice(pack: StudyPack, tool: LearningPracticeAction['tool'], sectionId?: string): LearningPracticeAction | null {
  if (!statsToolReady(pack, tool) || pack.fileType === 'demo') return null;
  const cards = tool === 'flashcards' && sectionId ? pack.flashcards.filter(card => card.source.sectionId === sectionId) : undefined;
  if (cards && !cards.length) return null;
  return {
    deckId: pack.id, tool, cardIds: cards?.map(card => card.id),
    label: tool === 'quiz' ? 'Practice pack quiz' : tool === 'flashcards' ? 'Review flashcards' : 'Read notes',
    reason: `Continue with ${pack.title}.`,
  };
}

function recordedEvents(state: StudyBoltState, now: Date) {
  const seen = new Set<string>();
  return state.activityEvents.filter(event => {
    if (seen.has(event.id) || !Number.isFinite(+new Date(event.occurredAt)) || +new Date(event.occurredAt) > +now) return false;
    seen.add(event.id);
    return true;
  }).sort((a, b) => +new Date(a.occurredAt) - +new Date(b.occurredAt));
}

export function statsLearningDetails(state: StudyBoltState, group: LearningMasteryGroup, analytics: AnalyticsSnapshot, now = new Date()) {
  const events = recordedEvents(state, now);
  const evidence = new Set(group.practicedTopicIds);
  const topicValues = new Map(analytics.topicMastery.map(topic => [topic.id, topic.value]));
  const answers: Array<{ deckId: string; answer: QuizAnswerRecord }> = events.filter(event => event.type === 'quiz').flatMap(event =>
    (event.quizAnswers ?? []).filter(answer => !answer.answeredAt || (Number.isFinite(+new Date(answer.answeredAt)) && +new Date(answer.answeredAt) <= +now)).flatMap(answer => {
      const deckId = answer.sourceDeckId ?? event.deckId ?? (event.sourceDeckIds?.length === 1 ? event.sourceDeckIds[0] : undefined);
      return deckId && state.decks.some(pack => pack.id === deckId) ? [{ deckId, answer }] : [];
    }));
  const summarize = (items: QuizAnswerRecord[]) => ({
    attempted: items.length, correct: items.filter(answer => answer.correct).length, incorrect: items.filter(answer => !answer.correct).length,
    accuracy: items.length ? Math.round(items.reduce((sum, answer) => sum + (answer.partialCredit ?? (answer.correct ? 1 : 0)), 0) / items.length * 100) : null,
  });
  const topics: StatsTopic[] = state.decks.flatMap(pack => pack.outline.map(section => {
    const id = `${pack.id}:${section.id}`;
    return {
      id, title: section.title, packId: pack.id, packTitle: pack.title, sectionId: section.id,
      signal: evidence.has(id) ? topicValues.get(id) ?? null : null,
      ...summarize(answers.filter(item => item.deckId === pack.id && item.answer.sourceSectionId === section.id).map(item => item.answer)),
      reviews: events.filter(event => event.type === 'flashcard-review' && event.deckId === pack.id && pack.flashcards.some(card => card.id === event.cardId && card.source.sectionId === section.id)).length,
    };
  }));
  const results: StatsResult[] = events.filter(event => event.type === 'quiz' && typeof event.quizScore === 'number' && event.quizScore >= 0 && event.quizScore <= 100).map(event => ({
    id: event.id, at: event.occurredAt, score: event.quizScore!, title: state.decks.find(pack => pack.id === event.deckId)?.title ?? 'Class assessment',
  }));
  for (const attempt of state.examAttempts ?? []) {
    if (attempt.status !== 'completed' || !attempt.completedAt || !Number.isFinite(+new Date(attempt.completedAt)) || +new Date(attempt.completedAt) > +now || !Number.isFinite(attempt.score) || attempt.score < 0 || attempt.score > 100) continue;
    if (events.some(event => event.type === 'quiz' && event.examAttemptId === attempt.id)) continue;
    results.push({ id: `exam:${attempt.id}`, at: attempt.completedAt, score: attempt.score, title: attempt.title });
  }
  results.sort((a, b) => +new Date(a.at) - +new Date(b.at));
  const materials = state.decks.map(pack => ({ pack, topics: topics.filter(topic => topic.packId === pack.id), ...summarize(answers.filter(item => item.deckId === pack.id).map(item => item.answer)) }));
  return { topics, results, materials, practice: summarize(answers.map(item => item.answer)) };
}

export function statsHistoryWindow(results: StatsResult[], range: '7' | '30' | 'all', now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (range !== 'all') start.setDate(start.getDate() - Number(range) + 1);
  return results.filter(result => range === 'all' || +new Date(result.at) >= +start);
}
