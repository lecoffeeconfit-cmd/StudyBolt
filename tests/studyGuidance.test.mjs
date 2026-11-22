import test from 'node:test';
import assert from 'node:assert/strict';
import { studyBoltLocalAccountKeys } from '../src/services/accountDeletionClient.ts';
import {
  autoGuideEligible, emptyGuideState, enrollGuidance, fitGuideSpotlight, guideFor,
  guideMetadataPatch, guideStateKey, GUIDES, guidanceIsIdle, mergeGuideProgress, parseGuideState,
  readRemoteGuideState, removeSyncedGuides,
} from '../src/services/studyGuidance.ts';

const seen = (status = 'completed', version = 1, seenAt = 100) => ({ version, status, seenAt });

test('existing accounts and guests get no starter popups; the new-account welcome precedes tours', () => {
  const state = emptyGuideState();
  const welcome = guideFor('welcome');
  const home = guideFor('home-basics');
  assert.equal(autoGuideEligible(welcome, state, 'home'), false);
  assert.equal(autoGuideEligible(home, state, 'home'), false);
  const enrolled = enrollGuidance(state, emptyGuideState(), 'new-account').account;
  assert.equal(autoGuideEligible(welcome, enrolled, 'home'), true);
  assert.equal(autoGuideEligible(welcome, enrolled, 'stats'), false);
  assert.equal(autoGuideEligible(home, enrolled, 'home'), false);
  assert.equal(autoGuideEligible(home, { ...enrolled, records: { welcome: seen() } }, 'home'), true);
});

test('skip stops the beginner sequence, while a completed page remains complete after relaunch', () => {
  const skipped = { ...emptyGuideState(), enrolled: true, records: { welcome: seen('skipped') } };
  const completed = { ...skipped, records: { welcome: seen(), 'stats-basics': seen('skipped') } };
  for (const guide of GUIDES.filter(item => item.kind !== 'update')) {
    assert.equal(autoGuideEligible(guide, skipped, guide.page), false);
  }
  assert.equal(autoGuideEligible(guideFor('stats-basics'), parseGuideState(JSON.stringify(completed)), 'stats'), false);
  assert.equal(autoGuideEligible(guideFor('planner-basics'), completed, 'planner'), true);
});

test('a changed feature may opt into a page-specific guide without replaying other tours', () => {
  const state = { ...emptyGuideState(), records: { 'planner-release': seen() } };
  const update = { ...guideFor('planner-basics'), id: 'planner-release', kind: 'update' };
  assert.equal(autoGuideEligible(update, state, 'planner'), false);
  assert.equal(autoGuideEligible({ ...update, version: 2 }, state, 'planner'), true);
  assert.equal(autoGuideEligible({ ...update, version: 2 }, state, 'home'), false);
  assert.equal(autoGuideEligible(guideFor('planner-basics'), state, 'planner'), false);
});

test('guest tutorial completions can be claimed by one new account and keys stay isolated', () => {
  const guest = { ...emptyGuideState(), records: { 'library-basics': seen() } };
  const first = enrollGuidance(emptyGuideState(), guest, 'first');
  const second = enrollGuidance(emptyGuideState(), first.guest, 'second');
  assert.equal(first.guest.guestClaim, 'first');
  assert.deepEqual(first.account.records, guest.records);
  assert.deepEqual(first.account.pending, guest.records);
  assert.deepEqual(second.account.records, {});
  assert.deepEqual(enrollGuidance(emptyGuideState(), first.guest, 'first').account.records, guest.records);
  const keys = [guideStateKey(), guideStateKey('first'), guideStateKey('second'), '@another-app/tutorial'];
  assert.deepEqual(studyBoltLocalAccountKeys(keys, 'first'), [guideStateKey('first')]);
});

test('metadata is additive per feature version and newer completions survive offline merges', () => {
  const old = { 'planner-basics': seen('skipped', 1, 520) };
  const latest = { 'planner-basics': seen('completed', 2, 200), 'stats-basics': seen() };
  const metadata = { display_name: 'Student', ...guideMetadataPatch(latest, true), ...guideMetadataPatch(old, false) };
  const remote = readRemoteGuideState(metadata);
  assert.equal(remote.enrolled, true);
  assert.deepEqual(remote.records, latest);
  assert.deepEqual(mergeGuideProgress(latest, old), latest);
  assert.deepEqual(removeSyncedGuides(latest, old), latest);
  assert.deepEqual(removeSyncedGuides(old, latest), {});
  assert.ok(!('display_name' in guideMetadataPatch(latest, true)));
  assert.deepEqual(parseGuideState('{broken'), emptyGuideState());
});

test('spotlight positions against safe bounds and falls back for clipped or tall content', () => {
  const area = { x: 8, y: 53, width: 304, height: 525 };
  const target = { x: 16, y: 130, width: 280, height: 44 };
  assert.equal(fitGuideSpotlight(target, area, 186)?.cardTop, 188);
  assert.equal(fitGuideSpotlight({ ...target, y: 470 }, area, 186)?.cardTop, 270);
  assert.equal(fitGuideSpotlight({ ...target, y: 35 }, area, 186), null);
  assert.equal(fitGuideSpotlight({ ...target, y: 560 }, area, 186), null);
  assert.equal(fitGuideSpotlight(target, area, 520), null);
  assert.equal(fitGuideSpotlight({ ...target, x: NaN }, area, 186), null);
  assert.equal(fitGuideSpotlight(null, area, 186), null);
});

test('guidance waits for input, active study and timer hydration to finish', () => {
  const idle = { busy: false, keyboard: false, foreground: true, timerKnown: true, focusUntil: 0 };
  assert.equal(guidanceIsIdle(idle, 100), true);
  for (const blocked of [{ busy: true }, { keyboard: true }, { foreground: false }, { timerKnown: false }, { focusUntil: 101 }]) {
    assert.equal(guidanceIsIdle({ ...idle, ...blocked }, 100), false);
  }
  assert.equal(guidanceIsIdle({ ...idle, focusUntil: 100 }, 100), true);
});
