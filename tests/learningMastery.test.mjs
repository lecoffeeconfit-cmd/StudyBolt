import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLearningMastery } from '../src/services/learningMastery.ts';

const now = new Date('2026-11-07T15:00:00Z');
const course = (id = 'biology', name = 'Biology') => ({ id, name });
const pack = (id = 'one', courseId = 'biology', overrides = {}) => ({
  id, courseId, title: `Pack ${id}`, courseName: 'Biology', fileName: `${id}.pptx`, fileType: 'pptx',
  outline: [{ id: 'topic', title: 'Cell structure' }],
  quiz: ['q1', 'q2'].map((id) => ({ id, source: { sectionId: 'topic' } })), flashcards: [],
  quizAttempts: [], reviewedNoteIds: [], notes: [], ...overrides,
});
const state = (decks = [pack()], events = [], classes = [course()]) => ({ classes, decks, activityEvents: events });
const answer = (questionId = 'q1', overrides = {}) => ({ questionId, sourceSectionId: 'topic', correct: true, ...overrides });
const quiz = (id, date, answers = [answer('q1'), answer('q2')], overrides = {}) => ({
  id, type: 'quiz', deckId: 'one', occurredAt: date, quizAnswers: answers, ...overrides,
});
const spaced = (overrides = {}) => [
  quiz('day-one', '2026-11-04T12:00:00Z', undefined, overrides),
  quiz('day-two', '2026-11-06T12:00:00Z', undefined, overrides),
];
const hero = (source) => buildLearningMastery(source, now)[0];

test('course counts deduplicate a multi-pack quiz without borrowing another course’s activity', () => {
  const source = state([pack(), pack('two'), pack('other', 'other-class')], [
    quiz('shared-run', '2026-11-06T12:00:00Z', [answer('q1', { sourceDeckId: 'one' }), answer('q1', { sourceDeckId: 'two' })], { sourceDeckIds: ['one', 'two'] }),
    quiz('shared-run', '2026-11-06T12:00:00Z'),
    quiz('other-run', '2026-11-06T12:00:00Z', undefined, { deckId: 'other' }),
    quiz('future', '2030-01-01T00:00:00Z'),
  ], [course(), course('other-class', 'Biology')]);
  const groups = buildLearningMastery(source, now);
  assert.equal(groups[0].completedQuizzes, 1);
  assert.equal(groups[1].completedQuizzes, 1);
  assert.equal(groups[0].packs.length, 2);
  assert.equal(groups[0].nextPractice.deckId, 'one');
  assert.equal(groups[1].nextPractice.deckId, 'other');
});

test('a real missed topic opens only its source flashcards through the existing review tool', () => {
  const sourcePack = pack('one', 'biology', {
    flashcards: [
      { id: 'target-card', source: { sectionId: 'topic' } },
      { id: 'other-card', source: { sectionId: 'other-topic' } },
    ],
    outline: [{ id: 'topic', title: 'Cell structure' }, { id: 'other-topic', title: 'Transport' }],
  });
  const group = hero(state([sourcePack], [quiz('miss', '2026-11-06T12:00:00Z', [answer('q1', { correct: false })])]));
  assert.deepEqual(group.nextPractice, {
    deckId: 'one', tool: 'flashcards', cardIds: ['target-card'], label: 'Review this topic',
    reason: 'Revisit Cell structure from Pack one.',
  });
  assert.equal(group.focusTopics[0].packId, 'one');
  assert.equal(group.flashcards, 2);
});

test('practice actions honor material readiness and never treat reading duration as recall', () => {
  const materials = Object.fromEntries(['quiz', 'flashcards', 'simpleNotes', 'detailedNotes'].map(key => [key, { status: 'pending' }]));
  const processing = pack('one', 'biology', { generation: { materials }, notes: [{ id: 'note' }] });
  const reading = { id: 'reading', type: 'note-reading', deckId: 'one', occurredAt: '2026-11-06T12:00:00Z', durationMinutes: 90 };
  const pending = hero(state([processing], [reading]));
  assert.equal(pending.nextPractice, null);
  assert.equal(pending.mastery, null);
  assert.equal(pending.completedQuizzes, 0);
  assert.equal(pending.materialPracticed, 0);
  assert.deepEqual(pending.practicedTopicIds, []);
  materials.quiz.status = 'failed';
  assert.equal(hero(state([processing])).failedPacks, 1);
  assert.match(hero(state([processing])).explanation, /check or retry/);
  materials.simpleNotes.status = 'ready';
  assert.equal(hero(state([processing], [reading])).nextPractice.tool, 'notes');
  materials.quiz.status = 'ready';
  assert.equal(hero(state([processing], [reading])).nextPractice.tool, 'quiz');
});

test('empty classes, no classes and upload-only states remain honestly unassessed', () => {
  const empty = hero(state([], [], []));
  assert.equal(empty.name, 'Your study materials');
  assert.equal(empty.mastery, null);
  assert.equal(empty.materialPracticed, null);
  assert.equal(empty.quizAccuracy, null);
  assert.equal(hero(state([])).kind, 'class');
  const uploaded = hero(state([pack('one', 'biology', { quizAttempts: [100, 100], reviewedNoteIds: ['all'], studyMinutes: 500 })]));
  assert.equal(uploaded.mastery, null);
  assert.equal(uploaded.materialPracticed, 0);
  assert.deepEqual(uploaded.focusTopics, []);
});

test('classes are isolated by stable ID even when display names match', () => {
  const groups = buildLearningMastery(state([pack(), pack('two', 'chemistry')], [quiz('a', '2026-11-06T12:00:00Z')], [course(), course('chemistry', 'Biology')]), now);
  assert.notEqual(groups[0].id, groups[1].id);
  assert.equal(groups[0].quizAccuracy, 100);
  assert.equal(groups[1].quizAccuracy, null);
  assert.equal(groups[1].materialPracticed, 0);
});

test('unassociated uploads use an overview; real empty classes remain visible', () => {
  const overview = hero(state([pack('one', 'missing')], [], []));
  assert.equal(overview.kind, 'overview');
  assert.equal(overview.name, 'All study materials');
  const groups = buildLearningMastery(state([pack('one', 'missing')]), now);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].packs.length, 0);
  assert.equal(groups[1].name, 'Unassigned materials');
});

test('bundled examples and seeded history cannot become personal evidence', () => {
  const source = state([pack(), pack('sample', 'sample-class', { fileType: 'demo' })], [
    ...spaced().map((event) => ({ ...event, id: `seed-${event.id}` })),
    quiz('sample', '2026-11-06T12:00:00Z', undefined, { deckId: 'sample' }),
  ], [course(), course('sample-class')]);
  const groups = buildLearningMastery(source, now);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].quizAccuracy, null);
  assert.equal(groups[0].materialPracticed, 0);
});

test('one perfect quiz, same-day retries and a single repeated question do not unlock mastery', () => {
  const firstDay = quiz('one', '2026-11-06T12:00:00Z');
  const later = { ...firstDay, id: 'retry', occurredAt: '2026-11-06T18:00:00Z' };
  assert.equal(hero(state([pack()], [firstDay, later])).mastery, null);
  const singleItem = pack('one', 'biology', { quiz: [pack().quiz[0]] });
  assert.equal(hero(state([singleItem], spaced())).mastery, null);
});

test('complete varied spaced evidence unlocks the transparent topic share', () => {
  const result = hero(state([pack()], spaced()));
  assert.equal(result.mastery, 100);
  assert.equal(result.assessedTopics, 1);
  assert.equal(result.supportedTopics, 1);
  assert.equal(result.materialPracticed, 100);
  assert.equal(result.quizQuestions, 2);
});

test('weak latest responses lower supported recall while quiz accuracy stays first-attempt based', () => {
  const events = [...spaced(), quiz('miss', '2026-11-07T12:00:00Z', [answer('q1', { correct: false })])];
  const result = hero(state([pack()], events));
  assert.equal(result.mastery, 0);
  assert.equal(result.quizAccuracy, 100);
  assert.equal(result.focusTopics[0].title, 'Cell structure');
  assert.equal(result.focusTopics[0].packTitle, 'Pack one');
});

test('retakes and variants share their source identity and same-day corrections cannot hide a miss', () => {
  const events = [quiz('miss', '2026-11-04T09:00:00Z', [answer('q1', { correct: false }), answer('q2')]),
    quiz('retry', '2026-11-04T10:00:00Z', [answer('variant', { originQuestionId: 'q1' })]),
    quiz('next-day', '2026-11-06T12:00:00Z')];
  const result = hero(state([pack()], events));
  assert.equal(result.quizQuestions, 2);
  assert.equal(result.quizAccuracy, 50);
  assert.equal(result.mastery, 0);
});

test('small practiced subsets and missing topic mappings cannot imply class mastery', () => {
  const result = hero(state([pack(), pack('two')], spaced()));
  assert.equal(result.materialPracticed, 50);
  assert.equal(result.mastery, null);
  const incomplete = pack('one', 'biology', { outline: [...pack().outline, { id: 'unmapped', title: 'Unmapped topic' }] });
  assert.equal(hero(state([incomplete], spaced())).mastery, null);
  assert.equal(hero(state([pack('one', 'biology', { outline: [] })], spaced())).topicCount, 0);
});

test('partial generation keeps recorded practice but hides a class estimate', () => {
  const partial = pack('one', 'biology', { generation: { materials: { quiz: { status: 'ready' }, flashcards: { status: 'failed' } } } });
  const result = hero(state([partial], spaced()));
  assert.equal(result.pendingPacks, 1);
  assert.equal(result.materialPracticed, 100);
  assert.equal(result.mastery, null);
});

test('deleted, future, invalid and ambiguous multi-pack evidence is ignored', () => {
  const events = [quiz('deleted', '2026-11-06T12:00:00Z', undefined, { deckId: 'deleted' }),
    quiz('future', '2026-11-08T12:00:00Z'), quiz('invalid', 'not-a-date'),
    quiz('ambiguous', '2026-11-06T12:00:00Z', undefined, { sourceDeckIds: ['one', 'two'] }),
    quiz('future-answer', '2026-11-06T12:00:00Z', [answer('q1', { answeredAt: '2026-11-08T12:00:00Z' })])];
  const result = hero(state([pack()], events));
  assert.equal(result.quizAccuracy, null);
  assert.equal(result.materialPracticed, 0);
});

test('mixed-class quiz answers are attributed individually and duplicate event records do not multiply them', () => {
  const event = quiz('mixed', '2026-11-06T12:00:00Z', [answer('q1', { sourceDeckId: 'one', correct: true }), answer('q1', { sourceDeckId: 'two', correct: false })], { sourceDeckIds: ['one', 'two'] });
  const groups = buildLearningMastery(state([pack(), pack('two', 'chemistry')], [event, event], [course(), course('chemistry')]), now);
  assert.equal(groups[0].quizAccuracy, 100);
  assert.equal(groups[1].quizAccuracy, 0);
  assert.equal(groups[0].quizQuestions, 1);
  assert.equal(groups[1].quizQuestions, 1);
});

test('flashcard recall ratings support evidence; known-confidence flags alone do not', () => {
  const cards = ['c1', 'c2'].map((id) => ({ id, confidence: 'known', source: { sectionId: 'topic' } }));
  const deck = pack('one', 'biology', { quiz: [], flashcards: cards });
  const reviews = ['2026-11-04T12:00:00Z', '2026-11-06T12:00:00Z'].flatMap((date, day) => cards.map((card) => ({ id: `${day}-${card.id}`, type: 'flashcard-review', deckId: 'one', cardId: card.id, occurredAt: date, confidence: 'known', reviewRating: 'good' })));
  assert.equal(hero(state([deck], reviews)).mastery, 100);
  assert.equal(hero(state([deck], reviews.map(({ reviewRating, ...event }) => event))).mastery, null);
  const failed = [...reviews, { ...reviews[0], id: 'latest', occurredAt: '2026-11-07T12:00:00Z', reviewRating: 'again' }];
  assert.equal(hero(state([deck], failed)).focusTopics.length, 1);
});

test('old recall becomes unassessed while historical first-answer accuracy remains available', () => {
  const events = [quiz('old-one', '2026-09-01T12:00:00Z'), quiz('old-two', '2026-09-03T12:00:00Z')];
  const result = hero(state([pack()], events));
  assert.equal(result.mastery, null);
  assert.equal(result.quizAccuracy, 100);
  assert.equal(result.materialPracticed, 100);
});

test('material counts honor combined source filenames, and the projection never mutates stored data', () => {
  const source = state([pack('one', 'biology', { sourceFileNames: ['a.pptx', 'b.pptx', 'a.pptx'] }), pack('pdf', 'biology', { fileType: 'pdf', fileName: 'lecture.pdf' }), pack('notes', 'biology', { fileType: 'notes' })], spaced());
  const before = structuredClone(source);
  const result = hero(source);
  assert.equal(result.powerpoints, 2);
  assert.equal(result.pdfs, 1);
  assert.equal(result.noteSets, 1);
  assert.deepEqual(source, before);
});

test('mastery is the unweighted supported-topic share only after complete topic coverage', () => {
  const deck = pack('one', 'biology', {
    outline: [...pack().outline, { id: 'second', title: 'Membranes' }],
    quiz: [...pack().quiz, ...['q3', 'q4'].map((id) => ({ id, source: { sectionId: 'second' } }))],
  });
  const answers = [answer('q1'), answer('q2'), answer('q3', { sourceSectionId: 'second' }), answer('q4', { sourceSectionId: 'second', correct: false })];
  const result = hero(state([deck], [quiz('one', '2026-11-04T12:00:00Z', answers), quiz('two', '2026-11-06T12:00:00Z', answers)]));
  assert.equal(result.assessedTopics, 2);
  assert.equal(result.supportedTopics, 1);
  assert.equal(result.mastery, 50);
  assert.equal(result.focusTopics[0].title, 'Membranes');
});

test('an unpracticed current item cannot disappear from a topic’s assessment denominator', () => {
  const deck = pack('one', 'biology', { flashcards: [{ id: 'unreviewed', confidence: 'known', source: { sectionId: 'topic' } }] });
  assert.equal(hero(state([deck], spaced())).mastery, null);
});

test('at least a 24-hour interval is required, and an inconsistent source section fails safely', () => {
  const early = [quiz('one', '2026-11-05T13:00:00Z'), quiz('two', '2026-11-06T12:00:00Z')];
  assert.equal(hero(state([pack()], early)).mastery, null);
  const exact = [quiz('one', '2026-11-05T12:00:00Z'), early[1]];
  assert.equal(hero(state([pack()], exact)).mastery, 100);
  const mismatch = [...spaced(), quiz('bad-section', '2026-11-07T12:00:00Z', [answer('q1', { sourceSectionId: 'other' })])];
  assert.equal(hero(state([pack()], mismatch)).mastery, null);
});

test('skipped and partial-credit answers are not represented as fully correct answers', () => {
  const result = hero(state([pack()], [quiz('partial', '2026-11-06T12:00:00Z', [answer('q1', { skipped: true }), answer('q2', { partialCredit: 0.5 })])]));
  assert.equal(result.quizAccuracy, 0);
});
