import assert from 'node:assert/strict';
import test from 'node:test';
import { getTodaysPlanFocus, getTodaysPlanStatus } from '../src/services/todaysPlan.ts';

const deck = (id = 'bio', extra = {}) => ({ id, courseName: 'Biology', title: 'Cell structure', flashcards: Array.from({ length: 20 }, (_, i) => ({ id: `c${i}`, source: { sectionId: i < 3 ? 'cells' : 'other' } })), ...extra });
const dashboard = (kind, extra = {}) => ({ decks: [deck()], due: [], dueCount: 0, weak: [], mistakeIds: [], exam: null, recommendation: { kind, deckId: 'bio', title: 'Practice cell structure', why: '1 of 4 correct across 2 sessions.' }, ...extra });

test('due card describes the selected next set, not all remaining reviews or a completion percentage', () => {
  const result = getTodaysPlanFocus(dashboard('due', { dueCount: 16, recommendation: { kind: 'due', deckId: 'bio', cardIds: Array.from({ length: 10 }, (_, i) => `c${i}`) } }));
  assert.equal(result.count, 10);
  assert.equal(result.title, 'Review 10 due flashcards');
  assert.equal(result.countLabel, 'in this set');
  assert.equal(result.actionDetail, '10 cards');
  assert.equal(result.source, 'Biology · Cell structure');
});
test('focused practice counts only cards in the selected topic and retains its evidence', () => {
  const result = getTodaysPlanFocus(dashboard('weak', { recommendation: { kind: 'weak', deckId: 'bio', sectionId: 'cells', title: 'Practice cell structure', why: '1 of 4 correct across 2 sessions.' } }));
  assert.equal(result.count, 3);
  assert.equal(result.reason, '1 of 4 correct across 2 sessions.');
  assert.equal(result.actionDetail, '3 prompts');
});
test('practice uses the existing default eight-prompt setup, bounded by available cards', () => {
  assert.equal(getTodaysPlanFocus(dashboard('practice')).count, 8);
  assert.equal(getTodaysPlanFocus(dashboard('practice', { decks: [deck('bio', { flashcards: [deck().flashcards[0]] })] })).count, 1);
});
test('notes-only study never advertises prompts or a time it cannot provide', () => {
  const result = getTodaysPlanFocus(dashboard('practice', { decks: [deck('bio', { flashcards: [] })] }));
  assert.equal(result.count, null);
  assert.equal(result.medium, 'notes');
  assert.equal(result.actionLabel, 'Review notes');
  assert.equal(result.actionDetail, null);
});
test('empty state offers a real first step without fabricated progress', () => {
  const result = getTodaysPlanFocus(dashboard('materials', { decks: [] }));
  assert.equal(result.count, null);
  assert.equal(result.source, null);
  assert.equal(result.examLabel, null);
  assert.equal(result.medium, 'materials');
  assert.equal(result.actionLabel, 'Add course material');
});
test('mistake count is described as questions to revisit and sources exclude unrelated classes', () => {
  const result = getTodaysPlanFocus(dashboard('mistakes', { decks: [deck(), deck('math', { courseName: 'Math' }), deck('chem', { courseName: 'Chemistry' })], mistakeIds: ['bio:q1', 'math:q2'] }));
  assert.equal(result.count, 2);
  assert.equal(result.countLabel, 'to revisit');
  assert.equal(result.source, 'Biology · Math');
  assert.equal(result.actionDetail, '2 questions');
});
test('only an exam belonging to the recommended material appears in the next step', () => {
  const source = dashboard('exam', { exam: { deckIds: ['bio'], daysRemaining: 1 } });
  assert.equal(getTodaysPlanFocus(source).examLabel, 'Test tomorrow');
  source.exam.deckIds = ['unrelated'];
  assert.equal(getTodaysPlanFocus(source).examLabel, null);
});
test('audio resume shows a saved position instead of invented remaining prompts', () => {
  const result = getTodaysPlanFocus(dashboard('resume'));
  assert.equal(result.count, null);
  assert.equal(result.medium, 'audio');
  assert.equal(result.actionLabel, 'Resume StudyCast');
});
test('presentation leaves the saved dashboard unchanged', () => {
  const source = dashboard('practice');
  const before = structuredClone(source);
  getTodaysPlanFocus(source);
  assert.deepEqual(source, before);
});

test('only dated plan tasks can produce a completed-plan state; an empty denominator never does', () => {
  const today = { reviewedCards: 0, quizSessions: 0, correctAnswers: 0, totalAnswers: 0, completedAudio: 0, focusSessions: 0, planCompleted: 0, planTotal: 0, latestAt: null };
  assert.equal(getTodaysPlanStatus(dashboard('practice', { today })).complete, false);
  const complete = getTodaysPlanStatus(dashboard('practice', { today: { ...today, planCompleted: 2, planTotal: 2 } }));
  assert.equal(complete.complete, true);
  assert.equal(complete.detail, '2 of 2 plan tasks marked complete');
  assert.equal(getTodaysPlanStatus(dashboard('practice', { today: { ...today, reviewedCards: 4 } })).complete, false);
});

test('unavailable or generating tools never advertise practice prompts', () => {
  const result = getTodaysPlanFocus(dashboard('pack', { recommendation: { kind: 'pack', deckId: 'bio', title: 'Your study tools are taking shape', why: 'Open the pack to follow progress.' } }));
  assert.equal(result.medium, 'pack');
  assert.equal(result.count, null);
  assert.equal(result.actionLabel, 'View Study Pack');
  assert.equal(result.reason, 'Open the pack to follow progress.');
});
