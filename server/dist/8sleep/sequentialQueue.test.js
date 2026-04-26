import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SequentialQueue } from './sequentialQueue.js';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
describe('SequentialQueue', () => {
    it('executes tasks one at a time in submission order', async () => {
        const q = new SequentialQueue();
        const order = [];
        const a = q.exec(async () => { await wait(20); order.push(1); return 'a'; });
        const b = q.exec(async () => { order.push(2); return 'b'; });
        const c = q.exec(async () => { order.push(3); return 'c'; });
        const results = await Promise.all([a, b, c]);
        assert.deepEqual(results, ['a', 'b', 'c']);
        assert.deepEqual(order, [1, 2, 3]);
    });
    it('isolates rejections — a failing task does not block later tasks', async () => {
        const q = new SequentialQueue();
        const ran = [];
        const a = q.exec(async () => {
            ran.push('a');
            throw new Error('boom');
        });
        const b = q.exec(async () => {
            ran.push('b');
            return 'ok';
        });
        await assert.rejects(a, /boom/);
        assert.equal(await b, 'ok');
        assert.deepEqual(ran, ['a', 'b']);
    });
    it('reports depth() reflecting pending tasks', async () => {
        const q = new SequentialQueue();
        let release;
        const blocker = new Promise((r) => { release = r; });
        const a = q.exec(async () => { await blocker; return 1; });
        const b = q.exec(async () => 2);
        const c = q.exec(async () => 3);
        // Allow the microtask queue to advance so exec() runs and increments pending.
        await wait(0);
        assert.equal(q.depth(), 3);
        release();
        await Promise.all([a, b, c]);
        assert.equal(q.depth(), 0);
    });
    it('rejects new tasks after drain() is called', async () => {
        const q = new SequentialQueue();
        const a = q.exec(async () => 'first');
        await q.drain();
        await a;
        await assert.rejects(q.exec(async () => 'late'), /draining/);
    });
});
//# sourceMappingURL=sequentialQueue.test.js.map