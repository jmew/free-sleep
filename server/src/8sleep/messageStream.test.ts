import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'stream';
import { MessageStream } from './messageStream.js';

const SEPARATOR = Buffer.from('\n\n');

function readableFrom(chunks: Buffer[]): Readable {
  let i = 0;
  return new Readable({
    read() {
      if (i >= chunks.length) {
        this.push(null);
      } else {
        this.push(chunks[i++]);
      }
    },
  });
}

describe('MessageStream', () => {
  it('returns messages split by the separator', async () => {
    const r = readableFrom([Buffer.from('alpha\n\nbeta\n\ngamma\n\n')]);
    const ms = new MessageStream(r, SEPARATOR);
    assert.equal((await ms.readMessage()).toString(), 'alpha');
    assert.equal((await ms.readMessage()).toString(), 'beta');
    assert.equal((await ms.readMessage()).toString(), 'gamma');
  });

  it('handles separators that span multiple chunks', async () => {
    // `bar\n` then `\nbaz\n\n` → two messages: foo, bar, baz (split mid-separator).
    const r = readableFrom([
      Buffer.from('foo\n\nbar\n'),
      Buffer.from('\nbaz\n\n'),
    ]);
    const ms = new MessageStream(r, SEPARATOR);
    assert.equal((await ms.readMessage()).toString(), 'foo');
    assert.equal((await ms.readMessage()).toString(), 'bar');
    assert.equal((await ms.readMessage()).toString(), 'baz');
  });

  it('throws when the stream ends before any message arrives', async () => {
    // Empty source — binary-split sees no data and emits end immediately.
    const r = readableFrom([]);
    const ms = new MessageStream(r, SEPARATOR);
    await assert.rejects(ms.readMessage(), /stream ended/);
  });

  it('rejects when the abort signal fires before data arrives', async () => {
    // A stream that never produces data; we abort the wait.
    const r = new Readable({ read() { /* no-op */ } });
    const ms = new MessageStream(r, SEPARATOR);
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 10);
    await assert.rejects(ms.readMessage({ signal: ac.signal }));
  });
});
