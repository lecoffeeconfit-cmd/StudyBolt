import assert from 'node:assert/strict';
import test from 'node:test';
import { withUploadTimeout } from '../src/services/uploadTimeout.ts';

test('returns the upload result without cancelling a completed request', async () => {
  let cancelled = false;
  const result = await withUploadTimeout(Promise.resolve('uploaded'), 100, () => { cancelled = true; }, () => new Error('timeout'));
  assert.equal(result, 'uploaded');
  assert.equal(cancelled, false);
});

test('cancels a pending native request and reports the timeout', async () => {
  let cancelled = false;
  const pending = new Promise(() => undefined);
  await assert.rejects(
    withUploadTimeout(pending, 5, () => { cancelled = true; }, () => new Error('upload timed out')),
    /upload timed out/,
  );
  assert.equal(cancelled, true);
});

test('preserves an upload error that arrives before the timeout', async () => {
  let cancelled = false;
  await assert.rejects(
    withUploadTimeout(Promise.reject(new Error('network failure')), 100, () => { cancelled = true; }, () => new Error('timeout')),
    /network failure/,
  );
  assert.equal(cancelled, false);
});
