import { Box, Typography, Card, IconButton, CircularProgress } from '@mui/material';
import HotelIcon from '@mui/icons-material/Hotel';
import AirlineSeatReclineNormalIcon from '@mui/icons-material/AirlineSeatReclineNormal';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import WeekendIcon from '@mui/icons-material/Weekend';
import { useNavigate } from 'react-router-dom';

import { useSetBasePreset } from '@api/baseControl.ts';
import { glassCard, sectionLabel } from './cardStyles';

type Preset = 'flat' | 'sleep' | 'relax' | 'read';
type Action = {
  preset: Preset;
  label: string;
  icon: React.ReactNode;
};

const ACTIONS: Action[] = [
  { preset: 'flat', label: 'Flat', icon: <HotelIcon/> },
  { preset: 'sleep', label: 'Sleep', icon: <AirlineSeatReclineNormalIcon/> },
  { preset: 'relax', label: 'Relax', icon: <WeekendIcon/> },
  { preset: 'read', label: 'Read', icon: <MenuBookIcon/> },
];

export default function QuickActionsCard() {
  const navigate = useNavigate();
  const setPreset = useSetBasePreset();
  const isPending = setPreset.isPending;

  return (
    <Card sx={ glassCard } elevation={ 0 }>
      <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 } }>
        <Typography sx={ sectionLabel }>Bed presets</Typography>
        <Typography
          onClick={ () => navigate('/elevation') }
          sx={ {
            fontSize: '0.75rem',
            color: 'rgba(255,255,255,0.5)',
            cursor: 'pointer',
            '&:hover': { color: 'rgba(255,255,255,0.85)' },
          } }
        >
          More →
        </Typography>
      </Box>
      <Box sx={ { display: 'flex', justifyContent: 'space-around', gap: 1 } }>
        { ACTIONS.map(({ preset, label, icon }) => (
          <Box key={ preset } sx={ { textAlign: 'center', flex: 1 } }>
            <IconButton
              onClick={ () => setPreset.mutate(preset) }
              disabled={ isPending }
              sx={ {
                width: 56,
                height: 56,
                borderRadius: '50%',
                backgroundColor: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.85)',
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.08)',
                },
                '&:disabled': {
                  color: 'rgba(255,255,255,0.3)',
                },
              } }
            >
              { isPending && setPreset.variables === preset
                ? <CircularProgress size={ 20 } sx={ { color: 'rgba(255,255,255,0.6)' } }/>
                : icon }
            </IconButton>
            <Typography
              sx={ {
                fontSize: '0.7rem',
                color: 'rgba(255,255,255,0.55)',
                mt: 0.75,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              } }
            >
              { label }
            </Typography>
          </Box>
        )) }
      </Box>
    </Card>
  );
}
