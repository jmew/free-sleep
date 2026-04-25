import { useEffect } from 'react';
import Button from '@mui/material/Button';
import { Box, CircularProgress } from '@mui/material';

import AlarmDismissal from './AlarmDismissal.tsx';
import AlarmNotification from './AlarmNotification.tsx';
import AwayNotification from './AwayNotification.tsx';
import ErrorBoundary from '@components/ErrorBoundary.tsx';
import LastNightChip from './LastNightChip.tsx';
import PageContainer from '../PageContainer.tsx';
import PowerButton from './PowerButton.tsx';
import PrimingNotification from './PrimingNotification.tsx';
import ScheduleOverrideBanner from './ScheduleOverrideBanner.tsx';
import SideControl from '../../components/SideControl.tsx';
import Slider from './Slider.tsx';
import WaterNotification from './WaterNotification.tsx';
import { useAppStore } from '@state/appStore.tsx';
import { useControlTempStore } from './controlTempStore.tsx';
import { useDeviceStatus } from '@api/deviceStatus';
import { useSettings } from '@api/settings.ts';
import { useTheme } from '@mui/material/styles';


export default function ControlTempPage() {
  const { isError, refetch, data: deviceStatus } = useDeviceStatus();
  const setDeviceStatus = useControlTempStore(state => state.setDeviceStatus);
  const { data: settings } = useSettings();
  const { isUpdating, side } = useAppStore();
  const theme = useTheme();

  const sideStatus = deviceStatus?.[side];
  const isOn = sideStatus?.isOn || false;

  useEffect(() => {
    refetch();
  }, [side]);

  useEffect(() => {
    if (!deviceStatus) return;
    setDeviceStatus(deviceStatus);
  }, [deviceStatus]);

  return (
    <PageContainer
      sx={ {
        maxWidth: '500px',
        [theme.breakpoints.up('md')]: {
          maxWidth: '400px',
        },
      } }
    >
      <Slider
        isOn={ isOn }
        currentTargetTemp={ sideStatus?.targetTemperatureF || 55 }
        refetch={ refetch }
        currentTemperatureF={ sideStatus?.currentTemperatureF || 55 }
        displayCelsius={ settings?.temperatureFormat === 'level' || false }
      />

      { isError ? (
        <Button
          variant="contained"
          onClick={ () => refetch() }
          disabled={ isUpdating }
        >
          Try again
        </Button>
      ) : (
        <PowerButton isOn={ sideStatus?.isOn || false } refetch={ refetch }/>
      ) }

      <Box sx={ { display: 'flex', flexDirection: 'column', gap: 1, width: '100%' } }>
        <ErrorBoundary componentName='Schedule override banner'>
          <ScheduleOverrideBanner/>
        </ErrorBoundary>
        {
          deviceStatus?.isPriming && (
            <PrimingNotification/>
          )
        }
        <ErrorBoundary componentName='Alarm notification'>
          <AlarmNotification/>
        </ErrorBoundary>
        <AwayNotification settings={ settings }/>
        <WaterNotification/>
        <ErrorBoundary componentName='Last night chip'>
          <LastNightChip/>
        </ErrorBoundary>
      </Box>
      <AlarmDismissal refetch={ refetch }/>
      { isUpdating && <CircularProgress/> }
      <SideControl showTemp={ true }/>
    </PageContainer>
  );
}
