import { useMemo } from 'react';
import { LineChart } from '@mui/x-charts/LineChart';
import { Card, Typography } from '@mui/material';
import moment from 'moment-timezone';
import { useTheme } from '@mui/material/styles';
import { VitalsRecord } from '@api/vitals.ts';
import { useResizeDetector } from 'react-resize-detector';

type Metric = 'heart_rate' | 'hrv' | 'breathing_rate';
type VitalsLineChartProps = {
  vitalsRecords?: VitalsRecord[];
  metric: Metric;
};


function downsampleData<T>(data: readonly T[], factor: number): T[] {
  if (!Number.isFinite(factor) || factor <= 1) return [...data];
  return data.filter((_, i) => i % factor === 0);
}

export default function VitalsLineChart({ vitalsRecords, metric }: VitalsLineChartProps) {
  const { width = 300, ref } = useResizeDetector();
  const theme = useTheme();

  const cleanedVitalsRecords = useMemo(() => {
    if (!vitalsRecords) return [];
    const pxPerPoint = 3;
    const allowedPoints = width / pxPerPoint;
    const downsampleTo = Math.ceil(vitalsRecords?.length / allowedPoints);
    return downsampleData(vitalsRecords, downsampleTo)
      .filter(
        (record) =>
          record.timestamp &&
          !isNaN(new Date(record.timestamp).getTime()) &&
          !isNaN(record[metric])
      )
      .map((record) => ({
        ...record,
        timestamp: new Date(record.timestamp),
        [metric]: Number(record[metric]),
      }));
  }, [vitalsRecords]);

  if (!vitalsRecords) return;

  const vitalsMap = {
    heart_rate: {
      label: 'Heart rate',
      color: theme.palette.error.main,
    },
    breathing_rate: {
      label: 'Breathing rate',
      color: theme.palette.primary.main,
    },
    hrv: {
      label: 'HRV',
      color: theme.palette.error.main,
    }
  };
  const { label, color } = vitalsMap[metric];


  return (
    <Card sx={ { pt: 1, mt: 2, pl: 2, pr: 2, pb: 2 } }>
      <Typography variant="h6" gutterBottom>
        { label }
      </Typography>
      <LineChart
        ref={ ref }
        height={ 300 }
        colors={ [color] }
        dataset={ cleanedVitalsRecords }
        xAxis={ [
          {
            id: 'Years',
            dataKey: 'timestamp',
            scaleType: 'time',
            valueFormatter: (periodStart) =>
              moment(periodStart).format('HH:mm'),
          },
        ] }
        legend={ { hidden: true } }
        series={ [
          {
            id: label,
            label: label,
            dataKey: metric,
            valueFormatter: (metric) => (metric !== null && !isNaN(metric) ? metric.toFixed(0) : 'Invalid'),
            showMark: false,
          },
        ] }
      />
    </Card>
  );
}
