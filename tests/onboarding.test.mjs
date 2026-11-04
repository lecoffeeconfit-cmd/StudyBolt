import assert from 'node:assert/strict';
import test from 'node:test';

import { findOnboardingSample, resolveOnboardingSample } from '../src/services/onboarding.ts';

const sample = { id: 'biology-cells', fileType: 'demo', flashcards: [{ id: 'card-1', front: 'A question', back: 'An answer' }] };

test('onboarding selects the actual Biology sample even when personal materials come first', () => {
  const personal = { id: 'my-lecture', fileType: 'pdf', flashcards: [{ id: 'personal-card' }] };
  assert.equal(findOnboardingSample([personal, sample]), sample);
});

test('a removed sample never falls back to personal material or another empty demo', () => {
  assert.equal(findOnboardingSample([{ id: 'my-lecture', fileType: 'pdf', flashcards: [{ id: 'card' }] }]), null);
  assert.equal(findOnboardingSample([{ ...sample, id: 'other-demo', flashcards: [] }]), null);
  assert.equal(findOnboardingSample([]), null);
});

test('a personal document reusing the sample ID cannot be presented as demo content', () => {
  assert.equal(findOnboardingSample([{ ...sample, fileType: 'pdf' }]), null);
});

test('empty samples are rejected and sample selection leaves saved content untouched', () => {
  assert.equal(findOnboardingSample([{ ...sample, flashcards: [] }]), null);
  const decks = structuredClone([sample]);
  const before = structuredClone(decks);
  findOnboardingSample(decks);
  assert.deepEqual(decks, before);
});

test('restoring a removed sample chooses a free ID and preserves personal materials', () => {
  const decks = [{ ...sample, fileType: 'pdf' }, { ...sample, id: 'biology-cells-onboarding-1', fileType: 'pdf' }];
  const before = structuredClone(decks);
  const restored = resolveOnboardingSample(decks, [sample]);
  assert.equal(restored.id, 'biology-cells-onboarding-2');
  assert.equal(restored.fileType, 'demo');
  assert.deepEqual(decks, before);
  assert.equal(resolveOnboardingSample([...decks, restored], [sample]), restored);
});

test('sample restoration reuses existing demos and handles an unavailable bundle honestly', () => {
  assert.equal(resolveOnboardingSample([sample], []), sample);
  assert.equal(resolveOnboardingSample([], []), null);
  const restored = resolveOnboardingSample([], [sample]);
  assert.equal(restored.id, sample.id);
});
