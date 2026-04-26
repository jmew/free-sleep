import { Box, InputAdornment, Slider, TextField, Typography } from '@mui/material';
import AccessTime from '@mui/icons-material/AccessTime';
import BoltIcon from '@mui/icons-material/Bolt';
import { useTheme } from '@mui/material/styles';

import GlassCard from '@design/GlassCard';
import { palette } from '@design/tokens';
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
import EnabledSwitch from './EnabledSwitch.tsx';

type Props = {
  displayCelsius: boolean;
};

// Wide enough for a full "09:50 PM" tick label plus the trailing clock icon
// adornment without truncation on Safari iOS (which renders 12-hour times in
// the native time input).
const TIME_FIELD_WIDTH = 130;

export default function PowerScheduleSection({ displayCelsius }: Props) {
  const { isUpdating } = useAppStore();
  const theme = useTheme();
  const { selectedSchedule, updateSelectedSchedule } = useScheduleStore();
  const disabled = !selectedSchedule?.power.enabled || isUpdating;
  const onTemperatureValue = selectedSchedule?.power?.onTemperature || 82;

  const tempLabel = formatTemperature(onTemperatureValue, displayCelsius);

  return (
    <GlassCard sx={ { opacity: !selectedSchedule?.power.enabled ? 0.55 : 1, transition: 'opacity 0.15s' } }>
      <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 } }>
        <Box sx={ { display: 'flex', alignItems: 'center', gap: 1.25 } }>
          <BoltIcon sx={ { color: palette.text.primary } } />
          <Typography
            sx={ { fontSize: '1.1rem', fontWeight: 600, color: palette.text.primary } }
          >
            Power schedule
          </Typography>
        </Box>
        <EnabledSwitch />
      </Box>

      { /* Inline preview: "21:00 → 09:00 · 72°F" so the user can read the
           whole schedule at a glance without parsing three controls. */ }
      <Typography
        sx={ {
          fontSize: '0.85rem',
          color: palette.text.tertiary,
          mb: 2,
          fontVariantNumeric: 'tabular-nums',
        } }
      >
        { selectedSchedule?.power.on || '--:--' } &nbsp;→&nbsp; { selectedSchedule?.power.off || '--:--' }
        &nbsp;·&nbsp; { tempLabel }
      </Typography>

      <Box sx={ { display: 'flex', alignItems: 'flex-end', gap: 2, mb: 2.5, flexWrap: 'wrap' } }>
        <TextField
          label="On"
          type="time"
          variant="standard"
          value={ selectedSchedule?.power.on || '21:00' }
          disabled={ disabled }
          onChange={ (event) => {
            updateSelectedSchedule({ power: { on: event.target.value } });
          } }
          sx={ {
            width: TIME_FIELD_WIDTH,
            '& input::-webkit-calendar-picker-indicator': { opacity: 0, display: 'none' },
          } }
          InputProps={ {
            endAdornment: (
              <InputAdornment position="end" sx={ { cursor: 'pointer' } }>
                <AccessTime sx={ { color: theme.palette.grey[500] } } fontSize="small" />
              </InputAdornment>
            ),
          } }
        />
        <PowerOffTime />
      </Box>

      <Box sx={ { display: 'flex', flexDirection: 'column', gap: 0.75, pr: 1 } }>
        <Box sx={ { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' } }>
          <Typography sx={ { fontSize: '0.85rem', color: palette.text.secondary } }>
            Power-on temperature
          </Typography>
          <Typography
            sx={ {
              fontSize: '0.95rem',
              fontWeight: 600,
              color: getTemperatureColor(onTemperatureValue),
              fontVariantNumeric: 'tabular-nums',
            } }
          >
            { tempLabel }
          </Typography>
        </Box>
        <Slider
          value={ displayCelsius ? fahrenheitToLevel(onTemperatureValue) : onTemperatureValue }
          onChange={ (_, newValue) => {
            const num = newValue as number;
            const asF = displayCelsius ? levelToFahrenheit(num) : num;
            // @ts-ignore
            updateSelectedSchedule({ power: { onTemperature: asF } });
          } }
          min={ displayCelsius ? MIN_TEMP_LEVEL : MIN_TEMP_F }
          max={ displayCelsius ? MAX_TEMP_LEVEL : MAX_TEMP_F }
          step={ 1 }
          marks={ [
            { value: displayCelsius ? MIN_TEMP_LEVEL : MIN_TEMP_F, label: formatTemperature(MIN_TEMP_F, displayCelsius) },
            { value: displayCelsius ? MAX_TEMP_LEVEL : MAX_TEMP_F, label: formatTemperature(MAX_TEMP_F, displayCelsius) },
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
