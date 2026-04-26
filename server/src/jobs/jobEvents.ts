import eventBus, { JobEventPayload } from '../events/eventBus.js';
import metrics from '../metrics/metrics.js';

// Single funnel for "a scheduled job did something" — keeps metrics counters
// and the event bus in sync without each caller having to remember both.
export function emitJobEvent(payload: JobEventPayload): void {
  if (payload.status === 'ok') metrics.recordJob('ok');
  if (payload.status === 'fail') metrics.recordJob('fail');
  eventBus.emit('job-event', payload);
}
