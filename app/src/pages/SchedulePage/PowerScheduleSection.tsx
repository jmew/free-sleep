import { Box, InputAdornment, Slider, TextField, Typography } from '@mui/material';
import GlassCard from '@design/GlassCard';
import { useAppStore } from '@state/appStore.tsx';
import { useScheduleStore } from './scheduleStore.tsx';
import {
  formatTemperature,
  getTemperatureColor,
  MAX_TEMP_F,
  MIN_TEMP_F,
  MAX_TEMP_LEVEL,
  MIN_TEMP_LEVEL,
  fahrenheitToLevel,
  levelToFahrenheit,
} from '@lib/temperatureConversions.ts';
import PowerOffTime from './PowerOffTime.tsx';
import AccessTime from '@mui/icons-material/AccessTime';
import { useTheme } from '@mui/material/styles';

export default function PowerScheduleSection({ displayCelsius }: { displayCelsius: boolean }) {
  const { isUpdating } = useAppStore();
  const theme = useTheme();
  const { selectedSchedule, updateSelectedSchedule } = useScheduleStore();
  const disabled = !selectedSchedule?.power.enabled || isUpdating;
  const onTemperatureValue = selectedSchedule?.power?.onTemperature || 82;
  return (
    <GlassCard sx={ { pt: 2, pl: 4, pr: 4, pb: 2 } }>
      <Box sx={ { display: 'flex', alignItems: 'center', gap: 3, p: 0, width: '100%', mb: 3 } }>
        { /* Start time */ }
        <TextField
          label="Power on"
          type="time"
          variant="standard"
          value={ selectedSchedule?.power.on || '21:00' }
          disabled={ disabled }
          onChange={ (event) => {
            updateSelectedSchedule({
              power: {
                on: event.target.value,
              }
            });
          } }
          sx={ {
            width: '110px',
            // Hide native indicator (where it exists)
            '& input::-webkit-calendar-picker-indicator': {
              opacity: 0,
              display: 'none',
            },
          } }
          InputProps={ {
            endAdornment: (
              <InputAdornment position="end" sx={ { cursor: 'pointer' } } >
                <AccessTime sx={ { color: theme.palette.grey[500] } } fontSize='small'/>
              </InputAdornment>
            ),
          } }
        />
        <PowerOffTime/>
      </Box>
      { /* Temperature slider */ }
      <Box sx={ { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, flex: 1, pr: 1 } }>
        { /* Temperature label */ }
        <Typography sx={ { mb: 0, textAlign: 'center' } } variant="body2" color={ theme.palette.grey[200] }>
          { `Power on temperature ${formatTemperature(selectedSchedule?.power?.onTemperature || 82, displayCelsius)}` }
        </Typography>
        { /* In level mode the slider operates in level units (-10..+10, step 1)
             and converts to/from F for storage. In F mode it stays at 1°F steps.
             Storage in onTemperature is always F. */ }
        <Slider
          value={ displayCelsius ? fahrenheitToLevel(onTemperatureValue) : onTemperatureValue }

          onChange={ (_, newValue) => {
            const num = newValue as number;
            const asF = displayCelsius ? levelToFahrenheit(num) : num;
            updateSelectedSchedule({
              power: {
                // @ts-ignore
                onTemperature: asF,
              }
            });
          } }
          min={ displayCelsius ? MIN_TEMP_LEVEL : MIN_TEMP_F }
          max={ displayCelsius ? MAX_TEMP_LEVEL : MAX_TEMP_F }
          step={ 1 }
          marks={ [
            {
              value: displayCelsius ? MIN_TEMP_LEVEL : MIN_TEMP_F,
              label: formatTemperature(MIN_TEMP_F, displayCelsius),
            },
            {
              value: displayCelsius ? MAX_TEMP_LEVEL : MAX_TEMP_F,
              label: formatTemperature(MAX_TEMP_F, displayCelsius),
            },
          ] }
          disabled={ disabled }
          sx={ {
            color: getTemperatureColor(onTemperatureValue),
            width: '100%',
            '& .MuiSlider-markLabel': {
              color: theme.palette.grey[500],
              fontSize: '0.75rem',
              fontWeight: 500,
            },
          } }
        />
      </Box>
    </GlassCard>
  );
}
