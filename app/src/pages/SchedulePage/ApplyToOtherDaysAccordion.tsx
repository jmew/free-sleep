import {
  Accordion,
  AccordionSummary,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Typography
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { sx as designSx } from '@design/tokens';
import { AccordionExpanded } from './SchedulePage.types.ts';
import { DayOfWeek } from '@api/schedulesSchema.ts';
import { useAppStore } from '@state/appStore.tsx';
import { useScheduleStore } from './scheduleStore';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';

export const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const ACCORDION_NAME: AccordionExpanded = 'applyToDays';

export default function ApplyToOtherDaysAccordion() {
  const {
    selectedDays,
    toggleSelectedDay,
    accordionExpanded,
    setAccordionExpanded,
    selectedSchedule,
  } = useScheduleStore();
  const { isUpdating } = useAppStore();

  const setWeekdays = () => {
    daysOfWeek.slice(0, 5).map(day => {
      // @ts-expect-error
      toggleSelectedDay(day.toLowerCase());
    });
  };

  const setEveryday = () => {
    daysOfWeek.map(day => {
      // @ts-expect-error
      toggleSelectedDay(day.toLowerCase());
    });
  };

  const setWeekends= () => {
    // @ts-expect-error
    toggleSelectedDay(daysOfWeek[5].toLowerCase());
    // @ts-expect-error
    toggleSelectedDay(daysOfWeek[6].toLowerCase());
  };

  return (
    <Accordion
      sx={ { ...designSx.glassAccordion } }
      expanded={ accordionExpanded === ACCORDION_NAME }
      onChange={ () => setAccordionExpanded(ACCORDION_NAME) }
      disabled={ !selectedSchedule?.power.enabled }

    >
      <AccordionSummary expandIcon={ <ExpandMoreIcon/> }>
        <Typography sx={ { display: 'flex', alignItems: 'center', gap: 3 } }>
          <EventRepeatIcon /> Apply settings to other days
        </Typography>
      </AccordionSummary>
      <Box sx={ { mt: -2, p: 2 } }>
        <Box sx={ { display: 'flex', gap: 1 } }>
          <Button variant="contained" sx={ { mb: 1 } } onClick={ setWeekdays } >Weekdays</Button>
          <Button variant="contained" sx={ { mb: 1 } } onClick={ setWeekends }>Weekends</Button>
          <Button variant="contained" sx={ { mb: 1 } } onClick={ setEveryday }>Everyday</Button>
        </Box>
        <FormGroup>
          {
            daysOfWeek.map((day) => {
              const lowerCaseDay = day.toLowerCase() as DayOfWeek;
              return (
                <FormControlLabel
                  key={ day }
                  control={
                    <Checkbox
                      disabled={ isUpdating }
                      checked={ selectedDays[lowerCaseDay] }
                      onChange={ () => toggleSelectedDay(lowerCaseDay) }
                    />
                  }
                  label={ day }
                />
              );
            })
          }
        </FormGroup>
      </Box>
    </Accordion>
  );
}
