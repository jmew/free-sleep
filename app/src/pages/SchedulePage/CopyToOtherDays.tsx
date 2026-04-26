import { useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  FormControlLabel,
  FormGroup,
  Popover,
  Stack,
  Typography,
} from '@mui/material';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';

import { palette } from '@design/tokens';
import { DayOfWeek } from '@api/schedulesSchema.ts';
import { useAppStore } from '@state/appStore.tsx';
import { useScheduleStore } from './scheduleStore.tsx';

const DAYS: DayOfWeek[] = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
];

const DAY_LABELS: Record<DayOfWeek, string> = {
  sunday: 'Sunday',
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
};

/**
 * "Copy to…" affordance used near the day picker. Opens a popover with the
 * other six days and quick presets (Weekdays/Weekends/Everyday). Reuses the
 * `selectedDays` state in the schedule store, so the in-progress check
 * marks survive until the user saves or discards via the FloatingSaveBar.
 */
export default function CopyToOtherDays() {
  const { isUpdating } = useAppStore();
  const { selectedDay, selectedDays, toggleSelectedDay } = useScheduleStore();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const otherDays = DAYS.filter((d) => d !== selectedDay);
  const targetCount = otherDays.filter((d) => selectedDays[d]).length;

  const setMany = (days: DayOfWeek[]) => {
    days.forEach((d) => {
      if (d === selectedDay) return;
      if (!selectedDays[d]) toggleSelectedDay(d);
    });
  };

  const clearAll = () => {
    otherDays.forEach((d) => {
      if (selectedDays[d]) toggleSelectedDay(d);
    });
  };

  return (
    <>
      <Chip
        icon={ <EventRepeatIcon sx={ { fontSize: 16 } } /> }
        label={ targetCount > 0 ? `Copy to ${targetCount} day${targetCount === 1 ? '' : 's'}` : 'Copy to…' }
        onClick={ (e) => setAnchorEl(e.currentTarget) }
        disabled={ isUpdating }
        sx={ {
          backgroundColor: targetCount > 0 ? 'rgba(10,132,255,0.16)' : 'rgba(255,255,255,0.06)',
          color: palette.text.primary,
          border: `1px solid ${palette.border.subtle}`,
          fontWeight: 500,
          '&:hover': { backgroundColor: 'rgba(255,255,255,0.10)' },
        } }
      />
      <Popover
        open={ Boolean(anchorEl) }
        anchorEl={ anchorEl }
        onClose={ () => setAnchorEl(null) }
        anchorOrigin={ { vertical: 'bottom', horizontal: 'left' } }
        transformOrigin={ { vertical: 'top', horizontal: 'left' } }
      >
        <Box sx={ { p: 2, minWidth: 240 } }>
          <Typography sx={ { fontSize: '0.85rem', color: palette.text.tertiary, mb: 1 } }>
            Copy { String(selectedDay) }&apos;s schedule to:
          </Typography>
          <Stack direction="row" spacing={ 1 } sx={ { mb: 1.5 } }>
            <Button
              size="small"
              onClick={ () => setMany(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']) }
            >Weekdays</Button>
            <Button
              size="small"
              onClick={ () => setMany(['saturday', 'sunday']) }
            >Weekends</Button>
            <Button
              size="small"
              onClick={ () => setMany(DAYS) }
            >All</Button>
          </Stack>
          <FormGroup>
            { otherDays.map((d) => (
              <FormControlLabel
                key={ String(d) }
                control={
                  <Checkbox
                    size="small"
                    checked={ !!selectedDays[d] }
                    onChange={ () => toggleSelectedDay(d) }
                    disabled={ isUpdating }
                  />
                }
                label={ DAY_LABELS[d] }
              />
            )) }
          </FormGroup>
          { targetCount > 0 && (
            <Button size="small" onClick={ clearAll } sx={ { mt: 1 } }>
              Clear
            </Button>
          ) }
        </Box>
      </Popover>
    </>
  );
}
