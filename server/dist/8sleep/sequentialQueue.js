export class SequentialQueue {
    executing = Promise.resolve();
    pending = 0;
    draining = false;
    execInternal(f) {
        const current = this.executing;
        // eslint-disable-next-line no-async-promise-executor
        const newPromise = new Promise(async (resolve) => {
            await current;
            await f();
            resolve();
        });
        this.executing = newPromise;
        return newPromise;
    }
    exec(f) {
        if (this.draining) {
            return Promise.reject(new Error('SequentialQueue is draining'));
        }
        this.pending += 1;
        return new Promise((resolve, reject) => {
            this.execInternal(async () => {
                try {
                    resolve(await f());
                }
                catch (err) {
                    reject(err);
                }
                finally {
                    this.pending -= 1;
                }
            });
        });
    }
    depth() {
        return this.pending;
    }
    // Reject any future exec() calls and resolve when the in-flight chain
    // finishes. Used during shutdown / forced reconnect.
    async drain() {
        this.draining = true;
        try {
            await this.executing;
        }
        catch {
            // swallow — drain should resolve regardless of whether tasks rejected
        }
    }
}
//# sourceMappingURL=sequentialQueue.js.map