import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

// Exercise the real router with only native/provider boundaries replaced.
let fixtureId = 0;
const moduleUrl = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
const context = { studySetTitle: 'Same title', subject: 'Biology', currentChunk: { id: 'one', text: 'Same source', title: 'One' }, nearbyChunks: [] };
async function router(t, services) {
  globalThis.studyBoltAiIsolationFixture = services;
  t.after(() => { delete globalThis.studyBoltAiIsolationFixture; });
  const cloud = moduleUrl('export const askAiTutor=(...args)=>globalThis.studyBoltAiIsolationFixture.cloud(...args);');
  const local = moduleUrl('export const askOnDeviceTutor=(...args)=>globalThis.studyBoltAiIsolationFixture.local(...args); export const canAttemptOnDeviceAI=()=>false;');
  const source = stripTypeScriptTypes(await readFile(new URL('../src/services/aiRouter.ts', import.meta.url), 'utf8'))
    .replace("from './aiTutor'", `from '${cloud}'`)
    .replace("from './onDeviceAI'", `from '${local}'`);
  return import(moduleUrl(`${source}\n// fixture ${fixtureId++}`));
}
const unavailable = { availability: { status: 'unavailable', reason: 'fixture' } };
const args = { action: 'explain', context, accessToken: 'fixture-session' };

test('account change clears private Tutor answers even with matching study context', async (t) => {
  let calls = 0;
  const r = await router(t, { local: async () => unavailable, cloud: async () => ({ response: { answer: `private answer ${++calls}` } }) });
  assert.equal((await r.runStudyBoltAI(args)).response.answer, 'private answer 1');
  assert.equal((await r.runStudyBoltAI(args)).routeUsed, 'cache');
  r.clearStudyBoltAiResponseCache();
  assert.equal((await r.runStudyBoltAI(args)).response.answer, 'private answer 2');
});

test('late cloud completion cannot repopulate the next account cache', async (t) => {
  let complete;
  let started;
  let calls = 0;
  const began = new Promise((resolve) => { started = resolve; });
  const pending = new Promise((resolve) => { complete = resolve; });
  const r = await router(t, { local: async () => unavailable, cloud: async () => {
    calls++;
    if (calls === 1) { started(); return pending; }
    return { response: { answer: 'new account answer' } };
  } });
  const old = r.runStudyBoltAI(args);
  await began;
  r.clearStudyBoltAiResponseCache();
  complete({ response: { answer: 'old private answer' } });
  await old;
  assert.equal((await r.runStudyBoltAI(args)).response.answer, 'new account answer');
  assert.equal(calls, 2);
});

test('account switch during on-device work prevents the old cloud request', async (t) => {
  let finish;
  let calls = 0;
  const pending = new Promise((resolve) => { finish = resolve; });
  const r = await router(t, { local: () => pending, cloud: async () => { calls++; return {}; } });
  const old = r.runStudyBoltAI(args);
  r.clearStudyBoltAiResponseCache();
  finish(unavailable);
  assert.equal((await old).routeUsed, 'none');
  assert.equal(calls, 0);
});
