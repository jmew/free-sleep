import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, Server as HttpServer } from 'http';
import { AddressInfo } from 'net';
import { WebSocket } from 'ws';
import { WsServer } from './wsServer.js';
import eventBus from '../events/eventBus.js';

async function startHttp(): Promise<{ server: HttpServer; port: number; ws: WsServer }> {
  const server = createServer((_req, res) => res.end('ok'));
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as AddressInfo).port;
  const ws = new WsServer();
  ws.attach(server);
  return { server, port, ws };
}

async function shutdown(server: HttpServer, ws: WsServer) {
  await ws.close();
  await new Promise<void>((resolve) => {
    server.closeAllConnections();
    server.close(() => resolve());
  });
}

// Buffer messages so the test never races the listener attachment.
function bufferMessages(ws: WebSocket) {
  const buffered: string[] = [];
  let pendingResolve: ((s: string) => void) | null = null;

  ws.on('message', (data) => {
    const s = data.toString();
    if (pendingResolve) {
      const r = pendingResolve;
      pendingResolve = null;
      r(s);
    } else {
      buffered.push(s);
    }
  });

  return {
    next(): Promise<string> {
      if (buffered.length > 0) return Promise.resolve(buffered.shift() as string);
      return new Promise<string>((resolve) => { pendingResolve = resolve; });
    },
  };
}

describe('wsServer', () => {
  it('greets connections, forwards events, and tracks client count', async () => {
    const { server, port, ws: wsSrv } = await startHttp();
    const clientBefore = eventBus.clientCount;

    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/events`);
    const reader = bufferMessages(ws);
    await new Promise<void>((resolve, reject) => {
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

    await new Promise<void>((resolve) => {
      ws.once('close', () => resolve());
      ws.close();
    });

    await shutdown(server, wsSrv);
    assert.equal(eventBus.clientCount, clientBefore);
  });

  it('rejects upgrades on unknown paths', async () => {
    const { server, port, ws: wsSrv } = await startHttp();

    const ws = new WebSocket(`ws://127.0.0.1:${port}/not-the-ws-path`);
    await new Promise<void>((resolve) => {
      const finish = () => resolve();
      ws.once('error', finish);
      ws.once('close', finish);
      ws.once('unexpected-response', finish);
    });

    await shutdown(server, wsSrv);
  });
});
