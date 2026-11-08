import assert from 'node:assert/strict';
import test from 'node:test';
import { personalStatisticsState } from '../src/services/personalStatistics.ts';

const pack = (id, fileType = 'pdf') => ({ id, courseId: `${id}-class`, fileType, quizScore: 43, testScore: 68 });
const fixture = (overrides = {}) => ({
  decks: [pack('own'), pack('sample', 'demo')],
  classes: [{ id: 'own-class' }, { id: 'sample-class' }],
  activityEvents: [], flaggedItems: [], conceptMastery: [], examAttempts: [], focusMinutes: 300,
  plan: { scope: { type: 'deck', id: 'sample' }, createdAt: '2026-11-01', targetDate: '2026-11-12', exam: { title: 'Example' }, days: [{ blocks: [{ complete: true }] }] },
  ...overrides,
});

test('sample history never appears as personal academic work', () => {
  const source = fixture({
    decks: [pack('sample', 'demo')],
    activityEvents: [
      { id: 'seed-focus', type: 'focus', durationMinutes: 30 },
      { id: 'sample-review', type: 'flashcard-review', deckId: 'sample' },
    ],
  });
  const result = personalStatisticsState(source);
  assert.deepEqual(result.decks, []);
  assert.deepEqual(result.classes, []);
  assert.deepEqual(result.activityEvents, []);
  assert.equal(result.focusMinutes, 0);
  assert.deepEqual(result.plan.days, []);
  assert.equal(result.plan.exam, undefined);
});

test('personal scores and answer evidence remain exact, with mixed sessions kept out of the personal view', () => {
  const personalAnswer = { sourceDeckId: 'own', correct: false, responseTimeMs: 9123 };
  const personalEvent = { id: 'own-quiz', type: 'quiz', deckId: 'own', score: 43, quizAnswers: [personalAnswer] };
  const source = fixture({ activityEvents: [
    personalEvent,
    { id: 'mixed-quiz', type: 'quiz', quizAnswers: [personalAnswer, { sourceDeckId: 'sample', correct: true }] },
    { id: 'mixed-test', type: 'test', sourceDeckIds: ['own', 'sample'] },
    { id: 'deleted-pack', type: 'notes', deckId: 'deleted' },
    { id: 'focus', type: 'focus', durationMinutes: 12 },
  ] });
  const before = structuredClone(source);
  const result = personalStatisticsState(source);
  assert.deepEqual(result.activityEvents.map((event) => event.id), ['own-quiz', 'focus']);
  assert.equal(result.activityEvents[0], personalEvent);
  assert.equal(result.activityEvents[0].quizAnswers[0], personalAnswer);
  assert.equal(result.decks[0], source.decks[0]);
  assert.equal(result.decks[0].quizScore, 43);
  assert.equal(result.decks[0].testScore, 68);
  assert.equal(result.focusMinutes, 12);
  assert.deepEqual(source, before);
});

test('only personal scope metadata is projected, and the original all-data state is retained', () => {
  const source = fixture({
    flaggedItems: [{ deckId: 'own' }, { deckId: 'sample' }],
    conceptMastery: [{ sourceDeckId: 'own' }, { sourceDeckId: 'sample' }],
    examAttempts: [{ sourceDeckIds: ['own'], score: 25 }, { sourceDeckIds: ['own', 'sample'], score: 99 }],
  });
  const result = personalStatisticsState(source);
  assert.deepEqual(result.flaggedItems, [{ deckId: 'own' }]);
  assert.deepEqual(result.conceptMastery, [{ sourceDeckId: 'own' }]);
  assert.deepEqual(result.examAttempts, [{ sourceDeckIds: ['own'], score: 25 }]);
  for (const scope of [{ type: 'deck', id: 'own' }, { type: 'class', id: 'own-class' }]) {
    const plan = { ...source.plan, scope };
    assert.equal(personalStatisticsState({ ...source, plan }).plan, plan);
  }
  assert.equal(source.plan.days.length, 1);
  assert.equal(source.focusMinutes, 300);
  assert.equal(source.decks.length, 2);
});
