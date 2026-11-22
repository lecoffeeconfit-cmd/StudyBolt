import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { stripTypeScriptTypes } from 'node:module';

const helperSource = await readFile(new URL('../supabase/functions/_shared/registeredAccount.ts', import.meta.url), 'utf8');
const registeredAccount = await import(`data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(helperSource))}`);

test('server account gate rejects an anonymous JWT with a stable 403 response', async () => {
  const response = registeredAccount.requireRegisteredStudyBoltAccount(true);
  assert.equal(response.status, 403);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
  assert.deepEqual(await response.json(), {
    error: 'Create a free StudyBolt account to unlock AI study tools and secure cross-device sync.',
    code: 'account_required',
  });
});

test('server account gate allows registered users through to existing entitlement checks', () => {
  assert.equal(registeredAccount.requireRegisteredStudyBoltAccount(false), null);
  for (const unknownClaim of [undefined, null]) {
    assert.equal(registeredAccount.requireRegisteredStudyBoltAccount(unknownClaim).status, 403);
  }
});

test('both AI Edge Function paths verify anonymous status before config, quotas, or providers', async () => {
  const [documentUsage, tutor, processor] = await Promise.all([
    readFile(new URL('../supabase/functions/_shared/documentUsage.ts', import.meta.url), 'utf8'),
    readFile(new URL('../supabase/functions/studybolt-ai-tutor/index.ts', import.meta.url), 'utf8'),
    readFile(new URL('../supabase/functions/studybolt-process-document/index.ts', import.meta.url), 'utf8'),
  ]);
  for (const source of [documentUsage, tutor]) {
    const userLookup = source.indexOf('admin.auth.getUser(token)');
    const accountGate = source.indexOf('requireRegisteredStudyBoltAccount(user.is_anonymous)');
    const configRead = source.indexOf("from('ai_cloud_config')");
    assert.ok(userLookup >= 0 && accountGate > userLookup && configRead > accountGate);
  }
  assert.ok(tutor.indexOf('requireRegisteredStudyBoltAccount(user.is_anonymous)') < tutor.indexOf("fetch('https://api.openai.com/v1/responses'"));
  assert.match(documentUsage, /effectiveStudyBoltPlan\(user\.app_metadata\)/);
  assert.match(documentUsage, /rpc\('reserve_ai_cloud_usage'/);
  assert.match(tutor, /rpc\('reserve_ai_cloud_usage'/);
  assert.ok(processor.indexOf('authenticateDocumentRequest(request)') < processor.indexOf("Deno.env.get('OPENAI_API_KEY')"));
  assert.ok(processor.indexOf('authenticateDocumentRequest(request)') < processor.indexOf('request.headers.get(\'content-type\')'));
});

test('unauthenticated direct AI requests still fail before account lookup', async () => {
  const [documentUsage, tutor] = await Promise.all([
    readFile(new URL('../supabase/functions/_shared/documentUsage.ts', import.meta.url), 'utf8'),
    readFile(new URL('../supabase/functions/studybolt-ai-tutor/index.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(documentUsage, /if \(!token\).*?authentication_required/s);
  assert.match(tutor, /if \(!token\).*?401/s);
});
