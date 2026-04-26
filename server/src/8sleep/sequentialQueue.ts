export class SequentialQueue {
  private executing = Promise.resolve();
  private pending = 0;
  private draining = false;

  private execInternal(f: () => Promise<void>) {
    const current = this.executing;
    // eslint-disable-next-line no-async-promise-executor
    const newPromise = new Promise<void>(async (resolve) => {
      await current;
      await f();
      resolve();
    });

    this.executing = newPromise;
    return newPromise;
  }

  public exec<T>(f: () => Promise<T>): Promise<T> {
    if (this.draining) {
      return Promise.reject(new Error('SequentialQueue is draining'));
    }
    this.pending += 1;
    return new Promise<T>((resolve, reject) => {
      this.execInternal(async () => {
        try {
          resolve(await f());
        } catch (err) {
          reject(err);
        } finally {
          this.pending -= 1;
        }
      });
    });
  }

  public depth(): number {
    return this.pending;
  }

  // Reject any future exec() calls and resolve when the in-flight chain
  // finishes. Used during shutdown / forced reconnect.
  public async drain(): Promise<void> {
    this.draining = true;
    try {
      await this.executing;
    } catch {
      // swallow — drain should resolve regardless of whether tasks rejected
    }
  }
}
