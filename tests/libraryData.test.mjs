import assert from 'node:assert/strict';
import test from 'node:test';

import { copyGuestLibrary, guestPacksToSave, hasLibraryContentChanges, localLibraryItems, markLibraryEdit, mergeLibraryItems } from '../src/services/libraryData.ts';

const createdAt = '2026-01-01T10:00:00Z';
const course = { id: 'course', name: 'Biology', color: '#111111', createdAt, emoji: '🧪' };
const pack = {
  id: 'personal', courseId: course.id, courseName: course.name, createdAt, title: 'Cell Structure', fileType: 'pptx',
  originalUri: 'file:///private/device-only', flashcards: [{ id: 'card-1', front: 'Test', confidence: 'known' }],
  visuals: [{ imagePath: 'owner/image.png', imageUrl: 'https://example.test/signed', imageDataUrl: 'data:image/png;base64,AAAA' }],
  quizAttempts: [88], reviewedNoteIds: ['one'], studyMinutes: 2, audioPosition: 4,
};
const state = (decks = [], classes = []) => ({ decks, classes });

test('guest save copies only personal packs and does not duplicate an existing account pack', () => {
  const guest = state([pack, { ...pack, id: 'sample', fileType: 'demo' }], [course]);
  const copied = copyGuestLibrary(state(), guest);
  assert.deepEqual(copied.decks.map(item => item.id), ['personal']);
  assert.deepEqual(copied.classes.map(item => item.id), ['course']);
  assert.equal(guest.decks.length, 2);
  assert.equal(guestPacksToSave(guest, copied).length, 0);
  assert.deepEqual(copied.decks[0].flashcards, pack.flashcards);
  assert.deepEqual(copied.decks[0].visuals, pack.visuals);
  assert.equal(copyGuestLibrary(copied, guest), copied);
});

test('account conversion keeps empty guest-created courses and excludes demo-only courses', () => {
  const emptyCourse = { ...course, id: 'empty-course', name: 'Chemistry' };
  const demoCourse = { ...course, id: 'demo-course', name: 'Sample Biology' };
  const guest = state([
    { ...pack, id: 'sample', fileType: 'demo', courseId: demoCourse.id },
  ], [emptyCourse, demoCourse]);
  const converted = copyGuestLibrary(state(), guest);
  assert.deepEqual(converted.decks, []);
  assert.deepEqual(converted.classes.map(item => item.id), ['empty-course']);
});

test('sync projects portable content and excludes device progress, samples and pending jobs', () => {
  const unfinished = { ...pack, id: 'unfinished', generation: { materials: { quiz: { status: 'queued' } } } };
  const items = localLibraryItems(state([pack, unfinished, { ...pack, id: 'sample', fileType: 'demo' }], [course]), new Set());
  assert.deepEqual(items.map(item => item.item_id), ['course', 'personal']);
  const payload = items[1].content;
  assert.equal(payload.originalUri, undefined);
  assert.equal(payload.flashcards[0].confidence, 'new');
  assert.equal(payload.visuals[0].imageUrl, undefined);
  assert.equal(payload.visuals[0].imagePath, 'owner/image.png');
  assert.equal(payload.visuals[0].imageDataUrl, 'data:image/png;base64,AAAA');
  assert.deepEqual(payload.quizAttempts, []);
});

test('merges newer cloud edits while preserving local progress and unrelated packs', () => {
  const local = state([pack, { ...pack, id: 'local-only' }], [course]);
  const edited = markLibraryEdit({ ...pack, title: 'Cells and Tissues' }, Date.parse('2026-01-02T10:00:00Z'));
  const cloud = localLibraryItems(state([edited]), new Set());
  const merged = mergeLibraryItems(local, cloud);
  assert.equal(merged.decks[0].title, 'Cells and Tissues');
  assert.equal(merged.decks[0].originalUri, pack.originalUri);
  assert.equal(merged.decks[0].flashcards[0].confidence, 'known');
  assert.deepEqual(merged.decks[1], local.decks[1]);
  assert.equal(mergeLibraryItems(merged, cloud), merged);
  assert.equal(hasLibraryContentChanges(pack, { ...pack, audioPosition: 30 }), false);
  assert.equal(hasLibraryContentChanges(pack, { ...pack, flashcards: [{ ...pack.flashcards[0], confidence: 'new' }] }), false);
  assert.equal(hasLibraryContentChanges(pack, edited), true);
});
