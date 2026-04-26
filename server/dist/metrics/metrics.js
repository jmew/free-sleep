// Lightweight in-process metrics — no Prom client, no new deps.
// Three primitives:
//   - Histogram: rolling window of last N samples, p50/p95/avg on read.
//   - Counter:   monotonically increasing integer.
//   - Gauge:     latest value via setter.
const HISTOGRAM_WINDOW = 1_000;
class Histogram {
    samples = [];
    record(value) {
        this.samples.push(value);
        if (this.samples.length > HISTOGRAM_WINDOW) {
            this.samples.shift();
        }
    }
    snapshot() {
        if (this.samples.length === 0) {
            return { count: 0, p50: 0, p95: 0, avg: 0, max: 0 };
        }
        const sorted = [...this.samples].sort((a, b) => a - b);
        const pct = (p) => {
            const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
            return sorted[idx];
        };
        const sum = sorted.reduce((s, v) => s + v, 0);
        return {
            count: sorted.length,
            p50: pct(50),
            p95: pct(95),
            avg: Math.round(sum / sorted.length),
            max: sorted[sorted.length - 1],
        };
    }
}
class Metrics {
    // eslint-disable-next-line no-use-before-define
    static instance;
    frankenLatency = new Histogram();
    frankenTimeouts = 0;
    frankenLastRoundtripAt = null;
    frankenQueueDepthFn = null;
    wsClientCountFn = null;
    jobsOk = 0;
    jobsFail = 0;
    static getInstance() {
        if (!Metrics.instance)
            Metrics.instance = new Metrics();
        return Metrics.instance;
    }
    recordFrankenCommand(latencyMs, timedOut) {
        this.frankenLatency.record(latencyMs);
        if (timedOut) {
            this.frankenTimeouts += 1;
        }
        else {
            this.frankenLastRoundtripAt = new Date().toISOString();
        }
    }
    registerFrankenQueueDepth(fn) {
        this.frankenQueueDepthFn = fn;
    }
    registerWsClientCount(fn) {
        this.wsClientCountFn = fn;
    }
    recordJob(status) {
        if (status === 'ok')
            this.jobsOk += 1;
        else
            this.jobsFail += 1;
    }
    snapshot() {
        return {
            franken: {
                commandLatencyMs: this.frankenLatency.snapshot(),
                timeouts: this.frankenTimeouts,
                lastRoundtripAt: this.frankenLastRoundtripAt,
                queueDepth: this.frankenQueueDepthFn ? this.frankenQueueDepthFn() : null,
            },
            ws: {
                clientCount: this.wsClientCountFn ? this.wsClientCountFn() : null,
            },
            jobs: {
                executions: { ok: this.jobsOk, fail: this.jobsFail },
            },
            uptimeSeconds: Math.round(process.uptime()),
            memory: {
                rssMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
                heapUsedMb: Math.round(process.memoryUsage().heapUsed / (1024 * 1024)),
            },
        };
    }
}
export default Metrics.getInstance();
//# sourceMappingURL=metrics.js.map