import { useEffect, useState } from 'react';
import moment from 'moment-timezone';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { Alert, Box, Typography } from '@mui/material';
import { useResizeDetector } from 'react-resize-detector';

import VitalsLineChart from '@components/VitalsLineChart.tsx';
import PageContainer from '../../PageContainer.tsx';
import VitalsSummaryCard from '@components/VitalsSummaryCard.tsx';
import SleepStagesCard from '@components/SleepStagesCard.tsx';
import SleepBalanceCard from '@components/SleepBalanceCard.tsx';
import SleepFitnessCard from '@components/SleepFitnessCard.tsx';
import SleepConsistencyCard from '@components/SleepConsistencyCard.tsx';
import SideControl from '@components/SideControl.tsx';
import WeekStrip from './WeekStrip.tsx';
import WeeklyScheduleBars from './WeeklyScheduleBars.tsx';
import { SleepRecord } from '../../../../../server/src/db/sleepRecordsSchema.ts';
import { useAppStore } from '@state/appStore.tsx';
import { useSleepRecords } from '@api/sleep.ts';
import { useVitalsRecords, useVitalsSummary } from '@api/vitals.ts';
import ErrorBoundary from '@components/ErrorBoundary.tsx';
import { palette } from '@design/tokens';


const NoData = () => {
  return (
    <Alert severity="info">
      No data available for the selected time range
    </Alert>
  );
};


// eslint-disable-next-line react/no-multi-comp
export default function SleepPage() {
  const { ref } = useResizeDetector();
  const { side } = useAppStore();
  const [startTime, setStartTime] = useState(moment().subtract(7, 'days'));
  const [endTime, setEndTime] = useState(moment().add(2, 'day'));
  const [selectedSleepRecord, setSelectedSleepRecord] = useState<SleepRecord | undefined>(undefined);

  // Fetch sleep records for the selected week
  const { data: sleepRecords, refetch } = useSleepRecords({
    side,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString()
  });

  const { data: vitalsRecords } = useVitalsRecords({
    side,
    startTime: selectedSleepRecord?.entered_bed_at,
    endTime: selectedSleepRecord?.left_bed_at
  },
  selectedSleepRecord !== undefined
  );

  // Vitals summary across the 7 days leading up to (and including) the
  // selected night. Drives the "7 DAY AVERAGE" stat on each VitalsLineChart.
  const sevenDayWindow = selectedSleepRecord
    ? {
        side,
        startTime: moment(selectedSleepRecord.left_bed_at).subtract(7, 'days').toISOString(),
        endTime: selectedSleepRecord.left_bed_at,
      }
    : undefined;
  const { data: weekVitalsSummary } = useVitalsSummary(sevenDayWindow);

  useEffect(() => {
    // Default to last record selected
    if (sleepRecords?.length) {
      setSelectedSleepRecord(sleepRecords[sleepRecords.length - 1]);
    }
  }, [sleepRecords]);

  // Function to move to the previous week
  const handlePrevWeek = () => {
    const newStartTime = startTime.clone().subtract(1, 'week');
    setStartTime(newStartTime);
    const newEndTime = endTime.clone().subtract(1, 'week');
    setEndTime(newEndTime);
  };

  // Function to move to the next week
  const handleNextWeek = () => {
    const newStartTime = startTime.clone().add(1, 'week');
    setStartTime(newStartTime);
    const newEndTime = endTime.clone().add(1, 'week');
    setEndTime(newEndTime);
  };
  // The displayed end of the visible week is `endTime - 2 days` (see the
  // formatter and WeekStrip below). Compare against that so the chevron shows
  // as soon as the user is viewing a week prior to the current one.
  const displayedEnd = endTime.clone().subtract(2, 'day');
  const isNextDisabled = displayedEnd.isSameOrAfter(moment(), 'week');

  return (
    <ErrorBoundary componentName="Sleep page">
      <PageContainer containerProps={ { ref } } sx={ { mb: 15, gap: 2.5, mt: 0, alignItems: 'stretch' } }>
        { /* Page-level title in the same Apple-style as Settings/Status. No back arrow —
             Sleep is a top-level tab now. */ }
        <Typography
          sx={ {
            fontSize: '2rem',
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: palette.text.primary,
            px: 0.5,
            mt: 1,
          } }
        >
          Sleep
        </Typography>

        <SideControl/>
        <Box
          sx={ {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '70%',
            color: palette.text.primary,
            fontSize: '0.95rem',
            mt: 0.5,
            mx: 'auto',
          } }>
          <NavigateBeforeIcon onClick={ handlePrevWeek } sx={ { cursor: 'pointer', fontSize: 22 } }/>
          <Typography sx={ { fontSize: '0.95rem', color: palette.text.primary, fontWeight: 500 } }>
            { startTime.format('MMM D') } – { displayedEnd.format('MMM D') }
          </Typography>
          <Box sx={ { width: 22, display: 'flex', justifyContent: 'center' } }>
            { !isNextDisabled && (
              <NavigateNextIcon onClick={ handleNextWeek } sx={ { cursor: 'pointer', fontSize: 22 } }/>
            ) }
          </Box>
        </Box>
        <ErrorBoundary componentName="Week strip">
          <WeekStrip
            selectedDate={ displayedEnd }
            selectedRecord={ selectedSleepRecord }
            onSelectDay={ (day, record) => {
              if (record) {
                setSelectedSleepRecord(record);
              }
              const weekStart = day.clone().startOf('isoWeek').subtract(1, 'day');
              const weekEnd = day.clone().endOf('isoWeek').add(2, 'day');
              setStartTime(weekStart);
              setEndTime(weekEnd);
            } }
          />
        </ErrorBoundary>
        {
          sleepRecords?.length === 0 && <NoData/>
        }
        { /* Sleep stages chart replaces the old SleepBarChart at the top. */ }
        { selectedSleepRecord && (
          <ErrorBoundary componentName="Sleep stages">
            <SleepStagesCard
              startTime={ selectedSleepRecord.entered_bed_at }
              endTime={ selectedSleepRecord.left_bed_at }
            />
          </ErrorBoundary>
        ) }
        <Box sx={ { width: '100%', display: 'flex', flexDirection: 'column', gap: 2.5 } }>
          {
            selectedSleepRecord &&
            (
              <>
                <ErrorBoundary componentName="Sleep fitness card">
                  <SleepFitnessCard sleepRecord={ selectedSleepRecord } refetch={ refetch } />
                </ErrorBoundary>
                <ErrorBoundary componentName="Sleep consistency">
                  <SleepConsistencyCard
                    weekRecords={ sleepRecords }
                    weekStart={ displayedEnd.clone().startOf('isoWeek') }
                  />
                </ErrorBoundary>
                <VitalsSummaryCard
                  startTime={ selectedSleepRecord.entered_bed_at }
                  endTime={ selectedSleepRecord.left_bed_at }
                />
                <ErrorBoundary componentName="Heart rate chart">
                  <VitalsLineChart
                    vitalsRecords={ vitalsRecords }
                    metric="heart_rate"
                    sevenDayAvg={ weekVitalsSummary?.avgHeartRate }
                  />
                </ErrorBoundary>
                <ErrorBoundary componentName="Breathing rate chart">
                  <VitalsLineChart
                    vitalsRecords={ vitalsRecords }
                    metric="breathing_rate"
                    sevenDayAvg={ weekVitalsSummary?.avgBreathingRate }
                  />
                </ErrorBoundary>
                <ErrorBoundary componentName="HRV chart">
                  <VitalsLineChart
                    vitalsRecords={ vitalsRecords }
                    metric="hrv"
                    sevenDayAvg={ weekVitalsSummary?.avgHRV }
                  />
                </ErrorBoundary>
              </>
            )
          }
          <ErrorBoundary componentName="Weekly schedule bars">
            <WeeklyScheduleBars/>
          </ErrorBoundary>
          <ErrorBoundary componentName="Sleep balance">
            <SleepBalanceCard/>
          </ErrorBoundary>
        </Box>
      </PageContainer>
    </ErrorBoundary>
  );
}
