// Lightweight in-process metrics — no Prom client, no new deps.
// Three primitives:
//   - Histogram: rolling window of last N samples, p50/p95/avg on read.
//   - Counter:   monotonically increasing integer.
//   - Gauge:     latest value via setter.

const HISTOGRAM_WINDOW = 1_000;

class Histogram {
  private samples: number[] = [];

  public record(value: number): void {
    this.samples.push(value);
    if (this.samples.length > HISTOGRAM_WINDOW) {
      this.samples.shift();
    }
  }

  public snapshot() {
    if (this.samples.length === 0) {
      return { count: 0, p50: 0, p95: 0, avg: 0, max: 0 };
    }
    const sorted = [...this.samples].sort((a, b) => a - b);
    const pct = (p: number) => {
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
  private static instance: Metrics;

  private frankenLatency = new Histogram();
  private frankenTimeouts = 0;
  private frankenLastRoundtripAt: string | null = null;
  private frankenQueueDepthFn: (() => number) | null = null;
  private wsClientCountFn: (() => number) | null = null;
  private jobsOk = 0;
  private jobsFail = 0;

  public static getInstance(): Metrics {
    if (!Metrics.instance) Metrics.instance = new Metrics();
    return Metrics.instance;
  }

  public recordFrankenCommand(latencyMs: number, timedOut: boolean): void {
    this.frankenLatency.record(latencyMs);
    if (timedOut) {
      this.frankenTimeouts += 1;
    } else {
      this.frankenLastRoundtripAt = new Date().toISOString();
    }
  }

  public registerFrankenQueueDepth(fn: () => number): void {
    this.frankenQueueDepthFn = fn;
  }

  public registerWsClientCount(fn: () => number): void {
    this.wsClientCountFn = fn;
  }

  public recordJob(status: 'ok' | 'fail'): void {
    if (status === 'ok') this.jobsOk += 1;
    else this.jobsFail += 1;
  }

  public snapshot() {
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
