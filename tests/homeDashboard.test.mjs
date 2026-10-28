import assert from 'node:assert/strict';
import test from 'node:test';
import { buildHomeDashboard, examCalendarDays } from '../src/services/homeDashboard.ts';

const now = new Date('2026-10-28T12:00:00Z');
const deck = (overrides = {}) => ({ id: 'bio', courseId: 'biology', courseName: 'Biology', title: 'Cells', fileType: 'pdf', createdAt: '2026-10-01T12:00:00Z', audioPosition: 3, notes: [{ id: 'note' }], outline: [{ id: 'cells', title: 'Cell structure' }], flashcards: [1, 2, 3].map(n => ({ id: `c${n}`, confidence: 'new', source: { sectionId: 'cells' } })), quiz: [1, 2, 3].map(n => ({ id: `q${n}` })), ...overrides });
const answer = (id, correct, overrides = {}) => ({ questionId: id, sourceSectionId: 'cells', correct, ...overrides });
const quiz = (id, day, answers, overrides = {}) => ({ id, type: 'quiz', deckId: 'bio', occurredAt: `2026-10-${day}T10:00:00Z`, assessmentKind: 'practice', quizAnswers: answers, ...overrides });
const review = (day, overrides = {}) => ({ id: `review-${day}`, type: 'flashcard-review', deckId: 'bio', cardId: 'c1', confidence: 'learning', occurredAt: `2026-10-${day}T10:00:00Z`, ...overrides });
const plan = (overrides = {}) => ({ durationDays: 3, scope: { type: 'deck', id: 'bio' }, modalities: ['flashcards'], quizQuestionCount: 10, remindersEnabled: false, days: [], targetDate: '2026-10-30T23:59:59Z', ...overrides });
const state = (overrides = {}) => ({ decks: [deck()], activityEvents: [], retentionMode: 'standard', plan: plan(), ...overrides });
const build = (source, options = {}) => buildHomeDashboard(source, { now, ...options });

test('empty and demo-only accounts have no fabricated academic statistics or exams', () => {
  for (const decks of [[], [deck({ fileType: 'demo' })]]) {
    const result = build(state({ decks, activityEvents: [quiz('seed-quiz', 20, [answer('q1', false)])] }));
    assert.equal(result.dueCount, 0); assert.deepEqual(result.weak, []); assert.deepEqual(result.mistakeIds, []);
    assert.deepEqual(result.activity, []); assert.equal(result.exam, null); assert.equal(result.recommendation.kind, 'materials');
  }
});
test('unreviewed new cards are not counted as scheduled reviews', () => assert.equal(build(state()).dueCount, 0));
test('standard reviews use the existing calendar interval and exclude future/seeded events', () => {
  const result = build(state({ decks: [deck({ flashcards: [
    { id: 'c1', confidence: 'learning', source: { sectionId: 'cells' } },
    { id: 'c2', confidence: 'known', source: { sectionId: 'cells' } },
  ] })], activityEvents: [review(26), review(27, { id: 'other', cardId: 'c2' }), review(29), review(25, { id: 'seed-review' })] }));
  assert.equal(result.dueCount, 1); assert.deepEqual(result.due[0].cardIds, ['c1']); assert.equal(result.recommendation.kind, 'due');
});
test('advanced schedules require recorded evidence and due dates, not confidence guesses', () => {
  const source = state({ retentionMode: 'fsrs', activityEvents: [review(26)] });
  assert.equal(build(source, { scheduleCard: () => ({ hasEvidence: false, dueAt: '2026-10-20T12:00:00Z' }) }).dueCount, 0);
  assert.equal(build(source, { scheduleCard: () => ({ hasEvidence: true, dueAt: '2026-10-29T12:00:00Z' }) }).dueCount, 0);
  assert.equal(build(source, { scheduleCard: () => ({ hasEvidence: true, dueAt: '2026-10-28T12:00:00Z' }) }).dueCount, 1);
});
test('a single miss or one repeatedly answered question cannot classify a topic as weak', () => {
  const result = build(state({ activityEvents: [quiz('one', 20, [answer('q1', false)]), quiz('two', 21, [answer('q1', false)])] }));
  assert.equal(result.weak.length, 0); assert.equal(result.mistakeIds.length, 1);
});
test('weak topics require three distinct questions, two sessions, and below 60% accuracy', () => {
  const result = build(state({ activityEvents: [quiz('one', 20, [answer('q1', false)]), quiz('two', 21, [answer('q2', false), answer('q3', true)])] }));
  assert.equal(result.weak.length, 1); assert.equal(result.weak[0].correct, 1); assert.equal(result.weak[0].total, 3);
  assert.equal(result.recommendation.kind, 'weak'); assert.equal(result.recommendation.sectionId, 'cells');
  const boundary = build(state({ activityEvents: [quiz('one', 20, [answer('q1', true), answer('q2', true), answer('q3', true)]), quiz('two', 21, [answer('q1', false), answer('q2', false)])] }));
  assert.equal(boundary.weak.length, 0);
});
test('one session with many failures is insufficient and unknown source topics are not guessed', () => {
  assert.equal(build(state({ activityEvents: [quiz('one', 20, [answer('q1', false), answer('q2', false), answer('q3', false)])] })).weak.length, 0);
  assert.equal(build(state({ activityEvents: [quiz('one', 20, [answer('q1', false, { sourceSectionId: 'unknown' })]), quiz('two', 21, [answer('q2', false, { sourceSectionId: 'unknown' }), answer('q3', false, { sourceSectionId: 'unknown' })])] })).weak.length, 0);
});
test('duplicate events and duplicate answer rows are counted once, with answer-level attribution', () => {
  const event = quiz('same', 20, [answer('q1', true, { sourceDeckId: 'bio' }), answer('q1', true, { sourceDeckId: 'bio' })], { deckId: 'deleted' });
  const result = build(state({ activityEvents: [event, event] }));
  assert.deepEqual(result.accuracy, { correct: 1, total: 1, sessions: 1 });
  assert.equal(result.activity.length, 1);
});
test('a correct retry resolves a repeated mistake and earns a factual recovery message', () => {
  const result = build(state({ activityEvents: [quiz('one', 20, [answer('q1', false)]), quiz('two', 21, [answer('q1', false)]), quiz('three', 22, [answer('q1', true), answer('q1', true)])] }));
  assert.deepEqual(result.mistakeIds, []); assert.equal(result.activity[0].recovered, 1);
  assert.equal(result.activity[0].detail, '1 of 1 answers correct');
});
test('origin IDs join repeated generated question variants without double counting', () => {
  const result = build(state({ activityEvents: [quiz('one', 20, [answer('variant1', false, { originQuestionId: 'q1' })]), quiz('two', 21, [answer('variant2', false, { originQuestionId: 'q1' })])] }));
  assert.deepEqual(result.mistakeIds, ['bio:q1']); assert.equal(result.recommendation.kind, 'mistakes');
});
test('recommendations follow resume, mistakes, due, weak, exam, practice, materials', () => {
  const source = state({ activityEvents: [review(20), quiz('one', 20, [answer('q1', false)]), quiz('two', 21, [answer('q1', false)])], plan: plan({ exam: { date: '2026-10-30' } }) });
  assert.equal(build(source, { resumeDeckId: 'bio' }).recommendation.kind, 'resume');
  assert.equal(build(source).recommendation.kind, 'mistakes');
  assert.equal(build(state({ activityEvents: [review(20)] })).recommendation.kind, 'due');
  assert.equal(build(state({ plan: plan({ exam: { date: '2026-10-30' } }) })).recommendation.kind, 'exam');
  assert.equal(build(state()).recommendation.kind, 'practice');
  assert.equal(build(state({ decks: [] })).recommendation.kind, 'materials');
});
test('only explicit, valid, nonpast user exams appear; progress uses completed task counts', () => {
  const result = build(state({ plan: plan({ exam: { date: '2026-10-30', title: 'Midterm' }, days: [{ blocks: [{ complete: true, minutes: 100 }, { complete: false, minutes: 1 }] }, { blocks: [{ complete: false, minutes: 1 }] }] }) }));
  assert.equal(result.exam.daysRemaining, 2); assert.equal(result.exam.progress, 33); assert.equal(result.exam.completed, 1); assert.equal(result.exam.total, 3);
  assert.equal(build(state({ plan: plan({ exam: { date: '2026-10-30' } }) })).exam.progress, null);
  for (const date of ['2026-02-30', '2026-10-27', 'bad-date']) assert.equal(build(state({ plan: plan({ exam: { date } }) })).exam, null);
});
test('exam countdown uses local calendar days, including today and DST boundaries', () => {
  assert.equal(examCalendarDays('2026-10-28', new Date(2026, 9, 28, 23, 59)), 0);
  assert.equal(examCalendarDays('2026-11-02', new Date(2026, 9, 31, 23, 30)), 2);
  assert.equal(examCalendarDays('2028-02-29', new Date(2028, 1, 28)), 1);
});
test('an exam recommendation cannot select an unrelated class', () => {
  const result = build(state({ decks: [deck({ id: 'other', courseId: 'other' }), deck({ flashcards: [], notes: [{ id: 'note' }] })], plan: plan({ exam: { date: '2026-10-30' } }) }));
  assert.equal(result.recommendation.deckId, 'bio');
});
test('deleted packs, skipped answers, future records, malformed dates and seed fixtures stay out of recent activity', () => {
  const result = build(state({ activityEvents: [quiz('deleted', 20, [answer('q1', true)], { deckId: 'gone' }), quiz('skip', 20, [answer('q1', false, { skipped: true })]), quiz('future', 29, [answer('q1', true)]), quiz('invalid', 20, [answer('q1', true)], { occurredAt: 'bad' }), quiz('seed-example', 20, [answer('q1', true)])] }));
  assert.deepEqual(result.activity, []); assert.equal(result.accuracy.total, 0);
});
test('selectors do not mutate persisted source state', () => {
  const source = state({ activityEvents: [review(25), quiz('one', 20, [answer('q1', false)]), quiz('two', 21, [answer('q1', true)])] });
  const before = structuredClone(source); build(source); assert.deepEqual(source, before);
});
test('adaptive estimates match the existing default eight-prompt study setup, including its five-minute minimum', () => {
  assert.equal(build(state({ decks: [deck({ flashcards: Array.from({ length: 20 }, (_, i) => ({ id: `card${i}`, confidence: 'new', source: { sectionId: 'cells' } })) })] })).recommendation.minutes, 11);
  assert.equal(build(state({ decks: [deck({ flashcards: [{ id: 'only', confidence: 'new', source: { sectionId: 'cells' } }] })] })).recommendation.minutes, 5);
});
