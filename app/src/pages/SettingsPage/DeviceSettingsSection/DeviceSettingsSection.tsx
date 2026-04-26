import { DeepPartial } from 'ts-essentials';
import { Box } from '@mui/material';

import { Settings } from '@api/settingsSchema.ts';
import Section from '../Section.tsx';
import TimeZoneSelector from './TimeZoneSelector.tsx';
import DailyReboot from './DailyReboot.tsx';
import LedBrightnessSlider from './LedBrightnessSlider.tsx';
import { useSettings } from '@api/settings.ts';
import DeviceInfo from './DeviceInfo.tsx';
import ErrorBoundary from '@components/ErrorBoundary.tsx';


type UpdateSettingsFn = (settings: DeepPartial<Settings>) => void;

type DeviceSettingsSectionProps = {
  updateSettings: UpdateSettingsFn;
};

export default function DeviceSettingsSection({ updateSettings }: DeviceSettingsSectionProps) {
  const { data: settings } = useSettings();

  return (
    <Section title="Device settings">
      <Box display='flex' flexDirection='column' gap={ 1 }>
        <TimeZoneSelector settings={ settings } updateSettings={ updateSettings }/>
        <DailyReboot settings={ settings } updateSettings={ updateSettings }/>
        <LedBrightnessSlider/>
        <ErrorBoundary componentName='Device info'>
          <DeviceInfo />
        </ErrorBoundary>
      </Box>
    </Section>
  );
}
