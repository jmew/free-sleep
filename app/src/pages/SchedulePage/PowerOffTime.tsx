import AccessTime from '@mui/icons-material/AccessTime';
import { InputAdornment, TextField } from '@mui/material';
import moment from 'moment-timezone';
import { useScheduleStore } from './scheduleStore';
import { useAppStore } from '@state/appStore';
import { Time } from '@api/schedulesSchema.ts';
import { useTheme } from '@mui/material/styles';


export default function PowerOffTime() {
  const {
    validations,
    setValidations,
    selectedSchedule,
    updateSelectedSchedule,
  } = useScheduleStore();
  const { isUpdating } = useAppStore();
  const theme = useTheme();

  const handleChange = (time: Time) => {
    const currentDate = moment().format('YYYY-MM-DD');

    // Create the moment objects
    const startMoment = moment(`${currentDate} ${selectedSchedule?.power.on}`, 'YYYY-MM-DD HH:mm');
    const endMomentSameDay = moment(`${currentDate} ${time}`, 'YYYY-MM-DD HH:mm');

    // Adjust for the next day if the end time is earlier than the start time
    const endMomentNextDay = moment(endMomentSameDay).add(1, 'day');
    const isValid = endMomentSameDay.isAfter(startMoment) || endMomentNextDay.diff(startMoment, 'hours') <= 12;
    setValidations({ powerOffTimeIsValid: isValid });
    updateSelectedSchedule(
      {
        power: {
          off: time,
        },
      }
    );
  };

  const disabled = !selectedSchedule?.power.enabled || isUpdating;

  return (
    <TextField
      label="Power off"
      type="time"
      value={ selectedSchedule?.power?.off || '09:00' }
      onChange={ (e) => handleChange(e.target.value) }
      variant='standard'
      error={ !validations.powerOffTimeIsValid }
      helperText={
        !validations.powerOffTimeIsValid
          ? `Time must be no later than 12 hours the same day or next day`
          : ''
      }
      disabled={ disabled }
      sx={ {
        width: '130px',
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
  );
}
