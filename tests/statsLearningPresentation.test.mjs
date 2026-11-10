import assert from 'node:assert/strict';
import test from 'node:test';
import { statsClassState, statsHistoryWindow, statsLearningDetails, statsPractice } from '../src/components/statsLearningPresentation.ts';

const now = new Date('2026-11-09T16:00:00Z');
const pack = (id, courseId = 'a') => ({
  id, courseId, title: id, fileName: `${id}.pptx`, fileType: 'pptx', quizAttempts: [90, 100],
  outline: [{ id: 'topic', title: 'Source topic' }],
  flashcards: [{ id: 'card', source: { sectionId: 'topic' } }], quiz: [{ id: 'question' }], notes: [{ id: 'note' }],
});
const event = (id, deckId, overrides = {}) => ({ id, type: 'quiz', deckId, occurredAt: '2026-11-08T12:00:00Z', quizScore: 60, ...overrides });
const group = { id: 'class:a', packs: [{ id: 'one' }], practicedTopicIds: [] };
const state = (overrides = {}) => ({
  decks: [pack('one'), pack('two', 'b')], classes: [{ id: 'a', name: 'Same name' }, { id: 'b', name: 'Same name' }],
  activityEvents: [], flaggedItems: [], conceptMastery: [], examAttempts: [], focusMinutes: 500,
  plan: { scope: { type: 'class', id: 'b' }, days: [{ blocks: [{ complete: true }] }], targetDate: '2026-11-20', exam: { date: '2026-11-20' } },
  ...overrides,
});

test('class presentation scopes by stable IDs, preserves source records, and keeps unrelated plans out', () => {
  const source = state({ activityEvents: [event('own', 'one'), event('other', 'two'), { id: 'global-focus', type: 'focus', durationMinutes: 30 }, event('focus', 'one', { type: 'focus', durationMinutes: 8 })] });
  const before = structuredClone(source);
  const scoped = statsClassState(source, group);
  assert.deepEqual(scoped.decks.map(pack => pack.id), ['one']);
  assert.deepEqual(scoped.classes.map(course => course.id), ['a']);
  assert.deepEqual(scoped.activityEvents.map(event => event.id), ['own', 'focus']);
  assert.equal(scoped.decks[0], source.decks[0]);
  assert.equal(scoped.activityEvents[0], source.activityEvents[0]);
  assert.equal(scoped.focusMinutes, 8);
  assert.deepEqual(scoped.plan.days, []);
  assert.equal(scoped.plan.exam, undefined);
  assert.deepEqual(source, before);
});

test('mixed or ambiguous assessment scores cannot leak into a selected class', () => {
  const source = state({ activityEvents: [
    event('mixed', 'one', { sourceDeckIds: ['one', 'two'], quizAnswers: [{ sourceDeckId: 'one' }, { sourceDeckId: 'two' }] }),
    event('ambiguous', 'one', { sourceDeckIds: ['one', 'two'], quizAnswers: [{ questionId: 'unknown' }] }),
    event('contradictory', 'one', { quizAnswers: [{ sourceDeckId: 'two' }] }),
    event('single-source', undefined, { sourceDeckIds: ['one'], quizAnswers: [{ questionId: 'known' }] }),
  ] });
  assert.deepEqual(statsClassState(source, group).activityEvents.map(event => event.id), ['single-source']);
  assert.equal(source.activityEvents.length, 4);
});

test('dated chart excludes invalid, future and undated legacy values and avoids linked exam duplication', () => {
  const source = statsClassState(state({ activityEvents: [event('dated', 'one', { quizScore: 72, examAttemptId: 'linked' }), event('future', 'one', { occurredAt: '2030-01-01' }), event('invalid', 'one', { quizScore: NaN }), event('missing', 'one', { quizScore: undefined })], examAttempts: [
    { id: 'linked', sourceDeckIds: ['one'], status: 'completed', completedAt: '2026-11-08', score: 72 },
    { id: 'unique', sourceDeckIds: ['one'], title: 'Saved test', status: 'completed', completedAt: '2026-11-09T10:00:00Z', score: 88 },
    { id: 'abandoned', sourceDeckIds: ['one'], status: 'abandoned', completedAt: '2026-11-08', score: 0 },
  ] }), group);
  assert.deepEqual(statsLearningDetails(source, group, { topicMastery: [] }, now).results.map(result => [result.id, result.score]), [['dated', 72], ['exam:unique', 88]]);
});

test('topic estimates stay unassessed without evidence while partial-credit accuracy remains exact', () => {
  const answers = [{ sourceSectionId: 'topic', correct: true }, { sourceSectionId: 'topic', correct: false, partialCredit: 0.5 }];
  const source = statsClassState(state({ activityEvents: [event('answers', 'one', { quizAnswers: answers })] }), group);
  const analytics = { topicMastery: [{ id: 'one:topic', value: 82 }] };
  const data = statsLearningDetails(source, group, analytics, now);
  assert.equal(data.topics[0].signal, null);
  assert.deepEqual(data.practice, { attempted: 2, correct: 1, incorrect: 1, accuracy: 75 });
  assert.equal(statsLearningDetails(source, { ...group, practicedTopicIds: ['one:topic'] }, analytics, now).topics[0].signal, 82);
  assert.equal(data.materials[0].accuracy, 75);
});

test('existing practice destinations only advertise ready real tools and scope flashcards to a topic', () => {
  const source = pack('one');
  const before = structuredClone(source);
  assert.deepEqual(statsPractice(source, 'flashcards', 'topic').cardIds, ['card']);
  assert.equal(statsPractice(source, 'flashcards', 'missing'), null);
  assert.equal(statsPractice({ ...source, fileType: 'demo' }, 'quiz'), null);
  const generation = { materials: { quiz: { status: 'failed' }, flashcards: { status: 'generating' }, simpleNotes: { status: 'ready' } } };
  assert.equal(statsPractice({ ...source, generation }, 'quiz'), null);
  assert.equal(statsPractice({ ...source, generation }, 'flashcards'), null);
  assert.equal(statsPractice({ ...source, generation }, 'notes').tool, 'notes');
  assert.deepEqual(source, before);
});

test('history windows filter actual calendar dates and never synthesize values', () => {
  const results = [{ id: 'old', at: '2026-09-01', score: 30 }, { id: 'month', at: '2026-10-15T16:00:00Z', score: 50 }, { id: 'week', at: '2026-11-08T16:00:00Z', score: 70 }];
  assert.deepEqual(statsHistoryWindow(results, '7', now).map(result => result.id), ['week']);
  assert.deepEqual(statsHistoryWindow(results, '30', now).map(result => result.id), ['month', 'week']);
  assert.deepEqual(statsHistoryWindow(results, 'all', now), results);
});
