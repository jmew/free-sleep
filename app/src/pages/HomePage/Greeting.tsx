import moment from 'moment-timezone';
import { Box, Typography } from '@mui/material';
import { useSettings } from '@api/settings.ts';
import { useAppStore } from '@state/appStore.tsx';

function greetingFor(hour: number): string {
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Greeting() {
  const { side } = useAppStore();
  const { data: settings } = useSettings();
  const tz = settings?.timeZone || moment.tz.guess();
  const now = moment.tz(tz);
  const greeting = greetingFor(now.hour());
  const name = settings?.[side]?.name;
  const date = now.format('dddd, MMMM D');

  return (
    <Box sx={ { width: '100%', mb: 1 } }>
      <Typography
        sx={ {
          fontSize: '1.75rem',
          fontWeight: 300,
          letterSpacing: '-0.02em',
          color: 'rgba(255,255,255,0.95)',
          lineHeight: 1.15,
        } }
      >
        { greeting }{ name ? `, ${name}` : '' }
      </Typography>
      <Typography
        sx={ {
          fontSize: '0.95rem',
          color: 'rgba(255,255,255,0.45)',
          mt: 0.25,
        } }
      >
        { date }
      </Typography>
    </Box>
  );
}
