import _ from 'lodash';
import { useEffect } from 'react';
import { Box, Typography } from '@mui/material';

import GlassCard from '@design/GlassCard';
import { palette } from '@design/tokens';
import { DeepPartial } from 'ts-essentials';
import moment from 'moment-timezone';

import AlarmSection from './AlarmSection/AlarmSection.tsx';
import OneOffAlarmSection from './OneOffAlarmSection.tsx';
import CopyToOtherDays from './CopyToOtherDays.tsx';
import DayTabs from './DayTabs.tsx';
import FloatingSaveBar from './FloatingSaveBar.tsx';
import PageContainer from '../PageContainer.tsx';
import SideControl from '../../components/SideControl.tsx';
import PowerScheduleSection from './PowerScheduleSection.tsx';
import TemperatureAdjustmentsSection from './TemperatureAdjustmentsSection.tsx';
import { DayOfWeek, Schedules } from '@api/schedulesSchema.ts';
import { postSchedules } from '@api/schedules';
import { useAppStore } from '@state/appStore.tsx';
import { useSchedules } from '@api/schedules';
import { useScheduleStore } from './scheduleStore.tsx';
import { useSettings } from '@api/settings';
import { LOWERCASE_DAYS } from './days.ts';
import TemperatureScheduleChart from './ScheduleChart.tsx';
import ErrorBoundary from '@components/ErrorBoundary.tsx';


const getAdjustedDayOfWeek = (): DayOfWeek => {
  // Get the current moment in the specified timezone
  const now = moment();
  // Extract the hour of the day in 24-hour format
  const currentHour = now.hour();

  // Determine if it's before noon (12:00 PM)
  if (currentHour < 12) {
    return now.subtract(1, 'day').format('dddd').toLocaleLowerCase() as DayOfWeek;
  } else {
    return now.format('dddd').toLocaleLowerCase() as DayOfWeek;
  }
};


export default function SchedulePage() {
  const { setIsUpdating, side } = useAppStore();
  const { data: schedules, refetch } = useSchedules();
  const {
    selectedSchedule,
    setOriginalSchedules,
    selectedDays,
    selectedDay,
    reloadScheduleData,
    selectDay
  } = useScheduleStore();
  const { data: settings } = useSettings();
  // 'displayCelsius' is now repurposed: true = use the -10..+10 'level' format.
  // Old prop name kept to avoid touching all the child components — the boolean
  // value still drives the same conditional in formatTemperature.
  // Always level mode (-10..+10); the F selector was removed.
  const displayCelsius = true;
  void settings;
  // TODO: Add changes lost notification using changesPresent when user tries to switch tab before saving

  useEffect(() => {
    const day = getAdjustedDayOfWeek();
    selectDay(LOWERCASE_DAYS.indexOf(day));
  }, []);

  useEffect(() => {
    if (!schedules) return;
    setOriginalSchedules(schedules);
    const day = getAdjustedDayOfWeek();
    selectDay(LOWERCASE_DAYS.indexOf(day));
    reloadScheduleData();
  }, [schedules]);

  useEffect(() => {
    reloadScheduleData();
  }, [side]);

  // Discard any in-progress edits when the page unmounts (user navigates to
  // another tab). The store is a Zustand singleton that survives unmount, so
  // without this the user would come back and see their unsaved changes
  // still pending — which the user explicitly does NOT want here.
  useEffect(() => {
    return () => {
      reloadScheduleData();
    };
  }, [reloadScheduleData]);

  const handleSave = async () => {
    setIsUpdating(true);

    const daysList: DayOfWeek[] = _.uniq(_.keys(_.pickBy(selectedDays, value => value))) as DayOfWeek[];
    daysList.push(selectedDay);
    const payload: DeepPartial<Schedules> = { [side]: {}, };
    daysList.forEach(day => {
      // @ts-expect-error
      payload[side][day] = selectedSchedule;
    });

    await postSchedules(payload)
      .then(() => {
        // Wait 1 second before refreshing the schedules
        return new Promise((resolve) => setTimeout(resolve, 1_000));
      })
      .then(() => refetch())
      .catch(error => {
        console.error(error);
      })
      .finally(() => {
        setIsUpdating(false);
      });
  };

  return (
    <PageContainer
      sx={ {
        width: '100%',
        maxWidth: { xs: '100%', sm: '800px' },
        mx: 'auto',
        mb: 15,
        gap: 2.5,
        alignItems: 'stretch',
      } }
    >
      <Typography
        sx={ {
          fontSize: '2rem',
          fontWeight: 600,
          letterSpacing: '-0.02em',
          color: palette.text.primary,
          alignSelf: 'flex-start',
          px: 0.5,
          mt: 1,
        } }
      >
        Schedules
      </Typography>
      <SideControl/>

      <DayTabs/>
      <Box sx={ { display: 'flex', justifyContent: 'flex-end', mt: -1 } }>
        <CopyToOtherDays/>
      </Box>

      <ErrorBoundary componentName='Scheduling chart'>
        <TemperatureScheduleChart />
      </ErrorBoundary>

      <GlassCard
        sx={ {
          opacity: !selectedSchedule?.power.enabled ? 0.55 : 1,
          transition: 'opacity 0.15s',
        } }
      >
        <PowerScheduleSection displayCelsius={ displayCelsius }/>
        <Box sx={ { my: 2.5, borderTop: '1px solid rgba(255,255,255,0.08)' } } />
        <TemperatureAdjustmentsSection displayCelsius={ displayCelsius }/>
      </GlassCard>
      <AlarmSection/>
      <OneOffAlarmSection/>

      <FloatingSaveBar onSave={ handleSave }/>
    </PageContainer>
  );
}
