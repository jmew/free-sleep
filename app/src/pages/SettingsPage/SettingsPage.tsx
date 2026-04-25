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
import { palette } from '@design/tokens';


function InlineHelp({ children }: { children: React.ReactNode }) {
  return (
    <Box display="flex" gap={ 1 } alignItems="flex-start" sx={ { mt: 2 } }>
      <InfoIcon sx={ { color: palette.text.tertiary, fontSize: 18, mt: '2px' } }/>
      <Typography sx={ { color: palette.text.tertiary, fontSize: '0.85rem', lineHeight: 1.5 } }>
        { children }
      </Typography>
    </Box>
  );
}

// eslint-disable-next-line react/no-multi-comp
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
    <PageContainer
      sx={ {
        mb: 15,
        pt: 3,
        gap: 2,
        alignItems: 'stretch',
      } }
    >
      { /* Page title — Apple-style large header */ }
      <Typography
        sx={ {
          fontSize: '2rem',
          fontWeight: 600,
          letterSpacing: '-0.02em',
          color: palette.text.primary,
          px: 0.5,
          mb: 0.5,
        } }
      >
        Settings
      </Typography>

      <ErrorBoundary componentName='Device settings'>
        <DeviceSettingsSection updateSettings={ updateSettings } />
      </ErrorBoundary>

      <ErrorBoundary componentName='Priming settings'>
        <Section title="Priming">
          <DailyPriming settings={ settings } updateSettings={ updateSettings }/>
          <Box sx={ { mt: 2 } }>
            <PrimeControl/>
          </Box>
          <InlineHelp>
            Regular priming helps prevent air bubbles, ensures even cooling and heating.
            Schedule priming during a time that you're not on the bed.
          </InlineHelp>
        </Section>
      </ErrorBoundary>

      <FeaturesSection/>

      <ErrorBoundary componentName='Side settings'>
        <Section title="Side settings">
          <Box sx={ { display: 'flex', flexDirection: 'column', gap: 3 } }>
            <SideSettings side="left" settings={ settings } updateSettings={ updateSettings }/>
            <Box sx={ { height: 1, backgroundColor: palette.border.subtle } }/>
            <SideSettings side="right" settings={ settings } updateSettings={ updateSettings }/>
          </Box>
          <InlineHelp>
            Away mode disables schedules and temperature control for one side.
            That side will mirror any temperature or schedule changes from the active side.
            If both sides are in away mode, no schedules will apply.
          </InlineHelp>
        </Section>
      </ErrorBoundary>

      <ErrorBoundary componentName='Info section'>
        <Divider/>
        <LicenseModal/>
      </ErrorBoundary>
    </PageContainer>
  );
}
