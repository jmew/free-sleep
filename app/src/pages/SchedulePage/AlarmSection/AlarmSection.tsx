import React from 'react';
import { Box, SxProps, Typography } from '@mui/material';
import AlarmIcon from '@mui/icons-material/Alarm';

import GlassCard from '@design/GlassCard';
import { palette } from '@design/tokens';
import { useScheduleStore } from '../scheduleStore.tsx';
import AlarmEnabledSwitch from './AlarmEnabledSwitch.tsx';
import AlarmTime from './AlarmTime.tsx';
import AlarmVibrationSlider from './AlarmVibrationSlider.tsx';
import AlarmDuration from './AlarmDuration.tsx';
import AlarmPattern from './AlarmPattern.tsx';
import AlarmTest from './AlarmTest.tsx';

const Row = ({ children, sx }: React.PropsWithChildren<{ sx?: SxProps }>) => (
  <Box
    sx={ {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      mb: 2,
      gap: 1,
      ...sx,
    } }
  >
    { children }
  </Box>
);

// eslint-disable-next-line react/no-multi-comp
export default function AlarmSection() {
  const { selectedSchedule } = useScheduleStore();
  const disabled = !selectedSchedule?.power.enabled;
  const alarmEnabled = !!selectedSchedule?.alarm.enabled;

  return (
    <GlassCard sx={ { opacity: disabled ? 0.55 : 1, transition: 'opacity 0.15s' } }>
      <Box sx={ { display: 'flex', alignItems: 'center', gap: 1.25, mb: 2 } }>
        <AlarmIcon sx={ { color: palette.text.primary } } />
        <Typography
          sx={ {
            fontSize: '1.1rem',
            fontWeight: 600,
            color: palette.text.primary,
          } }
        >
          Vibration alarm
        </Typography>
      </Box>

      <Row>
        <AlarmEnabledSwitch />
        { alarmEnabled && <AlarmTime /> }
      </Row>

      { alarmEnabled && (
        <>
          <Row>
            <AlarmDuration />
            <AlarmPattern />
          </Row>
          <Row sx={ { ml: 1, mr: 1 } }>
            <AlarmVibrationSlider />
          </Row>
          <AlarmTest />
        </>
      ) }
    </GlassCard>
  );
}
