import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { promiseWithTimeout, TimeoutError } from './timeoutPromise.js';

describe('promiseWithTimeout', () => {
  it('resolves with the inner value when it beats the timeout', async () => {
    const result = await promiseWithTimeout(Promise.resolve(42), 50);
    assert.equal(result, 42);
  });

  it('rejects with TimeoutError when the inner promise hangs', async () => {
    const hung = new Promise(() => { /* never resolves */ });
    await assert.rejects(promiseWithTimeout(hung, 20), TimeoutError);
  });

  it('uses onTimeout to construct a custom error when provided', async () => {
    class MyTimeout extends Error {}
    const hung = new Promise(() => { /* never resolves */ });
    await assert.rejects(
      promiseWithTimeout(hung, 20, { onTimeout: () => new MyTimeout('custom') }),
      MyTimeout,
    );
  });

  it('aborts the supplied AbortController when the timeout fires', async () => {
    const ac = new AbortController();
    const hung = new Promise(() => { /* never resolves */ });
    await assert.rejects(promiseWithTimeout(hung, 20, { abortController: ac }));
    assert.equal(ac.signal.aborted, true);
  });

  it('does not abort when the inner promise wins the race', async () => {
    const ac = new AbortController();
    await promiseWithTimeout(Promise.resolve('ok'), 50, { abortController: ac });
    assert.equal(ac.signal.aborted, false);
  });

  it('propagates inner rejection without involving timeout', async () => {
    const inner = Promise.reject(new Error('boom'));
    await assert.rejects(promiseWithTimeout(inner, 50), /boom/);
  });
});
