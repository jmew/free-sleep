import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'http';
import { WebSocket } from 'ws';
import { WsServer } from './wsServer.js';
import eventBus from '../events/eventBus.js';
async function startHttp() {
    const server = createServer((_req, res) => res.end('ok'));
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    const ws = new WsServer();
    ws.attach(server);
    return { server, port, ws };
}
async function shutdown(server, ws) {
    await ws.close();
    await new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
    });
}
// Buffer messages so the test never races the listener attachment.
function bufferMessages(ws) {
    const buffered = [];
    let pendingResolve = null;
    ws.on('message', (data) => {
        const s = data.toString();
        if (pendingResolve) {
            const r = pendingResolve;
            pendingResolve = null;
            r(s);
        }
        else {
            buffered.push(s);
        }
    });
    return {
        next() {
            if (buffered.length > 0)
                return Promise.resolve(buffered.shift());
            return new Promise((resolve) => { pendingResolve = resolve; });
        },
    };
}
describe('wsServer', () => {
    it('greets connections, forwards events, and tracks client count', async () => {
        const { server, port, ws: wsSrv } = await startHttp();
        const clientBefore = eventBus.clientCount;
        const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/events`);
        const reader = bufferMessages(ws);
        await new Promise((resolve, reject) => {
            ws.once('open', () => resolve());
            ws.once('error', reject);
        });
        const hello = await reader.next();
        assert.match(hello, /"channel":"hello"/);
        assert.equal(eventBus.clientCount, clientBefore + 1);
        eventBus.emit('job-event', { jobName: 'wstest', status: 'ok' });
        const body = await reader.next();
        const parsed = JSON.parse(body);
        assert.equal(parsed.channel, 'job-event');
        assert.equal(parsed.payload.jobName, 'wstest');
        await new Promise((resolve) => {
            ws.once('close', () => resolve());
            ws.close();
        });
        await shutdown(server, wsSrv);
        assert.equal(eventBus.clientCount, clientBefore);
    });
    it('rejects upgrades on unknown paths', async () => {
        const { server, port, ws: wsSrv } = await startHttp();
        const ws = new WebSocket(`ws://127.0.0.1:${port}/not-the-ws-path`);
        await new Promise((resolve) => {
            const finish = () => resolve();
            ws.once('error', finish);
            ws.once('close', finish);
            ws.once('unexpected-response', finish);
        });
        await shutdown(server, wsSrv);
    });
});
//# sourceMappingURL=wsServer.test.js.map