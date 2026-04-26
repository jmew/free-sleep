import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import metrics from './metrics.js';

describe('metrics', () => {
  it('records franken command latency and exposes p50/p95', () => {
    // Record a deterministic spread.
    for (let v = 1; v <= 100; v += 1) {
      metrics.recordFrankenCommand(v, false);
    }
    const snap = metrics.snapshot();
    assert.ok(snap.franken.commandLatencyMs.count >= 100);
    assert.ok(snap.franken.commandLatencyMs.p50 >= 40 && snap.franken.commandLatencyMs.p50 <= 60);
    assert.ok(snap.franken.commandLatencyMs.p95 >= 90 && snap.franken.commandLatencyMs.p95 <= 100);
    assert.ok(snap.franken.lastRoundtripAt !== null);
  });

  it('counts timeouts independently of latency samples', () => {
    const before = metrics.snapshot().franken.timeouts;
    metrics.recordFrankenCommand(5_000, true);
    metrics.recordFrankenCommand(5_000, true);
    const after = metrics.snapshot().franken.timeouts;
    assert.equal(after - before, 2);
  });

  it('reports the registered franken queue depth', () => {
    let depth = 0;
    metrics.registerFrankenQueueDepth(() => depth);
    depth = 7;
    assert.equal(metrics.snapshot().franken.queueDepth, 7);
  });

  it('reports the registered ws client count', () => {
    let clients = 0;
    metrics.registerWsClientCount(() => clients);
    clients = 3;
    assert.equal(metrics.snapshot().ws.clientCount, 3);
  });

  it('counts ok/fail jobs separately', () => {
    const before = metrics.snapshot().jobs.executions;
    metrics.recordJob('ok');
    metrics.recordJob('fail');
    metrics.recordJob('ok');
    const after = metrics.snapshot().jobs.executions;
    assert.equal(after.ok - before.ok, 2);
    assert.equal(after.fail - before.fail, 1);
  });
});
