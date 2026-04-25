import { useMemo } from 'react';
import moment from 'moment-timezone';
import { Box, Typography } from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';

import { useAppStore } from '@state/appStore.tsx';
import { useSleepStages, SleepStage } from '@api/sleepStages.ts';
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

function formatHM(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function StatBlock({
  label,
  duration,
  pct,
  subtext,
}: {
  label: string;
  duration: string;
  pct: string;
  subtext?: string;
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
      <Box sx={ { display: 'flex', alignItems: 'baseline', gap: 1 } }>
        <Typography
          sx={ {
            fontSize: '1.6rem',
            fontWeight: 500,
            letterSpacing: '-0.01em',
            color: palette.text.primary,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.05,
          } }
        >
          { duration }
        </Typography>
        <Typography
          sx={ {
            fontSize: '1.1rem',
            color: palette.text.primary,
            opacity: 0.85,
            fontWeight: 400,
            borderLeft: `1px solid ${palette.border.subtle}`,
            pl: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
          } }
        >
          { pct }
          <Box sx={ { width: 5, height: 5, borderRadius: '50%', backgroundColor: TARGET_GREEN } }/>
        </Typography>
      </Box>
      { subtext && (
        <Typography sx={ { fontSize: '0.85rem', color: palette.text.tertiary, mt: 0.25 } }>
          { subtext }
        </Typography>
      ) }
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

// eslint-disable-next-line react/no-multi-comp
export default function SleepStagesCard({ startTime, endTime }: Props) {
  const { side } = useAppStore();
  const { data, isFetching } = useSleepStages({ side, startTime, endTime });

  // Compute the chart layout in advance.
  const chart = useMemo(() => {
    if (!data || data.epochs.length === 0) return null;
    const periodStart = moment(startTime).unix();
    const periodEnd = moment(endTime).unix();
    const span = Math.max(1, periodEnd - periodStart);

    const segments = data.epochs.map((e) => {
      const leftPct = ((e.startUnix - periodStart) / span) * 100;
      const widthPct = ((e.endUnix - e.startUnix) / span) * 100;
      return { stage: e.stage, leftPct, widthPct };
    });

    return { segments, periodStart, periodEnd };
  }, [data, startTime, endTime]);

  const totalDuration = data ? formatHM(data.totalSeconds) : '—';
  const totalHours = data ? data.totalSeconds / 3600 : 0;
  const inRange = totalHours >= TARGET_HOURS[0] && totalHours <= TARGET_HOURS[1];

  return (
    <GlassCard label="SLEEP">
      { isFetching && <CircularProgress sx={ { display: 'block', mx: 'auto', my: 4 } } /> }

      { !isFetching && data && (
        <>
          { /* Two stat blocks: Deep sleep + REM */ }
          <Box sx={ { display: 'flex', gap: 5, mb: 2.5, flexWrap: 'wrap' } }>
            <StatBlock
              label="Deep sleep"
              duration={ formatHM(data.totals.deep) }
              pct={ `${data.percentages.deep}%` }
              subtext={ `At ${data.percentages.deep}%` }
            />
            <StatBlock
              label="REM"
              duration={ formatHM(data.totals.rem) }
              pct={ `${data.percentages.rem}%` }
              subtext={ `Over ${data.percentages.rem}%` }
            />
          </Box>

          { /* Stages chart — segments positioned absolute over a fixed-height area */ }
          { chart && (
            <Box sx={ { position: 'relative', height: 200, mb: 1 } }>
              { chart.segments.map((s, i) => {
                const yCenter = STAGE_Y[s.stage] * 100;
                const isAwake = s.stage === 'awake';
                // Awake segments get rendered as tall thin vertical lines extending
                // upward from the body of the chart, similar to the screenshot.
                if (isAwake) {
                  return (
                    <Box
                      key={ i }
                      sx={ {
                        position: 'absolute',
                        left: `${s.leftPct}%`,
                        width: `${Math.max(0.4, s.widthPct)}%`,
                        top: 0,
                        bottom: `${100 - yCenter - 4}%`,
                        backgroundColor: STAGE_COLOR.awake,
                        opacity: 0.85,
                      } }
                    />
                  );
                }
                return (
                  <Box
                    key={ i }
                    sx={ {
                      position: 'absolute',
                      left: `${s.leftPct}%`,
                      width: `${s.widthPct}%`,
                      top: `${yCenter - 6}%`,
                      height: '12%',
                      backgroundColor: STAGE_COLOR[s.stage],
                      borderRadius: 1.5,
                    } }
                  />
                );
              }) }
            </Box>
          ) }

          { /* X-axis time labels */ }
          { chart && (
            <Box sx={ { display: 'flex', justifyContent: 'space-between', mb: 2 } }>
              { [0, 0.33, 0.66, 1].map((frac, i) => {
                const t = chart.periodStart + frac * (chart.periodEnd - chart.periodStart);
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
          ) }

          { /* Legend */ }
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

          { /* Bottom: Time slept + In range */ }
          <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5 } }>
            <Typography
              sx={ {
                fontSize: '1.05rem',
                fontWeight: 600,
                color: palette.text.primary,
              } }
            >
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

      { !isFetching && !data && (
        <Typography sx={ { ...typography.caption, color: palette.text.tertiary, textAlign: 'center', py: 4 } }>
          No sleep data available for this period
        </Typography>
      ) }
    </GlassCard>
  );
}
