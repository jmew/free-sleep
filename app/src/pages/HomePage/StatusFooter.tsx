import { Box, Typography } from '@mui/material';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import WifiIcon from '@mui/icons-material/Wifi';
import CircleIcon from '@mui/icons-material/Circle';
import { useNavigate } from 'react-router-dom';

import { useDeviceStatus } from '@api/deviceStatus.ts';

function FooterItem({ icon, text, color }: { icon: React.ReactNode; text: string; color?: string }) {
  return (
    <Box sx={ { display: 'flex', alignItems: 'center', gap: 0.5, color: color || 'rgba(255,255,255,0.45)' } }>
      { icon }
      <Typography sx={ { fontSize: '0.7rem' } }>{ text }</Typography>
    </Box>
  );
}

// eslint-disable-next-line react/no-multi-comp
export default function StatusFooter() {
  const { data: deviceStatus } = useDeviceStatus();
  const navigate = useNavigate();

  if (!deviceStatus) return null;

  const wifi = deviceStatus.wifiStrength as number | undefined;
  // wifi is dBm — typical range -30 (excellent) to -90 (poor)
  const wifiOk = wifi !== undefined && wifi > -75;

  const water = (deviceStatus as any).waterLevel as string | undefined;
  const waterOk = !water || water === 'true' || water === 'good';

  return (
    <Box
      onClick={ () => navigate('/status') }
      sx={ {
        display: 'flex',
        gap: 2,
        justifyContent: 'center',
        alignItems: 'center',
        mt: 1,
        cursor: 'pointer',
        opacity: 0.85,
        '&:hover': { opacity: 1 },
      } }
    >
      <FooterItem
        icon={ <WaterDropIcon sx={ { fontSize: 14 } }/> }
        text={ waterOk ? 'Water OK' : 'Add water' }
        color={ waterOk ? undefined : '#f97316' }
      />
      { wifi !== undefined && (
        <FooterItem
          icon={ <WifiIcon sx={ { fontSize: 14 } }/> }
          text={ `${wifi} dBm` }
          color={ wifiOk ? undefined : '#eab308' }
        />
      ) }
      <FooterItem
        icon={ <CircleIcon sx={ { fontSize: 8 } }/> }
        text="Pod online"
        color="#22c55e"
      />
    </Box>
  );
}
