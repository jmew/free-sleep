import { Box, Typography, Card, CardActionArea } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useNavigate } from 'react-router-dom';

import { useDeviceStatus } from '@api/deviceStatus.ts';
import { useSettings } from '@api/settings.ts';
import { useAppStore } from '@state/appStore.tsx';
import { formatTemperature, getTemperatureColor } from '@lib/temperatureConversions.ts';
import { glassCard, sectionLabel } from './cardStyles';

type SideKey = 'left' | 'right';

function statusLine(
  isOn: boolean | undefined,
  current: number | undefined,
  target: number | undefined,
): string {
  if (!isOn) return 'Off';
  if (current === undefined || target === undefined) return '';
  const delta = current - target;
  if (Math.abs(delta) <= 0.5) return 'On target';
  return delta > 0 ? `Cooling to ${target}°` : `Warming to ${target}°`;
}

function SideTile({ sideKey }: { sideKey: SideKey }) {
  const { side: activeSide, setSide } = useAppStore();
  const navigate = useNavigate();
  const { data: settings } = useSettings();
  const { data: deviceStatus } = useDeviceStatus();

  const sideStatus = deviceStatus?.[sideKey];
  const isOn = sideStatus?.isOn;
  const isCelsius = settings?.temperatureFormat === 'celsius';
  const target = sideStatus?.targetTemperatureF;
  const current = sideStatus?.currentTemperatureF;
  const color = isOn ? getTemperatureColor(target) : 'rgba(255,255,255,0.25)';
  const isActive = activeSide === sideKey;

  const handleClick = () => {
    setSide(sideKey);
    navigate('/temperature');
  };

  return (
    <CardActionArea
      onClick={ handleClick }
      sx={ {
        flex: 1,
        borderRadius: 3,
        p: 2,
        backgroundColor: isActive ? 'rgba(255,255,255,0.04)' : 'transparent',
        border: isActive ? '1px solid rgba(255,255,255,0.08)' : '1px solid transparent',
        transition: 'all 0.2s ease',
      } }
    >
      <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 } }>
        <Typography
          sx={ {
            fontSize: '0.85rem',
            color: 'rgba(255,255,255,0.6)',
            fontWeight: 500,
          } }
        >
          { settings?.[sideKey]?.name || (sideKey === 'left' ? 'Left' : 'Right') }
        </Typography>
        <Box
          sx={ {
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: isOn ? color : 'rgba(255,255,255,0.15)',
            boxShadow: isOn ? `0 0 8px ${color}` : 'none',
          } }
        />
      </Box>
      <Typography
        sx={ {
          fontSize: '3.25rem',
          fontWeight: 200,
          lineHeight: 1,
          letterSpacing: '-0.03em',
          color: isOn ? color : 'rgba(255,255,255,0.3)',
        } }
      >
        { isOn && target !== undefined
          ? formatTemperature(target, isCelsius).replace(/[FC]$/, '')
          : '—' }
      </Typography>
      <Typography
        sx={ {
          fontSize: '0.75rem',
          color: 'rgba(255,255,255,0.45)',
          mt: 0.75,
          minHeight: '1em',
        } }
      >
        { statusLine(isOn, current, target) }
      </Typography>
    </CardActionArea>
  );
}

// eslint-disable-next-line react/no-multi-comp
export default function PodHeroCard() {
  const navigate = useNavigate();

  return (
    <Card sx={ glassCard } elevation={ 0 }>
      <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 } }>
        <Typography sx={ sectionLabel }>Pod</Typography>
        <CardActionArea
          onClick={ () => navigate('/temperature') }
          sx={ {
            display: 'inline-flex',
            alignItems: 'center',
            width: 'auto',
            px: 1,
            py: 0.5,
            borderRadius: 2,
            color: 'rgba(255,255,255,0.6)',
            fontSize: '0.75rem',
          } }
        >
          Adjust
          <ChevronRightIcon sx={ { fontSize: 16 } }/>
        </CardActionArea>
      </Box>
      <Box sx={ { display: 'flex', gap: 1 } }>
        <SideTile sideKey="left"/>
        <SideTile sideKey="right"/>
      </Box>
    </Card>
  );
}
