import { once } from 'events';
import binarySplit from 'binary-split';
export class MessageStream {
    splitter;
    queue = [];
    ended = false;
    error;
    constructor(readable, separator = Buffer.from('\n\n')) {
        this.splitter = binarySplit(separator);
        this.splitter.on('data', (chunk) => {
            this.queue.push(chunk);
        });
        this.splitter.on('end', () => {
            this.ended = true;
        });
        this.splitter.on('error', (err) => {
            this.error = err;
        });
        readable.pipe(this.splitter);
        readable.on('error', (error) => this.splitter.destroy(error));
    }
    async readMessage() {
        // eslint-disable-next-line no-constant-condition
        while (true) {
            if (this.queue.length > 0) {
                return this.queue.shift();
            }
            if (this.error) {
                const err = this.error;
                this.error = undefined;
                throw err;
            }
            if (this.ended) {
                throw new Error('stream ended');
            }
            await once(this.splitter, 'data');
        }
    }
}
//# sourceMappingURL=messageStream.js.map