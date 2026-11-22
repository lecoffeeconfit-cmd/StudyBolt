import assert from 'node:assert/strict';
import test from 'node:test';

import { readAuthCallback } from '../src/services/authCallback.ts';

test('accepts warm and cold native callbacks and reads provider errors', () => {
  assert.deepEqual(readAuthCallback('studybolt://auth/callback?code=one+two'), { code: 'one two', rejected: false });
  assert.deepEqual(readAuthCallback('studybolt:///auth/callback?code=abc'), { code: 'abc', rejected: false });
  assert.deepEqual(readAuthCallback('studybolt://auth/callback?code=abc&sb_flow_id=0123456789abcdef'), {
    code: 'abc', rejected: false, flowId: '0123456789abcdef',
  });
  assert.deepEqual(readAuthCallback('studybolt://auth/callback#error_code=access_denied'), { code: null, rejected: true });
  assert.deepEqual(readAuthCallback('studybolt://auth/callback#access_token=old&refresh_token=old'), { code: null, rejected: false });
});

test('matches only the exact native route or same-origin marked web return', () => {
  const web = 'http://localhost:8096/?studybolt_auth=1';
  assert.deepEqual(readAuthCallback(web + '&code=abc', web), { code: 'abc', rejected: false });
  for (const url of [
    'https://untrusted.example/?studybolt_auth=1&code=abc',
    'studybolt://public/auth/callback?code=abc',
    'studybolt://auth/callback/extra?code=abc',
    'http://localhost:8096/?code=abc',
  ]) assert.equal(readAuthCallback(url, web), null);
});
