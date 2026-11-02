import assert from 'node:assert/strict';
import test from 'node:test';

import { getHomeUploadStatus } from '../src/services/homeUpload.ts';

const tools = ['simpleNotes', 'flashcards', 'quiz', 'detailedNotes', 'keyConcepts', 'audio'];
const pack = (id, status = 'queued', overrides = {}) => ({
  id, fileType: 'pdf', title: id, createdAt: '2026-10-29T12:00:00Z',
  generation: { materials: Object.fromEntries(tools.map((name) => [name, { status, updatedAt: '2026-10-29T12:00:00Z' }])) },
  ...overrides,
});

test('empty, demo and legacy packs do not invent an upload or success state', () => {
  assert.equal(getHomeUploadStatus([], tools), null);
  assert.equal(getHomeUploadStatus([pack('sample', 'ready', { fileType: 'demo' })], tools), null);
  assert.equal(getHomeUploadStatus([pack('legacy', 'ready', { generation: undefined })], tools), null);
  assert.equal(getHomeUploadStatus([pack('empty-list')], []), null);
});

test('an extracted file with queued tools is creating, never ready', () => {
  const result = getHomeUploadStatus([pack('queued')], tools);
  assert.equal(result.kind, 'creating');
  assert.equal(result.ready, 0);
  assert.equal(result.pending, 6);
  assert.equal(result.total, 6);
});

test('partial generation reports the real ready count and still offers progress', () => {
  const deck = pack('partial', 'generating');
  deck.generation.materials.simpleNotes.status = 'ready';
  deck.generation.materials.flashcards.status = 'ready';
  const result = getHomeUploadStatus([deck], tools);
  assert.equal(result.kind, 'creating');
  assert.equal(result.ready, 2);
  assert.equal(result.pending, 4);
});

test('failures do not imply success even when some or all other tools are ready', () => {
  const deck = pack('failed-tool', 'ready');
  deck.generation.materials.quiz.status = 'failed';
  const result = getHomeUploadStatus([deck], tools);
  assert.equal(result.kind, 'attention');
  assert.equal(result.ready, 5);
  assert.equal(result.failed, 1);
  assert.equal(result.pending, 0);
  assert.equal(getHomeUploadStatus([pack('failed', 'failed')], tools).kind, 'attention');
});

test('mixed failed and active jobs retain both facts without saying complete', () => {
  const deck = pack('mixed');
  deck.generation.materials.simpleNotes.status = 'ready';
  deck.generation.materials.quiz.status = 'failed';
  const result = getHomeUploadStatus([deck], tools);
  assert.equal(result.kind, 'creating');
  assert.equal(result.ready, 1);
  assert.equal(result.failed, 1);
  assert.equal(result.pending, 4);
});

test('missing persisted tool status never becomes a complete pack', () => {
  const deck = pack('missing', 'ready');
  delete deck.generation.materials.audio;
  const result = getHomeUploadStatus([deck], tools);
  assert.equal(result.kind, 'attention');
  assert.equal(result.ready, 5);
  assert.equal(result.pending, 0);
  assert.equal(result.missing, 1);
});

test('success requires every expected tool to have a recorded ready state', () => {
  const result = getHomeUploadStatus([pack('complete', 'ready')], tools);
  assert.equal(result.kind, 'ready');
  assert.equal(result.ready, result.total);
  assert.equal(result.failed, 0);
  assert.equal(result.pending, 0);
});

test('active work then failures take precedence; ties use newest creation time', () => {
  const ready = pack('ready', 'ready', { createdAt: '2026-10-29T14:00:00Z' });
  const failed = pack('failure', 'failed');
  const older = pack('older', 'queued', { createdAt: '2026-10-29T10:00:00Z' });
  const newer = pack('newer', 'generating');
  assert.equal(getHomeUploadStatus([ready, failed, older, newer], tools).deck.id, 'newer');
  assert.equal(getHomeUploadStatus([ready, failed], tools).deck.id, 'failure');
});

test('selecting status leaves the saved packs and material records unchanged', () => {
  const decks = [pack('a', 'ready'), pack('b', 'queued')];
  const snapshot = structuredClone(decks);
  getHomeUploadStatus(decks, tools);
  assert.deepEqual(decks, snapshot);
});
