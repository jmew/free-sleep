import InfoIcon from '@mui/icons-material/Info';
import { Box, CircularProgress, FormControlLabel, Typography, Switch } from '@mui/material';
import Section from '../Section.tsx';
import { Services, useServices, postServices } from '@api/services.ts';
import { useAppStore } from '@state/appStore.tsx';
import { DeepPartial } from 'ts-essentials';
import { palette } from '@design/tokens';

export default function FeaturesSection() {
  const { data: services, refetch, isLoading } = useServices();
  const setIsUpdating = useAppStore(state => state.setIsUpdating);
  const isUpdating = useAppStore(state => state.isUpdating);

  const updateServices = (services: DeepPartial<Services>) => {
    setIsUpdating(true);

    postServices(services)
      .then(() => refetch())
      .catch(error => {
        console.error(error);
      })
      .finally(() => setIsUpdating(false));
  };

  if (isLoading || !services) return <CircularProgress />;

  return (
    <Section title='Features'>
      <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.5 } }>
        <Typography sx={ { fontSize: '1rem', color: palette.text.primary } }>Biometrics</Typography>
        <Switch
          disabled={ isUpdating || services?.biometrics.jobs.installation.status !== 'healthy' }
          checked={ services.biometrics.enabled }
          onChange={ (event) => updateServices({ biometrics: { enabled: event.target.checked } }) }
        />
      </Box>
      <Box display='flex' gap={ 1 } alignItems='flex-start' sx={ { mt: 1 } }>
        <InfoIcon sx={ { color: palette.text.tertiary, fontSize: 18, mt: '2px' } }/>
        <Typography sx={ { color: palette.text.tertiary, fontSize: '0.85rem', lineHeight: 1.5 } }>
          Calculate biometrics for the pod.
          Requires you to run this command on your pod. Once installation completes successfully, you can toggle this on/off.
          <Typography
            component='span'
            sx={ { display: 'block', mt: 0.5, fontFamily: 'monospace', fontSize: '0.8rem', color: palette.text.tertiary } }
          >
            sh /home/dac/free-sleep/scripts/enable_biometrics.sh
          </Typography>
        </Typography>
      </Box>
    </Section>
  );
}
