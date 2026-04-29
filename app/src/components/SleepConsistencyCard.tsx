import { useMemo } from 'react';
import moment from 'moment-timezone';
import { Box, Typography } from '@mui/material';

import { SleepRecord } from '../../../server/src/db/sleepRecordsSchema.ts';
import GlassCard from '@design/GlassCard';
import { palette, typography } from '@design/tokens';

type Props = {
  /** Records covering at least the visible week. Records outside the week
   *  are ignored. */
  weekRecords?: SleepRecord[];
  /** Monday (start of isoWeek) of the week to render. */
  weekStart: moment.Moment;
};

const DAY_LETTERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Hours within ±this of the average bedtime/waketime are considered
// "in range" and color the bar green.
const TOLERANCE_HOURS = 0.5;

const TARGET_GREEN = '#22c55e';
const TARGET_GREEN_BAND = 'rgba(34,197,94,0.18)';

/** Hours-since-midnight, with morning hours pushed past 24 so a bedtime
 *  of 11:30pm sorts before a waketime of 7:30am on a single linear axis. */
function shiftedHour(iso: string): number {
  const m = moment(iso);
  const h = m.hour() + m.minute() / 60;
  return h < 12 ? h + 24 : h;
}

function avg(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** Format a shifted hour back to a "9:30am" / "11:30pm" label. */
function formatShiftedHour(h: number): string {
  const norm = ((h % 24) + 24) % 24;
  const hr = Math.floor(norm);
  const mn = Math.round((norm - hr) * 60);
  return moment().startOf('day').hour(hr).minute(mn).format('h:mma').toLowerCase();
}

export default function SleepConsistencyCard({ weekRecords, weekStart }: Props) {
  const view = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => weekStart.clone().add(i, 'day'));

    // A sleep record "belongs" to the day it ENDED on (the morning the user
    // woke up) — same convention WeekStrip uses.
    const matchedRecords = days.map((day) =>
      weekRecords?.find((r) => moment(r.left_bed_at).isSame(day, 'day')),
    );

    const present = matchedRecords
      .map((r, i) => ({ day: days[i], record: r }))
      .filter((d) => d.record);

    if (present.length === 0) {
      return null;
    }

    const times = present.map(({ record }) => ({
      bedH: shiftedHour(record!.entered_bed_at),
      wakeH: shiftedHour(record!.left_bed_at),
    }));

    const avgBed = avg(times.map((t) => t.bedH));
    const avgWake = avg(times.map((t) => t.wakeH));

    // Y axis spans [yMin .. yMax]. Pad ±0.5h so bars don't touch the edges.
    const yMin = Math.min(...times.map((t) => t.bedH), avgBed - TOLERANCE_HOURS) - 0.5;
    const yMax = Math.max(...times.map((t) => t.wakeH), avgWake + TOLERANCE_HOURS) + 0.5;

    const inRange = (t: { bedH: number; wakeH: number }) =>
      Math.abs(t.bedH - avgBed) <= TOLERANCE_HOURS &&
      Math.abs(t.wakeH - avgWake) <= TOLERANCE_HOURS;

    return {
      days,
      matchedRecords,
      times,
      avgBed,
      avgWake,
      yMin,
      yMax,
      inRange,
    };
  }, [weekRecords, weekStart]);

  if (!view) {
    return (
      <GlassCard label="CONSISTENCY">
        <Typography sx={ { ...typography.caption, color: palette.text.tertiary, textAlign: 'center', py: 4 } }>
          No sleep records in this week
        </Typography>
      </GlassCard>
    );
  }

  const { days, matchedRecords, times, avgBed, avgWake, yMin, yMax, inRange } = view;

  // SVG carries only the bars and bands — text labels are rendered as HTML
  // alongside the SVG so the SVG's `preserveAspectRatio="none"` stretch
  // doesn't distort the typography. The bars span the full viewBox width
  // (no PAD_LEFT/PAD_RIGHT) so the day labels rendered in an HTML flex row
  // below align perfectly with the bar centers.
  const VB_W = 1000;
  const VB_H = 200;
  const PAD_TOP = 12;
  const PAD_BOTTOM = 12;
  const plotH = VB_H - PAD_TOP - PAD_BOTTOM;
  const barWidth = 22;
  const CHART_HEIGHT = 150;
  const TIMES_COL_WIDTH = 60;

  const yOf = (h: number) => PAD_TOP + ((h - yMin) / (yMax - yMin)) * plotH;
  const xOf = (i: number) => (i + 0.5) * (VB_W / 7);

  const todayIdx = days.findIndex((d) => d.isSame(moment(), 'day'));

  const bedBandTop = yOf(avgBed - TOLERANCE_HOURS);
  const bedBandBot = yOf(avgBed + TOLERANCE_HOURS);
  const wakeBandTop = yOf(avgWake - TOLERANCE_HOURS);
  const wakeBandBot = yOf(avgWake + TOLERANCE_HOURS);
  // Vertical position of each band's center as a percentage of the chart
  // height — used to anchor the HTML time labels to the right of the SVG.
  const bedBandPct = (((bedBandTop + bedBandBot) / 2) / VB_H) * 100;
  const wakeBandPct = (((wakeBandTop + wakeBandBot) / 2) / VB_H) * 100;

  // Header text style — mirrors the page title's letter-spacing /
  // proportional digits so the times read at the same rhythm as the rest of
  // the app instead of feeling crammed together.
  const headerValueSx = {
    fontSize: { xs: '1.4rem', sm: '1.75rem' },
    fontWeight: 500,
    letterSpacing: '-0.02em',
    color: palette.text.primary,
    lineHeight: 1.1,
    whiteSpace: 'nowrap',
  } as const;

  return (
    <GlassCard>
      { /* Header stats: WEEKLY AVERAGE asleep / awake. Explicitly labeled
           "AVG" (was just "ASLEEP" / "AWAKE") because the previous labels
           read as today's times and clashed with the per-night Bedtime /
           Wake time on the fitness card right above. They're computed from
           bed-entry / bed-exit timestamps across the week, not detected
           sleep windows — so the weekly average will always be slightly
           earlier (bedtime) and later (waketime) than the fitness card's
           per-night detected onset/offset. */ }
      <Box sx={ { display: 'flex', gap: { xs: 3, sm: 5 }, mb: 1.5 } }>
        <Box>
          <Typography sx={ { ...typography.sectionLabel, color: palette.text.tertiary, mb: 0.25 } }>
            AVG ASLEEP
          </Typography>
          <Typography sx={ headerValueSx }>{ formatShiftedHour(avgBed) }</Typography>
        </Box>
        <Box>
          <Typography sx={ { ...typography.sectionLabel, color: palette.text.tertiary, mb: 0.25 } }>
            AVG AWAKE
          </Typography>
          <Typography sx={ headerValueSx }>{ formatShiftedHour(avgWake) }</Typography>
        </Box>
      </Box>

      <Box sx={ { width: '100%', touchAction: 'pan-y' } }>
        { /* Chart row: SVG bars/bands on the left, HTML time labels on the
             right (HTML so they don't get stretched by the SVG's
             preserveAspectRatio="none"). */ }
        <Box sx={ { display: 'flex', height: CHART_HEIGHT } }>
          <Box sx={ { flex: 1, position: 'relative', minWidth: 0 } }>
            <svg
              viewBox={ `0 0 ${VB_W} ${VB_H}` }
              preserveAspectRatio="none"
              style={ { display: 'block', width: '100%', height: '100%', touchAction: 'pan-y' } }
            >
              { /* Translucent green bands at the average bedtime + waketime */ }
              <rect
                x={ 0 } y={ bedBandTop }
                width={ VB_W } height={ Math.max(2, bedBandBot - bedBandTop) }
                fill={ TARGET_GREEN_BAND }
              />
              <rect
                x={ 0 } y={ wakeBandTop }
                width={ VB_W } height={ Math.max(2, wakeBandBot - wakeBandTop) }
                fill={ TARGET_GREEN_BAND }
              />

              { /* Dashed guide lines at the edges of each band */ }
              { [bedBandTop, bedBandBot, wakeBandTop, wakeBandBot].map((y, i) => (
                <line
                  key={ i }
                  x1={ 0 } x2={ VB_W }
                  y1={ y } y2={ y }
                  stroke="rgba(34,197,94,0.5)"
                  strokeWidth={ 1 }
                  strokeDasharray="4 4"
                />
              )) }

              { /* One vertical bar per day, only for days with a record */ }
              { days.map((_, i) => {
                const rec = matchedRecords[i];
                if (!rec) return null;
                const t = times[present(matchedRecords, i)];
                const top = yOf(t.bedH);
                const bot = yOf(t.wakeH);
                const x = xOf(i) - barWidth / 2;
                const fill = inRange(t) ? TARGET_GREEN : '#ffffff';
                return (
                  <rect
                    key={ i }
                    x={ x } y={ top }
                    width={ barWidth } height={ Math.max(4, bot - top) }
                    fill={ fill }
                    rx={ barWidth / 2 } ry={ barWidth / 2 }
                  />
                );
              }) }
            </svg>
          </Box>
          <Box sx={ { width: TIMES_COL_WIDTH, position: 'relative', flexShrink: 0, pl: 1 } }>
            <Typography
              sx={ {
                position: 'absolute',
                top: `${bedBandPct}%`,
                transform: 'translateY(-50%)',
                fontSize: '0.8rem',
                color: palette.text.tertiary,
                whiteSpace: 'nowrap',
              } }
            >
              { formatShiftedHour(avgBed) }
            </Typography>
            <Typography
              sx={ {
                position: 'absolute',
                top: `${wakeBandPct}%`,
                transform: 'translateY(-50%)',
                fontSize: '0.8rem',
                color: palette.text.tertiary,
                whiteSpace: 'nowrap',
              } }
            >
              { formatShiftedHour(avgWake) }
            </Typography>
          </Box>
        </Box>

        { /* Day labels: HTML row so the typography doesn't get stretched.
             Each cell uses flex: 1 so the centers line up with the SVG bar
             centers (which are at (i + 0.5) × VB_W / 7 with no left/right
             padding in the SVG). The right-side spacer matches the time
             labels column so the days only span the chart's width. */ }
        <Box sx={ { display: 'flex', mt: 0.5 } }>
          <Box sx={ { flex: 1, display: 'flex' } }>
            { days.map((day, i) => {
              const isToday = i === todayIdx;
              const label = isToday ? 'Today' : DAY_LETTERS[(day.isoWeekday() - 1)];
              return (
                <Typography
                  key={ i }
                  sx={ {
                    flex: 1,
                    textAlign: 'center',
                    fontSize: '0.8rem',
                    fontWeight: isToday ? 600 : 400,
                    color: isToday ? palette.text.primary : palette.text.tertiary,
                  } }
                >
                  { label }
                </Typography>
              );
            }) }
          </Box>
          <Box sx={ { width: TIMES_COL_WIDTH, flexShrink: 0 } } />
        </Box>
      </Box>
    </GlassCard>
  );
}

// `times` is filtered to records-present-only, so we need to map a day index
// back into that array. Tiny helper kept local to avoid widening the
// component's surface.
function present(matched: (SleepRecord | undefined)[], dayIdx: number): number {
  let count = 0;
  for (let i = 0; i < dayIdx; i++) {
    if (matched[i]) count++;
  }
  return count;
}
