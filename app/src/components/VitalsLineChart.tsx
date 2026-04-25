import { useMemo } from 'react';
import moment from 'moment-timezone';
import { VitalsRecord } from '@api/vitals.ts';
import MetricChartCard from '@design/MetricChartCard';
import TimeSeriesChart, { TimeSeriesPoint } from '@design/TimeSeriesChart';

type Metric = 'heart_rate' | 'hrv' | 'breathing_rate';
type VitalsLineChartProps = {
  vitalsRecords?: VitalsRecord[];
  metric: Metric;
};

// Display config per metric: section labels + units + healthy target band.
// The target ranges below are general adult sleep references — used only as a
// faint background band on the chart for visual context, not a medical claim.
const METRIC_CONFIG: Record<
  Metric,
  {
    primaryLabel: string;
    secondaryLabel: string;
    unit: string;
    targetRange?: [number, number];
  }
> = {
  heart_rate:    { primaryLabel: 'AT REST',         secondaryLabel: 'YOUR RANGE',     unit: 'bpm' },
  hrv:           { primaryLabel: 'TONIGHT',         secondaryLabel: 'NIGHTLY RANGE',  unit: 'ms', targetRange: [50, 100] },
  breathing_rate:{ primaryLabel: 'TONIGHT',         secondaryLabel: 'NIGHTLY RANGE',  unit: 'brpm', targetRange: [12, 20] },
};

function downsample<T>(arr: T[], maxPoints: number): T[] {
  if (arr.length <= maxPoints) return arr;
  const factor = Math.ceil(arr.length / maxPoints);
  return arr.filter((_, i) => i % factor === 0);
}

export default function VitalsLineChart({ vitalsRecords, metric }: VitalsLineChartProps) {
  const cfg = METRIC_CONFIG[metric];

  const { points, primaryValue, rangeText } = useMemo(() => {
    if (!vitalsRecords || vitalsRecords.length === 0) {
      return { points: [] as TimeSeriesPoint[], primaryValue: '—', rangeText: '—' };
    }
    const cleaned = vitalsRecords
      .filter((r) => r.timestamp && !isNaN(new Date(r.timestamp).getTime()) && !isNaN(r[metric] as number))
      .map((r) => ({ timestamp: new Date(r.timestamp), value: Number(r[metric]) }))
      .filter((r) => r.value > 0);

    if (cleaned.length === 0) {
      return { points: [] as TimeSeriesPoint[], primaryValue: '—', rangeText: '—' };
    }

    const downsampled = downsample(cleaned, 120);
    const values = cleaned.map((p) => p.value);
    const lo = Math.min(...values);
    const hi = Math.max(...values);

    // For "AT REST" on heart rate, show the minimum (resting HR is typically
    // the lowest sustained reading during sleep). For other metrics, show
    // the average.
    const primary =
      metric === 'heart_rate'
        ? Math.round(lo)
        : Math.round(values.reduce((a, b) => a + b, 0) / values.length);

    return {
      points: downsampled,
      primaryValue: `${primary} ${cfg.unit}`,
      rangeText: `${Math.round(lo)}–${Math.round(hi)} ${cfg.unit}`,
    };
  }, [vitalsRecords, metric, cfg.unit]);

  if (points.length === 0) return null;

  return (
    <MetricChartCard
      stats={ [
        { label: cfg.primaryLabel, value: primaryValue },
        { label: cfg.secondaryLabel, value: rangeText },
      ] }
    >
      <TimeSeriesChart
        data={ points }
        targetRange={ cfg.targetRange }
        xValueFormatter={ (d) => moment(d).format('h a').toLowerCase() }
        yValueFormatter={ (n) => Math.round(n).toString() }
      />
    </MetricChartCard>
  );
}
