import { LineChart } from '@mui/x-charts/LineChart';
import { Box } from '@mui/material';
import { useResizeDetector } from 'react-resize-detector';
import { palette } from './tokens';

export type TimeSeriesPoint = {
  timestamp: Date;
  value: number;
};

type TimeSeriesChartProps = {
  data: TimeSeriesPoint[];
  height?: number;
  /** Format an x-axis tick (timestamp). Default = "HH:MM" / "Mon" / etc. */
  xValueFormatter?: (date: Date) => string;
  /** Format a y-axis tick. Default = integer string. */
  yValueFormatter?: (n: number) => string;
  /** Optional [min, max] range for a translucent green target band. */
  targetRange?: [number, number];
  /** Color of the line + markers. Default white. */
  lineColor?: string;
};

/**
 * Time-series line chart styled to match the 8 Sleep app's nightly metric
 * charts (HR, HRV, breathing rate, etc.).
 *
 * Visual conventions:
 *   - White line + small white-stroked markers
 *   - Dotted grey grid lines
 *   - Y-axis labels right-aligned, X-axis at bottom, both dim grey
 *   - Optional translucent green band for "in target range"
 */
export default function TimeSeriesChart({
  data,
  height = 220,
  xValueFormatter,
  yValueFormatter,
  targetRange,
  lineColor = '#ffffff',
}: TimeSeriesChartProps) {
  const { width = 320, ref } = useResizeDetector();
  const fmtX = xValueFormatter ?? ((d: Date) => d.toLocaleTimeString([], { hour: 'numeric' }).toLowerCase().replace(' ', ''));
  const fmtY = yValueFormatter ?? ((n: number) => Math.round(n).toString());

  // Compute Y-axis range: pad slightly above/below data, but include the
  // target band if one is set so it's always visible.
  const values = data.map((p) => p.value).filter((v) => Number.isFinite(v));
  const dataMin = values.length ? Math.min(...values) : 0;
  const dataMax = values.length ? Math.max(...values) : 1;
  const yMin = targetRange ? Math.min(dataMin, targetRange[0]) : dataMin;
  const yMax = targetRange ? Math.max(dataMax, targetRange[1]) : dataMax;
  const ySpan = yMax - yMin || 1;
  const padded = [yMin - ySpan * 0.1, yMax + ySpan * 0.1];

  return (
    <Box ref={ ref } sx={ { width: '100%', position: 'relative', touchAction: 'pan-y' } }>
      { /* Translucent green target band, drawn behind the chart */ }
      { targetRange && (
        <Box
          sx={ {
            position: 'absolute',
            // The chart has a left margin (~38px) for axis labels and a bottom
            // margin (~32px) for x-axis labels — approximate the plot area
            // position here. Not pixel-perfect; the chart overlays this box.
            top: 12,
            bottom: 40,
            left: 38,
            right: 12,
            pointerEvents: 'none',
            // Vertical position within the plot area is computed by mapping
            // the target range to a percentage of [padded[0], padded[1]].
            background: (() => {
              const span = padded[1] - padded[0];
              const topPct = ((padded[1] - targetRange[1]) / span) * 100;
              const heightPct = ((targetRange[1] - targetRange[0]) / span) * 100;
              return `linear-gradient(to bottom,
                transparent 0%,
                transparent ${topPct}%,
                rgba(34, 197, 94, 0.18) ${topPct}%,
                rgba(34, 197, 94, 0.18) ${topPct + heightPct}%,
                transparent ${topPct + heightPct}%
              )`;
            })(),
          } }
        />
      ) }
      <LineChart
        width={ width }
        height={ height }
        // Left margin = room for y-axis labels (up to 3 digits like "100").
        // Previous config put labels on the right with position:'right' and
        // a 56px right margin, but MUI x-charts didn't honor that on every
        // build of the lib — labels rendered at x=0 and got clipped to just
        // the trailing digit (e.g. "60" → "0"). Putting them back on the
        // left with explicit margin is the boring known-good config.
        margin={ { top: 12, bottom: 32, left: 38, right: 12 } }
        colors={ [lineColor] }
        dataset={ data.map((p) => ({ ...p })) }
        xAxis={ [{
          dataKey: 'timestamp',
          scaleType: 'time',
          valueFormatter: (v) => fmtX(v as Date),
          tickLabelStyle: { fill: palette.text.tertiary, fontSize: 11 },
          stroke: 'transparent',
          tickSize: 0,
        }] }
        yAxis={ [{
          min: padded[0],
          max: padded[1],
          position: 'left',
          valueFormatter: fmtY,
          tickLabelStyle: { fill: palette.text.tertiary, fontSize: 11 },
          stroke: 'transparent',
          tickSize: 0,
        }] }
        grid={ { horizontal: true, vertical: true } }
        series={ [{
          dataKey: 'value',
          // Pre-aggregation upstream (VitalsLineChart.bucketAggregate) keeps
          // `data` at a sensible density, so we don't need a second-stage
          // every-Nth filter in here anymore. Show a marker per point.
          showMark: true,
          curve: 'linear',
          valueFormatter: (v) => (v == null ? '' : fmtY(v)),
        }] }
        sx={ {
          '& .MuiChartsAxis-line': { stroke: 'transparent' },
          '& .MuiChartsAxis-tick': { stroke: 'transparent' },
          '& .MuiChartsGrid-line': {
            stroke: 'rgba(255,255,255,0.06)',
            strokeDasharray: '2 4',
          },
          '& .MuiLineElement-root': {
            strokeWidth: 1.5,
          },
          '& .MuiMarkElement-root': {
            stroke: lineColor,
            strokeWidth: 1,
            fill: '#000',
            r: 1.5,
          },
          '& .MuiChartsLegend-root': { display: 'none' },
        } }
      />
    </Box>
  );
}
