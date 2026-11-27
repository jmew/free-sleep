import { useMemo } from 'react';
import moment from 'moment-timezone';
import { VitalsRecord } from '@api/vitals.ts';
import MetricChartCard from '@design/MetricChartCard';
import TimeSeriesChart, { TimeSeriesPoint } from '@design/TimeSeriesChart';

type Metric = 'heart_rate' | 'hrv' | 'rmssd' | 'breathing_rate';
type VitalsLineChartProps = {
  vitalsRecords?: VitalsRecord[];
  metric: Metric;
  /** Average of this metric over the 7 days leading up to the selected
   *  night, computed from the vitals-summary endpoint by the parent. */
  sevenDayAvg?: number;
};

// Display config per metric: section labels + units + healthy target band.
// The target ranges below are general adult sleep references — used only as a
// faint background band on the chart for visual context, not a medical claim.
const METRIC_CONFIG: Record<
  Metric,
  {
    title: string;
    primaryLabel: string;
    unit: string;
    targetRange?: [number, number];
  }
> = {
  heart_rate:    { title: 'HEART RATE',     primaryLabel: 'AVERAGE', unit: 'bpm' },
  hrv:           { title: 'HRV · SDNN',            primaryLabel: 'TONIGHT', unit: 'ms', },
  rmssd: {title:'HRV · RMSSD', primaryLabel:'TONIGHT', unit:'ms'},
  breathing_rate:{ title: 'BREATHING RATE', primaryLabel: 'TONIGHT', unit: 'brpm', targetRange: [12, 20] },
};

// Bucket-aggregate timestamped points: split into ~maxPoints contiguous
// buckets and emit the mean of each bucket (using the bucket's middle
// timestamp). Smoother trend than naive every-Nth-point decimation, since
// it averages out jitter rather than just dropping in-between samples.
type MeasuredPoint = {timestamp: Date; value: number};
function bucketAggregate(arr: MeasuredPoint[], maxPoints: number): TimeSeriesPoint[] {
  if (arr.length <= maxPoints) return arr;
  const bucketSize = Math.ceil(arr.length / maxPoints);
  const out: TimeSeriesPoint[] = [];
  for (let i = 0; i < arr.length; i += bucketSize) {
    const slice = arr.slice(i, i + bucketSize);
    const meanValue = slice.reduce((s, p) => s + p.value, 0) / slice.length;
    const midIdx = Math.floor(slice.length / 2);
    out.push({ timestamp: slice[midIdx].timestamp, value: meanValue });
  }
  return out;
}

export default function VitalsLineChart({ vitalsRecords, metric, sevenDayAvg }: VitalsLineChartProps) {
  const cfg = METRIC_CONFIG[metric];

  const { points, primaryValue } = useMemo(() => {
    if (!vitalsRecords || vitalsRecords.length === 0) {
      return { points: [] as TimeSeriesPoint[], primaryValue: '—' };
    }
    const cleaned = vitalsRecords
      .filter((r) => r.timestamp && !isNaN(new Date(r.timestamp).getTime()) && !isNaN(r[metric] as number))
      .map((r) => ({ timestamp: new Date(r.timestamp), value: Number(r[metric]) }))
      .filter((r) => r.value > 0);

    if (cleaned.length === 0) {
      return { points: [] as TimeSeriesPoint[], primaryValue: '—' };
    }

    // Was decimate-to-120 with another every-Nth filter inside the chart
    // for visible markers. End result felt cluttered (60–80 dots packed on
    // the line). Bucket-aggregate to ~50 points = roughly half the visible
    // density of the previous version, with smoother trend lines.
    const downsampled: TimeSeriesPoint[] = [];
    let segment: MeasuredPoint[] = [];
    const flush = () => {
      if (segment.length) downsampled.push(...bucketAggregate(segment, Math.max(2, Math.ceil(50 * segment.length / cleaned.length))));
      segment = [];
    };
    for (const r of vitalsRecords) {
      const timestamp = new Date(r.timestamp);
      const value = r[metric];
      const previous = segment[segment.length - 1];
      if (previous && timestamp.getTime() - previous.timestamp.getTime() > 90000) {
        flush();
        downsampled.push({timestamp: new Date(previous.timestamp.getTime()+60000), value:null});
      }
      if (value == null || value <= 0) {
        flush();
        downsampled.push({timestamp, value:null});
      } else {
        segment.push({timestamp, value});
      }
    }
    flush();
    const values = cleaned.map((p) => p.value);

    // For "AT REST" on heart rate, show the minimum (resting HR is typically
    // the lowest sustained reading during sleep). For other metrics, show
    // the average.
    const primary = Math.round(values.reduce((a, b) => a + b, 0) / values.length);

    return {
      points: downsampled,
      primaryValue: `${primary} ${cfg.unit}`,
    };
  }, [vitalsRecords, metric, cfg.unit]);

  const sevenDayValue =
    sevenDayAvg && sevenDayAvg > 0 ? `${Math.round(sevenDayAvg)} ${cfg.unit}` : '—';

  if (points.length === 0) return null;

  return (
    <MetricChartCard
      title={ cfg.title }
      stats={ [
        { label: cfg.primaryLabel, value: primaryValue },
        { label: '7 DAY AVERAGE', value: sevenDayValue },
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
