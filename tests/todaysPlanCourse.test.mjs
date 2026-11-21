import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { buildLearningMastery } from '../src/services/learningMastery.ts';

const hook = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.endsWith('.ts') && specifier.startsWith('.') && !/\.\w+$/.test(specifier)) {
      return nextResolve(specifier + '.ts', context);
    }
    return nextResolve(specifier, context);
  },
});
const { todaysPlanCourse } = await import('../src/components/todaysPlanPresentation.ts');
hook.deregister();

const now = new Date('2026-11-13T12:00:00Z');
const before = (days) => new Date(+now - days * 86400000).toISOString();
const course = (id) => ({ id, name: 'Biology', color: '#39BFA3', createdAt: before(7) });
const pack = (id, courseId, overrides = {}) => ({
  id, courseId, courseName: 'Biology', title: id, fileType: 'pptx', fileName: id + '.pptx',
  createdAt: before(7), flashcards: [{ id: 'card', confidence: 'new', source: { sectionId: 'section' } }],
  outline: [{ id: 'section', title: 'Cells' }], notes: [{ id: 'note' }], detailedNotes: [],
  quiz: ['q1', 'q2', 'q3'].map(question => ({ id: question, source: { sectionId: 'section' } })),
  ...overrides,
});
const attempt = (id, deckId, days, answers) => ({
  id, type: 'quiz', deckId, occurredAt: before(days),
  quizAnswers: answers.map(([questionId, correct]) => ({ questionId, correct, sourceSectionId: 'section' })),
});
const state = (classes = [], decks = [], activityEvents = []) => ({
  classes, decks, activityEvents, retentionMode: 'standard', plan: { days: [], scope: { type: 'all' } },
});
const plans = source => buildLearningMastery(source, now).map(group => ({ group, ...todaysPlanCourse(source, group, now) }));

test('demo-only material retains the empty plan and a real empty class gets its own add-material page', () => {
  const sample = pack('sample', 'sample-class', { fileType: 'demo' });
  assert.equal(plans(state([course('sample-class')], [sample]))[0].group.kind, 'overview');
  const [empty] = plans(state([course('empty')], [sample]));
  assert.equal(empty.group.id, 'class:empty');
  assert.equal(empty.materialCount, 0);
  assert.deepEqual(empty.primary.action, { kind: 'materials' });
  assert.deepEqual(empty.tasks, []);
});

test('a new upload updates only its class, counts real sources, and starts with notes without a readiness score', () => {
  const one = pack('One', 'a', { sourceFileNames: ['a.pptx', 'b.pptx', 'b.pptx'] });
  const source = state([course('a'), course('b')], [one]);
  const before = structuredClone(source);
  const [first, second] = plans(source);
  assert.equal(first.materialCount, 2);
  assert.equal(first.group.mastery, null);
  assert.equal(first.primary.action.tool, 'notes');
  assert.deepEqual(first.tasks.map(task => task.action.tool), ['flashcards', 'quiz']);
  assert.ok(first.tasks.every(task => task.action.deck.id === 'One'));
  assert.equal(second.materialCount, 0);
  assert.equal(second.primary.action.kind, 'materials');
  assert.deepEqual(source, before);
});

test('class-targeted review uses real evidence and keeps repeated mistakes separate between classes of the same name', () => {
  const first = pack('One', 'a');
  const second = pack('Two', 'b');
  const [a, b] = plans(state([course('a'), course('b')], [first, second], [
    attempt('weak-a', 'One', 3, [['q1', false], ['q2', false]]),
    attempt('weak-b', 'One', 1, [['q1', false], ['q3', true]]),
    attempt('miss-a', 'Two', 3, [['q3', false]]),
    attempt('miss-b', 'Two', 1, [['q3', false]]),
  ]));
  assert.equal(a.primary.action.kind, 'smart');
  assert.equal(a.primary.action.deck.id, 'One');
  assert.equal(a.primary.action.sectionId, 'section');
  assert.deepEqual(a.tasks[0].action, { kind: 'mistakes', itemIds: ['One:q1'] });
  assert.deepEqual(b.primary.action, { kind: 'mistakes', itemIds: ['Two:q3'] });
  assert.ok(b.tasks.every(task => task.action.deck.id === 'Two'));
});

test('reviewed notes lead to recall practice without counting as an assessment', () => {
  const deck = pack('One', 'a', { reviewedNoteIds: ['note'] });
  const [plan] = plans(state([course('a')], [deck]));
  assert.equal(plan.primary.action.tool, 'flashcards');
  assert.equal(plan.group.mastery, null);
  assert.ok(plan.tasks.some(task => task.action.tool === 'quiz'));
});

test('queued tools never launch, while a ready quiz can be the first study action', () => {
  const deck = (status) => pack('One', 'a', { generation: {
    materials: Object.fromEntries(['quiz', 'flashcards', 'simpleNotes', 'detailedNotes', 'audio', 'keyConcepts']
      .map(tool => [tool, { status: tool === 'quiz' ? status : 'queued' }])),
  } });
  const [quiz] = plans(state([course('a')], [deck('ready')]));
  assert.equal(quiz.primary.action.tool, 'quiz');
  assert.deepEqual(quiz.tasks, []);
  const [pending] = plans(state([course('a')], [deck('failed')]));
  assert.equal(pending.primary.action.kind, 'deck');
  assert.equal(pending.primary.action.tool, undefined);
  assert.match(pending.primary.reason, /retry|another try/i);
  assert.deepEqual(pending.tasks, []);
});

test('existing readiness evidence unlocks the score only for the class that produced it', () => {
  const first = pack('One', 'a', { flashcards: [], quiz: pack('One', 'a').quiz.slice(0, 2) });
  const second = pack('Two', 'b');
  const answers = [['q1', true], ['q2', true]];
  const [a, b] = plans(state([course('a'), course('b')], [first, second], [
    attempt('session-one', 'One', 4, answers),
    attempt('session-two', 'One', 1, answers),
  ]));
  assert.equal(a.group.mastery, 100);
  assert.equal(a.group.quizAccuracy, 100);
  assert.equal(b.group.mastery, null);
  assert.equal(b.group.quizAccuracy, null);
});

test('an imminent exam uses a ready pack in its saved scope even when another class has review evidence', () => {
  const biology = pack('Biology review', 'a');
  const chemistry = pack('Chemistry review', 'b');
  const source = state([course('a'), course('b')], [biology, chemistry], [
    attempt('miss1', biology.id, 3, [['q1', false]]),
    attempt('miss2', biology.id, 1, [['q1', false]]),
  ]);
  source.plan = { scope: { type: 'course', id: 'b' }, days: [], exam: { title: 'Chemistry midterm', date: '2026-11-14' } };
  const localNow = new Date(2026, 10, 13, 12);
  const groups = buildLearningMastery(source, localNow);
  const plan = todaysPlanCourse(source, { packs: groups.flatMap(group => group.packs), practicedPacks: 1, nextPractice: null }, localNow);
  assert.equal(plan.primary.action.deck.id, chemistry.id);
  assert.equal(plan.primary.title, 'Prepare for Chemistry midterm');
  assert.equal(plan.examLabel, 'Exam tomorrow');
});

test('today’s plan skips completed, unavailable, and out-of-scope tasks', () => {
  const source = state([course('a'), course('b')], [pack('One', 'a'), pack('Two', 'b')]);
  source.plan = { scope: { type: 'deck', id: 'Two' }, days: [{
    date: now.toISOString(),
    blocks: [
      { modality: 'notes', label: 'Read key notes', complete: true },
      { modality: 'audio', label: 'Listen to a summary', complete: false },
      { modality: 'quiz', label: 'Practice chapter quiz', complete: false },
    ],
  }] };
  // Generation still gates an audio tab, even if cards are already ready.
  source.decks[1].generation = { materials: { audio: { status: 'queued' }, quiz: { status: 'ready' }, flashcards: { status: 'ready' } } };
  const [a, b] = plans(source);
  assert.equal(a.primary.action.tool, 'notes');
  assert.equal(b.primary.action.deck.id, 'Two');
  assert.equal(b.primary.action.tool, 'quiz');
  assert.equal(b.primary.title, 'Practice chapter quiz');
});
