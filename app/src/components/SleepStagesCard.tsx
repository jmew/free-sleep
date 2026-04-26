import { useMemo } from 'react';
import moment from 'moment-timezone';
import { Box, Typography } from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';

import { useAppStore } from '@state/appStore.tsx';
import { useSleepStages, SleepStage, StageEpoch } from '@api/sleepStages.ts';
import GlassCard from '@design/GlassCard';
import { palette, typography } from '@design/tokens';

type Props = {
  startTime: string;
  endTime: string;
};

// Visual config — colors picked to read clearly on a dark glass card and
// preserve the deep→light blue ramp of typical sleep-stage visualizations.
const STAGE_COLOR: Record<SleepStage, string> = {
  awake: '#e8eaed',  // near-white "interruption" segments
  rem:   '#7da6ff',  // light blue
  light: '#3b6cd6',  // medium blue
  deep:  '#1f4ed8',  // deep blue
};
// Y-axis position for each stage (0 = top, 1 = bottom)
const STAGE_Y: Record<SleepStage, number> = {
  awake: 0.10,
  rem:   0.34,
  light: 0.58,
  deep:  0.82,
};
const STAGE_LABEL: Record<SleepStage, string> = {
  awake: 'Sleep interruptions',
  rem:   'REM',
  light: 'Light',
  deep:  'Deep',
};

const TARGET_HOURS = [6.5, 9];   // "in range" band displayed under Time slept
const TARGET_GREEN = '#22c55e';
const TARGET_YELLOW = '#eab308';
const TARGET_RED = '#ef4444';

// Healthy adult sleep-stage targets, used to color the dot beside REM and
// Deep percentages. Sources cluster around: deep ~13–23%, REM ~20–25%.
// We use a single ramp:
//   green  = inside the healthy band
//   yellow = within 5pp of either edge of the band (slightly off)
//   red    = more than 5pp outside the band
const STAGE_HEALTH: Record<'rem' | 'deep', { lo: number; hi: number }> = {
  rem:  { lo: 20, hi: 25 },
  deep: { lo: 13, hi: 23 },
};

function stageDotColor(stage: 'rem' | 'deep', pct: number): string {
  const { lo, hi } = STAGE_HEALTH[stage];
  if (pct >= lo && pct <= hi) return TARGET_GREEN;
  if (pct >= lo - 5 && pct <= hi + 5) return TARGET_YELLOW;
  return TARGET_RED;
}

function formatHM(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

// Merge consecutive epochs of the same stage into a single segment so we
// don't render hundreds of overlapping blocks. e.g. ten 5-min Light epochs
// in a row → one 50-min Light segment.
function mergeAdjacent(epochs: StageEpoch[]): StageEpoch[] {
  if (epochs.length === 0) return [];
  const out: StageEpoch[] = [{ ...epochs[0] }];
  for (let i = 1; i < epochs.length; i++) {
    const prev = out[out.length - 1];
    const cur = epochs[i];
    // Treat a tiny gap (≤ 60s) as continuous — sometimes vitals records
    // arrive at slightly off-boundary timestamps.
    if (cur.stage === prev.stage && cur.startUnix - prev.endUnix <= 60) {
      prev.endUnix = cur.endUnix;
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

function StatBlock({
  label,
  duration,
  pct,
  dotColor,
}: {
  label: string;
  duration: string;
  pct: string;
  dotColor: string;
}) {
  return (
    <Box sx={ { minWidth: 0 } }>
      <Typography
        sx={ {
          fontSize: '0.95rem',
          color: palette.text.primary,
          fontWeight: 400,
          mb: 0.5,
        } }
      >
        { label }
      </Typography>
      <Box sx={ { display: 'flex', alignItems: 'baseline', gap: { xs: 0.75, sm: 1 } } }>
        <Typography
          sx={ {
            fontSize: { xs: '1.25rem', sm: '1.6rem' },
            fontWeight: 500,
            letterSpacing: '-0.01em',
            color: palette.text.primary,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.05,
            whiteSpace: 'nowrap',
          } }
        >
          { duration }
        </Typography>
        <Typography
          sx={ {
            fontSize: { xs: '0.9rem', sm: '1.1rem' },
            color: palette.text.primary,
            opacity: 0.85,
            fontWeight: 400,
            borderLeft: `1px solid ${palette.border.subtle}`,
            pl: { xs: 0.75, sm: 1 },
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            whiteSpace: 'nowrap',
          } }
        >
          { pct }
          <Box sx={ { width: 5, height: 5, borderRadius: '50%', backgroundColor: dotColor } }/>
        </Typography>
      </Box>
    </Box>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <Box sx={ { display: 'flex', alignItems: 'center', gap: 0.75 } }>
      <Box sx={ { width: 10, height: 10, borderRadius: 0.4, backgroundColor: color } }/>
      <Typography sx={ { fontSize: '0.8rem', color: palette.text.tertiary } }>{ label }</Typography>
    </Box>
  );
}

// SVG-based step chart. Each segment is a thick rounded horizontal line at
// its stage's Y; transitions between stages render as thin vertical lines
// connecting the previous segment's right edge to the next segment's left
// edge. This matches the "step waveform" look of the screenshot.
function StagesChart({ epochs, periodStart, periodEnd }: {
  epochs: StageEpoch[];
  periodStart: number;
  periodEnd: number;
}) {
  const VB_W = 1000;
  const VB_H = 200;
  const SEGMENT_THICKNESS = 14;
  const span = Math.max(1, periodEnd - periodStart);

  const xOf = (t: number) => ((t - periodStart) / span) * VB_W;
  const yOf = (stage: SleepStage) => STAGE_Y[stage] * VB_H;

  const merged = mergeAdjacent(epochs);

  return (
    <Box sx={ { width: '100%', mb: 1, touchAction: 'pan-y' } }>
      <svg
        viewBox={ `0 0 ${VB_W} ${VB_H}` }
        preserveAspectRatio="none"
        style={ { display: 'block', width: '100%', height: 200, touchAction: 'pan-y' } }
      >
        { /* Connecting vertical lines between adjacent segments of different stages */ }
        { merged.map((seg, i) => {
          if (i === 0) return null;
          const prev = merged[i - 1];
          if (prev.stage === seg.stage) return null;
          const x = xOf(seg.startUnix);
          const y1 = yOf(prev.stage);
          const y2 = yOf(seg.stage);
          // Use the destination stage's color for the connector (gives the
          // visual sense of "moving into" the new stage).
          return (
            <line
              key={ `c-${i}` }
              x1={ x } y1={ y1 } x2={ x } y2={ y2 }
              stroke={ STAGE_COLOR[seg.stage] }
              strokeWidth={ 1.5 }
              strokeOpacity={ 0.55 }
            />
          );
        }) }

        { /* Stage segments — Awake renders as a tall thin bar reaching the top edge */ }
        { merged.map((seg, i) => {
          const x = xOf(seg.startUnix);
          const w = Math.max(2, xOf(seg.endUnix) - xOf(seg.startUnix));
          const color = STAGE_COLOR[seg.stage];
          if (seg.stage === 'awake') {
            // From the top of the chart down to the awake row.
            const top = 0;
            const bottom = yOf('awake') + SEGMENT_THICKNESS / 2;
            return (
              <rect
                key={ i }
                x={ x } y={ top } width={ w } height={ bottom - top }
                fill={ color }
                opacity={ 0.85 }
                rx={ 1.5 } ry={ 1.5 }
              />
            );
          }
          const y = yOf(seg.stage) - SEGMENT_THICKNESS / 2;
          return (
            <rect
              key={ i }
              x={ x } y={ y } width={ w } height={ SEGMENT_THICKNESS }
              fill={ color }
              rx={ 4 } ry={ 4 }
            />
          );
        }) }
      </svg>
    </Box>
  );
}

// eslint-disable-next-line react/no-multi-comp
export default function SleepStagesCard({ startTime, endTime }: Props) {
  const { side } = useAppStore();
  const { data, isFetching } = useSleepStages({ side, startTime, endTime });

  const periodStart = moment(startTime).unix();
  const periodEnd = moment(endTime).unix();

  // "Time slept" = total time in the period MINUS the time classified as
  // awake. So lying in bed scrolling on the phone after the alarm doesn't
  // count toward your sleep total. Falls back to period length when stage
  // data is missing.
  const totalDurationSeconds = useMemo(() => {
    const period = Math.max(0, periodEnd - periodStart);
    if (!data) return period;
    const awake = data.totals.awake || 0;
    return Math.max(0, period - awake);
  }, [data, periodEnd, periodStart]);
  const totalDuration = formatHM(totalDurationSeconds);
  const totalHours = totalDurationSeconds / 3600;
  const inRange = totalHours >= TARGET_HOURS[0] && totalHours <= TARGET_HOURS[1];

  return (
    <GlassCard label="SLEEP">
      { isFetching && <CircularProgress sx={ { display: 'block', mx: 'auto', my: 4 } } /> }

      { !isFetching && data && data.epochs.length > 0 && (
        <>
          <Box sx={ { display: 'flex', gap: { xs: 2.5, sm: 5 }, mb: 2.5, flexWrap: 'wrap' } }>
            <StatBlock
              label="Deep sleep"
              duration={ formatHM(data.totals.deep) }
              pct={ `${data.percentages.deep}%` }
              dotColor={ stageDotColor('deep', data.percentages.deep) }
            />
            <StatBlock
              label="REM"
              duration={ formatHM(data.totals.rem) }
              pct={ `${data.percentages.rem}%` }
              dotColor={ stageDotColor('rem', data.percentages.rem) }
            />
          </Box>

          <StagesChart
            epochs={ data.epochs }
            periodStart={ periodStart }
            periodEnd={ periodEnd }
          />

          { /* X-axis time labels */ }
          <Box sx={ { display: 'flex', justifyContent: 'space-between', mb: 2 } }>
            { [0, 0.33, 0.66, 1].map((frac, i) => {
              const t = periodStart + frac * (periodEnd - periodStart);
              return (
                <Typography
                  key={ i }
                  sx={ { fontSize: '0.75rem', color: palette.text.tertiary, fontVariantNumeric: 'tabular-nums' } }
                >
                  { moment.unix(t).format('h:mm A') }
                </Typography>
              );
            }) }
          </Box>

          <Box
            sx={ {
              display: 'flex',
              gap: 2,
              flexWrap: 'wrap',
              justifyContent: 'center',
              borderTop: `1px solid ${palette.border.subtle}`,
              borderBottom: `1px solid ${palette.border.subtle}`,
              py: 1.5,
              mb: 2,
            } }
          >
            <LegendItem color={ STAGE_COLOR.awake } label={ STAGE_LABEL.awake } />
            <LegendItem color={ STAGE_COLOR.rem }   label={ STAGE_LABEL.rem } />
            <LegendItem color={ STAGE_COLOR.light } label={ STAGE_LABEL.light } />
            <LegendItem color={ STAGE_COLOR.deep }  label={ STAGE_LABEL.deep } />
          </Box>

          <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5 } }>
            <Typography sx={ { fontSize: '1.05rem', fontWeight: 600, color: palette.text.primary } }>
              Time slept
            </Typography>
            <Box sx={ { textAlign: 'right' } }>
              <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.75 } }>
                <Typography
                  sx={ {
                    fontSize: '1.4rem',
                    fontWeight: 500,
                    color: palette.text.primary,
                    fontVariantNumeric: 'tabular-nums',
                  } }
                >
                  { totalDuration }
                </Typography>
                <Box
                  sx={ {
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: inRange ? TARGET_GREEN : palette.accent.orange,
                  } }
                />
              </Box>
              <Typography sx={ { fontSize: '0.8rem', color: palette.text.tertiary, mt: 0.25 } }>
                { inRange ? `In range (${TARGET_HOURS[0]}–${TARGET_HOURS[1]})` : `Out of range (${TARGET_HOURS[0]}–${TARGET_HOURS[1]})` }
              </Typography>
            </Box>
          </Box>
        </>
      ) }

      { !isFetching && (!data || data.epochs.length === 0) && (
        <Typography sx={ { ...typography.caption, color: palette.text.tertiary, textAlign: 'center', py: 4 } }>
          No sleep stages data available for this period
        </Typography>
      ) }
    </GlassCard>
  );
}
