import moment from 'moment-timezone';
import { Box, Typography, Card } from '@mui/material';
import AccessAlarmIcon from '@mui/icons-material/AccessAlarm';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';

import { useSchedules } from '@api/schedules.ts';
import { useSettings } from '@api/settings.ts';
import { useAppStore } from '@state/appStore.tsx';
import { glassCard, sectionLabel } from './cardStyles';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

type Event = {
  time: moment.Moment;
  label: string;        // "Bedtime", time string
  detail: string;       // "72°F", icon role
  icon?: React.ReactNode;
  isPast: boolean;
};

function buildEvents(
  schedules: any,
  side: 'left' | 'right',
  tz: string,
  now: moment.Moment,
): Event[] {
  if (!schedules?.[side]) return [];
  const events: Event[] = [];

  // Look at today and tomorrow so we cover overnight schedules.
  for (let dayOffset = 0; dayOffset < 2; dayOffset++) {
    const day = now.clone().add(dayOffset, 'day');
    const dayName = DAY_NAMES[day.day()];
    const daily = schedules[side]?.[dayName];
    if (!daily) continue;

    // Power on/off
    if (daily.power?.enabled) {
      const onTime = day.clone().tz(tz).set({ hour: parseInt(daily.power.on.split(':')[0]), minute: parseInt(daily.power.on.split(':')[1]), second: 0 });
      const offTime = day.clone().tz(tz).set({ hour: parseInt(daily.power.off.split(':')[0]), minute: parseInt(daily.power.off.split(':')[1]), second: 0 });
      // If off is "earlier" in clock terms than on (e.g., on=22:00, off=06:00), it's the next morning.
      const adjOff = offTime.isBefore(onTime) ? offTime.add(1, 'day') : offTime;
      events.push({
        time: onTime,
        label: 'Bedtime',
        detail: `${daily.power.onTemperature}°`,
        icon: <PowerSettingsNewIcon sx={ { fontSize: 14 } }/>,
        isPast: onTime.isBefore(now),
      });
      events.push({
        time: adjOff,
        label: 'Off',
        detail: '',
        icon: <PowerSettingsNewIcon sx={ { fontSize: 14, opacity: 0.5 } }/>,
        isPast: adjOff.isBefore(now),
      });
    }

    // Temperature changes during the night
    Object.entries(daily.temperatures || {}).forEach(([time, tempVal]) => {
      const [h, m] = time.split(':').map(Number);
      const t = day.clone().tz(tz).set({ hour: h, minute: m, second: 0 });
      events.push({
        time: t,
        label: t.format('h:mm A'),
        detail: `${tempVal}°`,
        isPast: t.isBefore(now),
      });
    });

    // Alarm
    if (daily.alarm?.enabled) {
      const [h, m] = daily.alarm.time.split(':').map(Number);
      const aTime = day.clone().tz(tz).set({ hour: h, minute: m, second: 0 });
      events.push({
        time: aTime,
        label: 'Alarm',
        detail: aTime.format('h:mm A'),
        icon: <AccessAlarmIcon sx={ { fontSize: 14 } }/>,
        isPast: aTime.isBefore(now),
      });
    }
  }

  // Sort and keep only events from "now - 1h" forward, capped at next 18 hours.
  const cutoffStart = now.clone().subtract(1, 'hour');
  const cutoffEnd = now.clone().add(18, 'hours');
  return events
    .filter((e) => e.time.isAfter(cutoffStart) && e.time.isBefore(cutoffEnd))
    .sort((a, b) => a.time.valueOf() - b.time.valueOf());
}

// eslint-disable-next-line react/no-multi-comp
export default function TonightCard() {
  const { side } = useAppStore();
  const { data: schedules } = useSchedules();
  const { data: settings } = useSettings();
  const tz = settings?.timeZone || moment.tz.guess();
  const now = moment.tz(tz);
  const events = buildEvents(schedules, side, tz, now);

  if (events.length === 0) return null;

  return (
    <Card sx={ glassCard } elevation={ 0 }>
      <Typography sx={ sectionLabel }>Tonight</Typography>
      <Box
        sx={ {
          display: 'flex',
          gap: 1,
          overflowX: 'auto',
          pb: 0.5,
          mx: -2.5,
          px: 2.5,
          // Hide scrollbar but keep functionality
          '&::-webkit-scrollbar': { display: 'none' },
          scrollbarWidth: 'none',
        } }
      >
        { events.map((e, i) => (
          <Box
            key={ i }
            sx={ {
              minWidth: 80,
              p: 1.25,
              borderRadius: 2.5,
              backgroundColor: e.isPast ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.05)',
              opacity: e.isPast ? 0.45 : 1,
              flexShrink: 0,
              textAlign: 'center',
            } }
          >
            <Typography
              sx={ {
                fontSize: '0.7rem',
                color: 'rgba(255,255,255,0.5)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                mb: 0.25,
              } }
            >
              { e.time.format('h:mm A') }
            </Typography>
            <Typography
              sx={ {
                fontSize: '1.15rem',
                fontWeight: 500,
                color: 'rgba(255,255,255,0.9)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.5,
              } }
            >
              { e.icon }
              { e.detail || e.label }
            </Typography>
            { e.detail && e.label !== e.time.format('h:mm A') && (
              <Typography sx={ { fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', mt: 0.25 } }>
                { e.label }
              </Typography>
            ) }
          </Box>
        )) }
      </Box>
    </Card>
  );
}
