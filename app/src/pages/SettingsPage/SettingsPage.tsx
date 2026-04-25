import { DeepPartial } from 'ts-essentials';
import { Typography, Box } from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';

import SideSettings from './SideSettings.tsx';
import PageContainer from '../PageContainer.tsx';
import { Settings } from '@api/settingsSchema.ts';
import { postSettings, useSettings } from '@api/settings.ts';
import { useAppStore } from '@state/appStore.tsx';
import DailyPriming from './DailyPriming.tsx';
import LicenseModal from './LicenseModal.tsx';
import PrimeControl from './PrimeControl.tsx';
import Divider from './Divider.tsx';
import FeaturesSection from './FeaturesSection/FeaturesSection.tsx';
import Section from './Section.tsx';
import DeviceSettingsSection from './DeviceSettingsSection/DeviceSettingsSection.tsx';
import ErrorBoundary from '@components/ErrorBoundary.tsx';


export default function SettingsPage() {
  const { data: settings, refetch } = useSettings();
  const { setIsUpdating } = useAppStore();

  const updateSettings = (settings: DeepPartial<Settings>) => {
    setIsUpdating(true);

    postSettings(settings)
      .then(() => refetch())
      .catch(error => {
        console.error(error);
      })
      .finally(() => setIsUpdating(false));
  };

  return (
    <PageContainer sx={ { mb: 15, mt: 2 } }>
      <ErrorBoundary componentName='Device settings'>
        <DeviceSettingsSection updateSettings={ updateSettings } />
      </ErrorBoundary>
      <ErrorBoundary componentName='Priming settings'>
        <Section title="Priming">
          <DailyPriming settings={ settings } updateSettings={ updateSettings }/>
          <br/>
          <PrimeControl/>

          <Box display="flex" gap={ 1 } sx={ { mt: 2 } }>
            <InfoIcon sx={ { color: 'text.secondary' } }/>
            <Typography color='text.secondary'>
            Regular priming helps prevent air bubbles, ensures even cooling and heating.
            Schedule priming during a time that you're not on the bed.
            </Typography>
          </Box>
        </Section>
      </ErrorBoundary>

      <FeaturesSection/>
      <ErrorBoundary componentName='Side settings'>

        <Section title="Side settings">
          <SideSettings side="left" settings={ settings } updateSettings={ updateSettings }/>
          <br/>
          <SideSettings side="right" settings={ settings } updateSettings={ updateSettings }/>
          <Box display="flex" gap={ 1 } sx={ { mt: 1 } }>

            <InfoIcon sx={ { color: 'text.secondary' } }/>
            <Typography color="text.secondary">
            Away mode:
            Disables schedules and temperature control for one side.
            That side will mirror any temperature or schedule changes from the active side.
            If both sides are in away mode, no schedules will apply.
            </Typography>
          </Box>
        </Section>
      </ErrorBoundary>
      <ErrorBoundary componentName='Info section'>
        <Divider/>
        <LicenseModal/>
      </ErrorBoundary>
    </PageContainer>
  );
}
