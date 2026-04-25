import { Box, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import moment from 'moment-timezone';

import { useSchedules } from '@api/schedules.ts';
import { useSettings } from '@api/settings.ts';
import { useAppStore } from '@state/appStore.tsx';
import { formatTemperature } from '@lib/temperatureConversions.ts';


type TemperatureLabelProps = {
  isOn: boolean;
  sliderTemp: number;
  sliderColor: string;
  currentTargetTemp: number;
  currentTemperatureF: number;
  displayCelsius: boolean;
}


export default function TemperatureLabel({
  isOn,
  sliderTemp,
  sliderColor,
  currentTargetTemp,
  currentTemperatureF,
  displayCelsius
}: TemperatureLabelProps) {
  const theme = useTheme();
  const { side } = useAppStore();
  const { data: schedules } = useSchedules();
  const { data: settings } = useSettings();
  const isInAwayMode = settings?.[side].awayMode;

  const currentDay = settings?.timeZone && moment.tz(settings?.timeZone).format('dddd').toLowerCase();
  // @ts-expect-error
  const power = currentDay ? schedules?.[side]?.[currentDay]?.power : undefined;
  const formattedTime = moment(power?.on, 'HH:mm').format('h:mm A');
  const powerOffTime = moment(power?.off, 'HH:mm').format('h:mm A');

  let topTitle: string;
  // Handle user actively changing temp
  if (sliderTemp !== currentTargetTemp) {
    if (sliderTemp < currentTemperatureF) {
      topTitle = 'Cool to';
    } else if (sliderTemp > currentTemperatureF) {
      topTitle = 'Warm to';
    } else {
      topTitle = '';
    }
  } else {
    if (currentTemperatureF < currentTargetTemp) {
      topTitle = 'Warming to';
    } else if (currentTemperatureF > currentTargetTemp) {
      topTitle = 'Cooling to';
    } else {
      topTitle = '';
    }
  }

  return (
    <div
      style={ {
        position: 'absolute',
        top: '10%',
        left: '50%',
        pointerEvents: 'none',
        textAlign: 'center',
        height: '300px',
        width: '100%',
      } }
    >
      {
        isOn ? (
          <Box
            sx={ {
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              width: '100%',
            } }
          >
            <Typography
              sx={ {
                textWrap: 'nowrap',
                textAlign: 'center',
                fontSize: '0.75rem',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontWeight: 500,
              } }
              color={ theme.palette.grey[400] }
            >
              { topTitle }
            </Typography>

            { /* Hero temperature number — large, thin weight for premium feel */ }
            <Typography
              sx={ {
                textWrap: 'nowrap',
                fontSize: '5.5rem',
                fontWeight: 200,
                lineHeight: 1,
                letterSpacing: '-0.02em',
                mt: 0.5,
                mb: 1,
              } }
              color={ sliderColor }
            >
              { formatTemperature(currentTargetTemp !== sliderTemp ? sliderTemp : currentTargetTemp, displayCelsius) }
            </Typography>
            { /* Currently at label */ }
            <Typography
              sx={ {
                textWrap: 'nowrap',
                mb: 1,
                fontSize: '0.875rem',
              } }
              color={ theme.palette.grey[400] }
            >
              { `Currently ${formatTemperature(currentTemperatureF, displayCelsius)}` }
            </Typography>
            {
              power?.enabled && (
                <Typography
                  sx={ { textWrap: 'nowrap' } }
                  color={ theme.palette.grey[500] }
                >
                  Turns off at { powerOffTime }
                </Typography>
              )
            }
          </Box>
        ) : (
          <Box
            sx={ {
              position: 'absolute',
              top: '10%',
              left: '50%',
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              width: '100%',
            } }
          >
            <Typography
              variant="h3"
              color={ theme.palette.grey[800] }
            >
              Off
            </Typography>
            {
              power?.enabled && !isInAwayMode && (
                <Typography
                  sx={ { textWrap: 'nowrap' } }
                  color={ theme.palette.grey[800] }
                >
                  Turns on at { formattedTime }
                </Typography>
              )
            }
          </Box>
        )
      }
    </div>
  );
}
