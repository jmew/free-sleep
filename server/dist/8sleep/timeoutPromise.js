// Race a promise against a timeout. The timer is cleared whichever way the
// race resolves. If `onTimeout` is provided, its return value is used as the
// rejection error; otherwise a generic TimeoutError is thrown. An optional
// AbortController is aborted when the timeout fires so the underlying
// operation gets a chance to cancel cleanly (e.g. detaching event listeners).
export class TimeoutError extends Error {
    constructor(message = 'Operation timed out') {
        super(message);
        this.name = 'TimeoutError';
    }
}
export function promiseWithTimeout(promise, timeoutMs, options = {}) {
    const { onTimeout, abortController } = options;
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            if (abortController) {
                try {
                    abortController.abort();
                }
                catch {
                    // ignored
                }
            }
            reject(onTimeout ? onTimeout() : new TimeoutError());
        }, timeoutMs);
        promise
            .then((value) => {
            clearTimeout(timer);
            resolve(value);
        })
            .catch((error) => {
            clearTimeout(timer);
            reject(error);
        });
    });
}
//# sourceMappingURL=timeoutPromise.js.map