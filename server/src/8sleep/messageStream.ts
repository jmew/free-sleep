import binarySplit from 'binary-split';
import { Transform } from 'stream';

export class MessageStream {
  private readonly splitter: Transform;
  private readonly queue: Buffer[] = [];
  private ended = false;
  private error: unknown;

  public constructor(
    readable: NodeJS.ReadableStream,
    separator = Buffer.from('\n\n')
  ) {
    this.splitter = binarySplit(separator);
    this.splitter.on('data', (chunk: Buffer) => {
      this.queue.push(chunk);
    });
    this.splitter.on('end', () => {
      this.ended = true;
    });
    this.splitter.on('error', (err: unknown) => {
      this.error = err;
    });

    readable.pipe(this.splitter);
    readable.on('error', (error) => this.splitter.destroy(error));
  }

  public async readMessage(options?: { signal?: AbortSignal }): Promise<Buffer> {
    const signal = options?.signal;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (this.queue.length > 0) {
        return this.queue.shift() as Buffer;
      }

      if (this.error) {
        const err = this.error;
        this.error = undefined;
        throw err;
      }

      if (this.ended) {
        throw new Error('stream ended');
      }

      if (signal?.aborted) {
        throw signal.reason ?? new Error('readMessage aborted');
      }

      // Wait for whichever happens first: more data, the source ends, or the
      // caller aborts. Without racing 'end' here, a stream that ends just
      // before this method runs would block forever on 'data'.
      await new Promise<void>((resolve, reject) => {
        // Closures over `handlers` so each handler can reference the same
        // cleanup without forward declarations or let/const churn.
        const handlers = {
          onData: () => { /* assigned below */ },
          onEnd: () => { /* assigned below */ },
          onAbort: () => { /* assigned below */ },
        };
        const cleanup = () => {
          this.splitter.off('data', handlers.onData);
          this.splitter.off('end', handlers.onEnd);
          if (signal) signal.removeEventListener('abort', handlers.onAbort);
        };
        handlers.onData = () => { cleanup(); resolve(); };
        handlers.onEnd = () => { cleanup(); resolve(); };
        handlers.onAbort = () => { cleanup(); reject(signal?.reason ?? new Error('readMessage aborted')); };
        this.splitter.once('data', handlers.onData);
        this.splitter.once('end', handlers.onEnd);
        if (signal) signal.addEventListener('abort', handlers.onAbort, { once: true });
      });
    }
  }
}
