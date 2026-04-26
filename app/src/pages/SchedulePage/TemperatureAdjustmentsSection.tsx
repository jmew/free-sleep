import {
  Box,
  Button,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { Add, Remove } from '@mui/icons-material';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import AccessTime from '@mui/icons-material/AccessTime';
import _ from 'lodash';
import moment from 'moment-timezone';
import { useTheme } from '@mui/material/styles';

import GlassCard from '@design/GlassCard';
import { palette } from '@design/tokens';
import { useAppStore } from '@state/appStore.tsx';
import { useScheduleStore } from './scheduleStore.tsx';
import { DailySchedule } from '@api/schedulesSchema.ts';
import { formatTemperature, levelToFahrenheit } from '@lib/temperatureConversions.ts';

const TEMPERATURES_LIST_F = _.range(55, 111);
const TEMPERATURES_LIST_LEVEL = _.range(-10, 11).map((lvl) => levelToFahrenheit(lvl));

type Props = {
  displayCelsius: boolean;
};

export default function TemperatureAdjustmentsSection({ displayCelsius }: Props) {
  const {
    selectedSchedule,
    updateSelectedSchedule,
    updateSelectedTemperatures,
  } = useScheduleStore();
  const { isUpdating } = useAppStore();
  const theme = useTheme();
  const disabled = !selectedSchedule?.power.enabled;

  const addSchedule = () => {
    if (!selectedSchedule) return;
    const scheduleKeys = Object.keys(selectedSchedule.temperatures);
    const lastTime = scheduleKeys.length > 0
      ? moment(scheduleKeys[scheduleKeys.length - 1], 'HH:mm')
      : moment(selectedSchedule.power.on, 'HH:mm');
    const nextTime = lastTime.add(1, 'hour').format('HH:mm');

    if (!scheduleKeys.includes(nextTime)) {
      updateSelectedSchedule({
        temperatures: {
          ...selectedSchedule.temperatures,
          [nextTime]: 70,
        },
      });
    }
  };

  const handleUpdateTime = (oldTime: string, newTime: string) => {
    if (!selectedSchedule) return;
    const existingTemperature = selectedSchedule.temperatures[oldTime];
    const temperaturesCopy: DailySchedule['temperatures'] = { ...selectedSchedule.temperatures };
    delete temperaturesCopy[oldTime];
    temperaturesCopy[newTime] = existingTemperature;
    updateSelectedTemperatures(temperaturesCopy);
  };

  const handleUpdateTemperature = (time: string, temperature: number) => {
    if (!selectedSchedule) return;
    const temperaturesCopy: DailySchedule['temperatures'] = { ...selectedSchedule.temperatures };
    temperaturesCopy[time] = temperature;
    updateSelectedTemperatures(temperaturesCopy);
  };

  const deleteTime = (time: string) => {
    if (!selectedSchedule) return;
    const temperaturesCopy: DailySchedule['temperatures'] = { ...selectedSchedule.temperatures };
    delete temperaturesCopy[time];
    updateSelectedTemperatures(temperaturesCopy);
  };

  const isTimeValid = (time: string): boolean => {
    if (!selectedSchedule) return false;
    const timeMoment = moment(time, 'HH:mm');
    const powerOnMoment = moment(selectedSchedule.power.on, 'HH:mm');
    const powerOffMoment = moment(selectedSchedule.power.off, 'HH:mm');

    if (powerOffMoment.isBefore(powerOnMoment)) {
      return timeMoment.isAfter(powerOnMoment) || timeMoment.isBefore(powerOffMoment);
    } else {
      return timeMoment.isSameOrAfter(powerOnMoment) && timeMoment.isSameOrBefore(powerOffMoment);
    }
  };

  const sortedEntries = selectedSchedule
    ? Object.entries(selectedSchedule.temperatures).sort(([a], [b]) => {
      const powerOn = moment(selectedSchedule.power.on, 'HH:mm');
      const ma = moment(a, 'HH:mm');
      const mb = moment(b, 'HH:mm');
      const adjA = ma.isBefore(powerOn) ? ma.add(1, 'day') : ma;
      const adjB = mb.isBefore(powerOn) ? mb.add(1, 'day') : mb;
      return adjA.diff(powerOn) - adjB.diff(powerOn);
    })
    : [];

  return (
    <GlassCard sx={ { opacity: disabled ? 0.55 : 1, transition: 'opacity 0.15s' } }>
      <Box sx={ { display: 'flex', alignItems: 'center', gap: 1.25, mb: 2 } }>
        <ThermostatIcon sx={ { color: palette.text.primary } } />
        <Typography
          sx={ {
            fontSize: '1.1rem',
            fontWeight: 600,
            color: palette.text.primary,
          } }
        >
          Temperature adjustments
        </Typography>
      </Box>

      { sortedEntries.length === 0 && (
        <Typography sx={ { fontSize: '0.85rem', color: palette.text.tertiary, mb: 2 } }>
          No mid-night transitions. Add one to step the temperature up or down at a specific time.
        </Typography>
      ) }

      { sortedEntries.map(([time, temperature]) => (
        <Box
          key={ time }
          sx={ {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 2,
            gap: 1,
          } }
        >
          <TextField
            label="Time"
            type="time"
            variant='standard'
            value={ time }
            onChange={ (event) => handleUpdateTime(time, event.target.value) }
            error={ !isTimeValid(time) }
            helperText={
              !isTimeValid(time)
                ? `Time must be between ${selectedSchedule?.power.on} and ${selectedSchedule?.power.off}`
                : ''
            }
            disabled={ disabled || isUpdating }
            sx={ {
              width: '130px',
              '& input::-webkit-calendar-picker-indicator': { opacity: 0, display: 'none' },
            } }
            InputProps={ {
              endAdornment: (
                <InputAdornment position="end" sx={ { cursor: 'pointer' } }>
                  <AccessTime sx={ { color: theme.palette.grey[500] } } fontSize='small' />
                </InputAdornment>
              ),
            } }
          />

          <Select
            value={ temperature }
            onChange={ (event) => handleUpdateTemperature(time, event.target.value as number) }
            sx={ { width: '110px' } }
            disabled={ disabled || isUpdating }
            size='small'
          >
            { (displayCelsius ? TEMPERATURES_LIST_LEVEL : TEMPERATURES_LIST_F).map((temp) => (
              <MenuItem key={ temp } value={ temp }>
                { formatTemperature(temp, displayCelsius) }
              </MenuItem>
            )) }
          </Select>

          <IconButton
            onClick={ () => deleteTime(time) }
            color="error"
            aria-label="remove schedule"
            disabled={ disabled || isUpdating }
          >
            <Remove />
          </IconButton>
        </Box>
      )) }

      <Box sx={ { display: 'flex', justifyContent: 'center', mt: 1 } }>
        <Button
          variant="contained"
          startIcon={ <Add /> }
          onClick={ addSchedule }
          disabled={ disabled || isUpdating }
        >
          Add transition
        </Button>
      </Box>
    </GlassCard>
  );
}
