import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import eventBus from './eventBus.js';

describe('eventBus', () => {
  it('delivers events on the requested channel and not others', () => {
    const seenJob: string[] = [];
    const seenHealth: string[] = [];
    const offJob = eventBus.subscribe('job-event', (env) => seenJob.push(env.payload.jobName));
    const offHealth = eventBus.subscribe('service-health', (env) => seenHealth.push(JSON.stringify(env.payload)));

    eventBus.emit('job-event', { jobName: 'a', status: 'ok' });
    eventBus.emit('service-health', { jobs: { name: 'x', status: 'healthy', description: '', message: '' } as never });
    eventBus.emit('job-event', { jobName: 'b', status: 'fail', message: 'nope' });

    offJob();
    offHealth();

    assert.deepEqual(seenJob, ['a', 'b']);
    assert.equal(seenHealth.length, 1);
  });

  it('subscribeAll receives events on every channel', () => {
    const seen: string[] = [];
    const off = eventBus.subscribeAll((env) => seen.push(env.channel));
    eventBus.emit('job-event', { jobName: 'x', status: 'started' });
    eventBus.emit('job-event', { jobName: 'x', status: 'ok' });
    off();
    assert.deepEqual(seen.slice(-2), ['job-event', 'job-event']);
  });

  it('tracks client count via register/unregister', () => {
    const start = eventBus.clientCount;
    eventBus.registerClient();
    eventBus.registerClient();
    assert.equal(eventBus.clientCount, start + 2);
    eventBus.unregisterClient();
    eventBus.unregisterClient();
    assert.equal(eventBus.clientCount, start);
  });

  it('does not invoke unsubscribed listeners', () => {
    let count = 0;
    const off = eventBus.subscribe('job-event', () => { count += 1; });
    eventBus.emit('job-event', { jobName: 'first', status: 'ok' });
    off();
    eventBus.emit('job-event', { jobName: 'second', status: 'ok' });
    assert.equal(count, 1);
  });
});
