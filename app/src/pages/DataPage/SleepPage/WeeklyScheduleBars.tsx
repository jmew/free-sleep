import { useMemo } from 'react';
import moment from 'moment-timezone';
import { Box, Typography } from '@mui/material';

import { useAppStore } from '@state/appStore.tsx';
import { useSleepRecords } from '@api/sleep.ts';
import MetricChartCard from '@design/MetricChartCard';
import { palette } from '@design/tokens';

// Default sleep target window (overnight), shown as a translucent green band.
// Could become a per-user setting later — keep static for now.
const TARGET_BEDTIME_HOUR = 22.5;   // 10:30 pm
const TARGET_WAKE_HOUR = 8.5;       // 8:30 am next morning

// Y-axis spans 8 pm → 11 am next morning (15 hours of "nighttime" view).
const VIEW_START_HOUR = 20;
const VIEW_HOURS = 15;  // 8pm → 11am next day

// Convert a moment to its position on our 8pm→11am axis as a fraction [0..1].
// Same-day evenings (>= 20) → 0..0.27ish. Next-morning hours (< 11) → 0.27..1.
function hourToFraction(m: moment.Moment): number {
  const h = m.hour() + m.minute() / 60;
  const adjusted = h < VIEW_START_HOUR ? h + 24 : h;
  return Math.max(0, Math.min(1, (adjusted - VIEW_START_HOUR) / VIEW_HOURS));
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today'];

const TARGET_GREEN = '#22c55e';
const OUT_OF_TARGET_WHITE = 'rgba(255,255,255,0.85)';

function formatTime(m: moment.Moment | undefined): string {
  if (!m) return '—';
  const s = m.format('h:mma');
  // "10:30am" instead of "10:30 AM" to match the screenshot
  return s;
}

export default function WeeklyScheduleBars() {
  const { side } = useAppStore();

  // Pull sleep records for the past 7 nights + today (we look back enough
  // days to anchor the Mon–Today week and pick the right record per day).
  const startTime = moment().subtract(8, 'days').toISOString();
  const endTime = moment().add(1, 'day').toISOString();
  const { data: records } = useSleepRecords({ side, startTime, endTime });

  const { dayBars, latest } = useMemo(() => {
    if (!records || records.length === 0) return { dayBars: [], latest: undefined as any };

    // ISO-week starts Monday. The 7 days are: Mon..Sun where Sun = "Today"
    // in the screenshot OR using local days. Match the screenshot order:
    // Mon, Tue, Wed, Thu, Fri, Sat, Today (which would be the current day's
    // weekday). We anchor on today and walk back 6 days.
    const days: moment.Moment[] = [];
    for (let i = 6; i >= 0; i--) days.push(moment().startOf('day').subtract(i, 'days'));

    // For each day, find the sleep record that ENDED on that day (the night
    // before counts toward the morning's day).
    const bars = days.map((day) => {
      const matching = records.find((r) => moment(r.left_bed_at).isSame(day, 'day'));
      if (!matching) return { day, bedtime: undefined, wake: undefined };
      return {
        day,
        bedtime: moment(matching.entered_bed_at),
        wake: moment(matching.left_bed_at),
      };
    });

    const latestRecord = records[records.length - 1];
    return { dayBars: bars, latest: latestRecord };
  }, [records]);

  // Header stat values. Latest record drives "ASLEEP / AWAKE".
  const asleep = latest ? formatTime(moment(latest.entered_bed_at)) : '—';
  const awake = latest ? formatTime(moment(latest.left_bed_at)) : '—';

  if (!dayBars.length) return null;

  // Target band fractions
  const targetTopFrac = hourToFraction(
    moment().hour(Math.floor(TARGET_BEDTIME_HOUR)).minute((TARGET_BEDTIME_HOUR % 1) * 60),
  );
  const targetBottomFrac = hourToFraction(
    moment().hour(Math.floor(TARGET_WAKE_HOUR)).minute((TARGET_WAKE_HOUR % 1) * 60).add(1, 'day'),
  );

  return (
    <MetricChartCard
      stats={ [
        { label: 'ASLEEP', value: asleep },
        { label: 'AWAKE', value: awake },
      ] }
    >
      <Box
        sx={ {
          position: 'relative',
          height: 220,
          mt: 1,
          mb: 0.5,
          mx: -0.5,
        } }
      >
        { /* Target window band (translucent green) */ }
        <Box
          sx={ {
            position: 'absolute',
            top: `${targetTopFrac * 100}%`,
            bottom: `${(1 - targetBottomFrac) * 100}%`,
            left: 0,
            right: 36,
            backgroundColor: 'rgba(34, 197, 94, 0.10)',
            borderTop: `1px dashed ${TARGET_GREEN}`,
            borderBottom: `1px dashed ${TARGET_GREEN}`,
          } }
        />
        { /* Target labels on the right */ }
        <Typography
          sx={ {
            position: 'absolute',
            top: `${targetTopFrac * 100}%`,
            right: 0,
            transform: 'translateY(-50%)',
            fontSize: '0.7rem',
            color: palette.text.tertiary,
          } }
        >
          { Math.floor(TARGET_BEDTIME_HOUR) }:{ String(Math.round((TARGET_BEDTIME_HOUR % 1) * 60)).padStart(2, '0') }pm
        </Typography>
        <Typography
          sx={ {
            position: 'absolute',
            top: `${targetBottomFrac * 100}%`,
            right: 0,
            transform: 'translateY(-50%)',
            fontSize: '0.7rem',
            color: palette.text.tertiary,
          } }
        >
          { Math.floor(TARGET_WAKE_HOUR) }:{ String(Math.round((TARGET_WAKE_HOUR % 1) * 60)).padStart(2, '0') }am
        </Typography>

        { /* Day bars */ }
        <Box
          sx={ {
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'stretch',
            position: 'absolute',
            inset: 0,
            paddingRight: '36px',
          } }
        >
          { dayBars.map((bar, i) => {
            const isToday = i === dayBars.length - 1;
            if (!bar.bedtime || !bar.wake) {
              return <Box key={ i } sx={ { flex: 1 } }/>;
            }
            const top = hourToFraction(bar.bedtime) * 100;
            const bottom = (1 - hourToFraction(bar.wake)) * 100;
            // "In target" = bedtime within 30 min of target AND wake within 30 min of target.
            const bedHour = bar.bedtime.hour() + bar.bedtime.minute() / 60;
            const wakeHour = bar.wake.hour() + bar.wake.minute() / 60;
            const adjustedBed = bedHour < VIEW_START_HOUR ? bedHour + 24 : bedHour;
            const adjustedWake = wakeHour < VIEW_START_HOUR ? wakeHour + 24 : wakeHour;
            const inTarget =
              Math.abs(adjustedBed - TARGET_BEDTIME_HOUR) <= 0.75 &&
              Math.abs(adjustedWake - (TARGET_WAKE_HOUR + 24)) <= 0.75;
            const color = inTarget ? TARGET_GREEN : OUT_OF_TARGET_WHITE;
            return (
              <Box
                key={ i }
                sx={ {
                  flex: 1,
                  position: 'relative',
                  display: 'flex',
                  justifyContent: 'center',
                } }
              >
                <Box
                  sx={ {
                    position: 'absolute',
                    top: `${top}%`,
                    bottom: `${bottom}%`,
                    width: 14,
                    backgroundColor: color,
                    borderRadius: 1.25,
                    boxShadow: isToday ? `0 0 0 1px ${color}` : 'none',
                  } }
                />
              </Box>
            );
          }) }
        </Box>
      </Box>

      { /* Day labels under the bars */ }
      <Box sx={ { display: 'flex', justifyContent: 'space-around', paddingRight: '36px', mt: 0.5 } }>
        { DAY_LABELS.map((label, i) => {
          const isToday = i === DAY_LABELS.length - 1;
          return (
            <Typography
              key={ i }
              sx={ {
                flex: 1,
                textAlign: 'center',
                fontSize: '0.85rem',
                color: isToday ? palette.text.primary : palette.text.tertiary,
                fontWeight: isToday ? 600 : 400,
              } }
            >
              { label }
            </Typography>
          );
        }) }
      </Box>
    </MetricChartCard>
  );
}
