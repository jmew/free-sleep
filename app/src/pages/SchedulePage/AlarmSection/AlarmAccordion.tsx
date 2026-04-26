import {
  Accordion,
  AccordionSummary,
  Box,
  Typography,
  SxProps,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { sx as designSx } from '@design/tokens';
import { AccordionExpanded } from '../SchedulePage.types.ts';
import { useScheduleStore } from '../scheduleStore.tsx';
import AlarmEnabledSwitch from './AlarmEnabledSwitch.tsx';
import AlarmTime from './AlarmTime.tsx';
import AlarmVibrationSlider from './AlarmVibrationSlider.tsx';
import AlarmDuration from './AlarmDuration.tsx';
import AlarmPattern from './AlarmPattern.tsx';
import React from 'react';
import AlarmIcon from '@mui/icons-material/Alarm';
import AlarmTest from './AlarmTest.tsx';

const ACCORDION_NAME: AccordionExpanded = 'alarm';

const Row = ({ children, sx }: React.PropsWithChildren<{ sx?: SxProps }>) => (
  <Box
    sx={ {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      mb: 2,
      pl: 2,
      pr: 2,
      gap: 1,
      ...sx,
    } }
  >
    { children }
  </Box>
);

// eslint-disable-next-line react/no-multi-comp
export default function AlarmAccordion() {
  const {
    accordionExpanded,
    selectedSchedule,
    setAccordionExpanded,
  } = useScheduleStore();


  return (
    <Accordion
      sx={ { ...designSx.glassAccordion } }
      expanded={ accordionExpanded === ACCORDION_NAME }
      onChange={ () => setAccordionExpanded(ACCORDION_NAME) }
      disabled={ !selectedSchedule?.power.enabled }
    >
      <AccordionSummary expandIcon={ <ExpandMoreIcon/> } >
        <Typography sx={ { display: 'flex', alignItems: 'center', gap: 3 } }>
          <AlarmIcon /> Vibration alarm
        </Typography>
      </AccordionSummary>
      <Box sx={ { width: '100%', pb: 2 } }>
        <Row>
          <AlarmEnabledSwitch/>
          { selectedSchedule?.alarm.enabled && <AlarmTime/> }
        </Row>
        {
          selectedSchedule?.alarm.enabled &&
          (
            <>
              <Row>
                <AlarmDuration/>
                <AlarmPattern/>
              </Row>
              <Row sx={ { ml: 3, mr: 3 } }>
                <AlarmVibrationSlider/>

              </Row>
              <AlarmTest />
            </>
          )
        }
      </Box>
    </Accordion>
  );

}
