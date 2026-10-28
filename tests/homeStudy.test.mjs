import assert from 'node:assert/strict';
import test from 'node:test';
import { getImportDocumentType } from '../src/services/documentTypes.ts';
import { buildHomePracticeEvidence, findHomeAudioResume } from '../src/services/homeStudy.ts';

const deck = (overrides = {}) => ({ id: 'biology', title: 'Cells', courseName: 'Biology', outline: [{ id: 'division', title: 'Cell Division' }], audioSummary: 'one two three four five six seven eight', quickReview: '', audioPosition: 3, ...overrides });
const answer = (correct, overrides = {}) => ({ correct, sourceSectionId: 'division', ...overrides });
const quiz = (day, answers, overrides = {}) => ({ id: `quiz-${day}`, type: 'quiz', assessmentKind: 'practice', occurredAt: `2026-10-${String(day).padStart(2, '0')}T12:00:00Z`, deckId: 'biology', quizAnswers: answers, ...overrides });
const audio = (day, overrides = {}) => ({ id: `audio-${day}`, type: 'audio', occurredAt: `2026-10-${String(day).padStart(2, '0')}T12:00:00Z`, deckId: 'biology', audioMode: 'summary', completionPercent: 40, ...overrides });
const state = (events = [], decks = [deck()]) => ({ activityEvents: events, decks });

test('no recorded answers produces an honest empty state', () => {
  assert.deepEqual(buildHomePracticeEvidence(state()), { accuracy: null, correctAnswers: 0, totalAnswers: 0, quizCount: 0, focus: null });
});
test('accuracy uses answer-weighted results from the latest three completed practice records', () => {
  const result = buildHomePracticeEvidence(state([quiz(1, [answer(false)]), quiz(4, [answer(true), answer(false)]), quiz(2, [answer(true)]), quiz(3, [answer(true), answer(true), answer(false)])]));
  assert.equal(result.accuracy, 67);
  assert.equal(result.totalAnswers, 6);
  assert.equal(result.correctAnswers, 4);
  assert.equal(result.quizCount, 3);
  assert.equal(result.focus.topic, 'Cell Division');
  assert.equal(result.focus.missed, 2);
});
test('scores without answers, reading, exams, invalid dates, and seeded demo activity are excluded', () => {
  const result = buildHomePracticeEvidence(state([
    quiz(1, undefined, { quizScore: 99 }), quiz(2, [answer(true)], { assessmentKind: 'comprehensive' }),
    quiz(3, [answer(true)], { type: 'note-review' }), quiz(4, [answer(true)], { id: 'seed-example' }),
    quiz(5, [answer(true)], { occurredAt: 'invalid' }),
  ]));
  assert.equal(result.accuracy, null);
  assert.equal(result.quizCount, 0);
});
test('unknown topic titles do not produce a guessed recommendation', () => {
  const result = buildHomePracticeEvidence(state([quiz(1, [answer(false, { sourceSectionId: 'missing' })])]));
  assert.equal(result.accuracy, 0);
  assert.equal(result.focus, null);
});
test('all-correct practice has measured accuracy without a fabricated weak topic', () => {
  const result = buildHomePracticeEvidence(state([quiz(1, [answer(true)])]));
  assert.equal(result.accuracy, 100);
  assert.equal(result.focus, null);
});
test('deleted packs are ignored and answer-level pack attribution takes precedence', () => {
  const result = buildHomePracticeEvidence(state([quiz(2, [answer(false)], { deckId: 'deleted' }), quiz(1, [answer(true, { sourceDeckId: 'biology' })], { deckId: 'other' })]));
  assert.equal(result.accuracy, 100);
  assert.equal(result.quizCount, 1);
});
test('a partial Summary position can resume in the existing audio player', () => {
  assert.equal(findHomeAudioResume(state([audio(1)])).id, 'biology');
});
test('the latest Original playback cannot be misrepresented as a resumable Summary', () => {
  assert.equal(findHomeAudioResume(state([audio(1), audio(2, { audioMode: 'original' })])), null);
});
test('completed, seeded, deleted, and out-of-range positions do not create resume cards', () => {
  assert.equal(findHomeAudioResume(state([audio(1, { completionPercent: 100 })])), null);
  assert.equal(findHomeAudioResume(state([audio(1, { id: 'seed-audio' })])), null);
  assert.equal(findHomeAudioResume(state([audio(1, { deckId: 'deleted' })])), null);
  for (const audioPosition of [0, 8, 100, NaN, Infinity, -1]) {
    assert.equal(findHomeAudioResume(state([audio(1)], [deck({ audioPosition })])), null);
  }
});
test('selectors do not reorder or mutate application state', () => {
  const source = state([quiz(1, [answer(false)]), quiz(3, [answer(true)]), audio(2)]);
  const snapshot = structuredClone(source);
  buildHomePracticeEvidence(source);
  findHomeAudioResume(source);
  assert.deepEqual(source, snapshot);
});

test('the Import card labels correspond to the existing supported formats', () => {
  for (const extension of ['pdf', 'ppt', 'pptx', 'txt', 'md', 'markdown', 'rtf', 'doc', 'docx']) {
    assert.ok(getImportDocumentType(`class-material.${extension}`), extension);
  }
  assert.equal(getImportDocumentType('unsupported.exe'), null);
});
