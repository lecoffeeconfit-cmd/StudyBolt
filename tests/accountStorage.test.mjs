import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccountStateStorage, studyStateKey, LEGACY_STUDY_STATE_KEY } from '../src/services/accountStorage.ts';
import { studyBoltLocalAccountKeys } from '../src/services/accountDeletionClient.ts';

function fixture(entries = []) {
  const values = new Map(entries);
  const storage = {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); },
    removeItem: async (key) => { values.delete(key); },
  };
  return { values, storage, state: createAccountStateStorage(storage) };
}

test('account switches and guest access cannot read another saved library', async () => {
  const f = fixture();
  await f.state.write('private A', 'A');
  assert.equal(await f.state.read('B'), null);
  assert.equal(await f.state.read(), null);
  await f.state.write('private B', 'B');
  await f.state.write('guest');
  assert.equal(await f.state.read('A'), 'private A');
  assert.equal(await f.state.read('B'), 'private B');
  assert.equal(await f.state.read(), 'guest');
});

test('legacy library migrates exactly once without losing saved data', async () => {
  const f = fixture([[LEGACY_STUDY_STATE_KEY, 'existing library']]);
  assert.equal(await f.state.read('A'), 'existing library');
  assert.equal(await f.state.read('B'), null);
  assert.equal(await f.state.read(), null);
  assert.equal(f.values.get(studyStateKey('A')), 'existing library');
  assert.equal(f.values.has(LEGACY_STUDY_STATE_KEY), false);
});

test('concurrent migrations cannot give the legacy library to two users', async () => {
  const f = fixture([[LEGACY_STUDY_STATE_KEY, 'existing library']]);
  assert.deepEqual(await Promise.all([f.state.read('A'), f.state.read('B')]), ['existing library', null]);
});

test('failed migration preserves the original and can retry only for its owner', async () => {
  const f = fixture([[LEGACY_STUDY_STATE_KEY, 'existing library']]);
  const write = f.storage.setItem;
  f.storage.setItem = async (key, value) => {
    if (key === studyStateKey('A')) throw Error('storage full');
    return write(key, value);
  };
  await assert.rejects(f.state.read('A'));
  assert.equal(f.values.get(LEGACY_STUDY_STATE_KEY), 'existing library');
  assert.equal(await f.state.read('B'), null);
  f.storage.setItem = write;
  assert.equal(await f.state.read('A'), 'existing library');
});

test('failed legacy removal cannot expose its old copy to the next account', async () => {
  const f = fixture([[LEGACY_STUDY_STATE_KEY, 'existing library']]);
  f.storage.removeItem = async () => { throw Error('temporarily unavailable'); };
  assert.equal(await f.state.read('A'), 'existing library');
  assert.equal(await createAccountStateStorage(f.storage).read('B'), null);
});

test('slow writes retain their captured account through a switch', async () => {
  const f = fixture();
  const write = f.storage.setItem;
  let release;
  const blocked = new Promise((resolve) => { release = resolve; });
  f.storage.setItem = async (key, value) => { await blocked; return write(key, value); };
  const a = f.state.write('A last result', 'A');
  const b = f.state.write('B new result', 'B');
  release();
  await Promise.all([a, b, f.state.flush()]);
  assert.equal(await f.state.read('A'), 'A last result');
  assert.equal(await f.state.read('B'), 'B new result');
});

test('deletion removes only the requested library and preserves other account queues', () => {
  const keys = [studyStateKey('A'), studyStateKey('B'), studyStateKey(), '@studybolt/admin-activity/A', '@studybolt/admin-activity/B', '@studybolt/deleting-account/B', '@studybolt/state/legacy-owner', 'unrelated-app'];
  assert.deepEqual(studyBoltLocalAccountKeys(keys, 'A'), [studyStateKey('A'), '@studybolt/admin-activity/A']);
});

test('deletion preserves another account\'s legacy recovery copy', () => {
  const keys = [LEGACY_STUDY_STATE_KEY, '@studybolt/state/legacy-owner', studyStateKey('B')];
  assert.deepEqual(studyBoltLocalAccountKeys(keys, 'B', studyStateKey('A')), [studyStateKey('B')]);
});

test('deletion removes the owner\'s legacy recovery copy and ownership marker', () => {
  const keys = [LEGACY_STUDY_STATE_KEY, '@studybolt/state/legacy-owner', studyStateKey('A')];
  assert.deepEqual(studyBoltLocalAccountKeys(keys, 'A', studyStateKey('A')), keys);
});
