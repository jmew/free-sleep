import { useRef, useCallback, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import { Button, Box } from '@mui/material';
import { Add, Remove } from '@mui/icons-material';
import { useControlTempStore } from './controlTempStore.tsx';
import { useAppStore } from '@state/appStore.tsx';
import { postDeviceStatus } from '@api/deviceStatus.ts';
import { useSettings } from '@api/settings.ts';
import {
  MIN_TEMP_F,
  MAX_TEMP_F,
  fahrenheitToLevel,
  levelToFahrenheit,
} from '@lib/temperatureConversions.ts';

type TemperatureButtonsProps = {
  refetch: any;
  currentTargetTemp: number;
}

const DEBOUNCE_MS = 400;
export default function TemperatureButtons({ refetch, currentTargetTemp }: TemperatureButtonsProps) {
  const { side, setIsUpdating, isUpdating } = useAppStore();
  const { deviceStatus, setDeviceStatus, beginEdit, endEdit } = useControlTempStore();
  const { data: settings } = useSettings();
  const theme = useTheme();
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks whether the current debounced burst has incremented the edit
  // counter. We open the gate on the first tap of a burst and close it once
  // the POST settles, so server pushes can't clobber the optimistic value.
  const editOpenRef = useRef(false);

  const postUpdate = useCallback(async () => {
    setIsUpdating(true);
    try {
      await postDeviceStatus({
        [side]: { targetTemperatureF: deviceStatus?.[side]?.targetTemperatureF },
      });
      await new Promise(r => setTimeout(r, 1_500));
      // Drop the edit gate before refetch so the canonical server response
      // (which now reflects our write) is allowed into the cache.
      if (editOpenRef.current) {
        editOpenRef.current = false;
        endEdit();
      }
      await refetch?.();
    } catch (err) {
      if (editOpenRef.current) {
        editOpenRef.current = false;
        endEdit();
      }
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  }, [deviceStatus, side, refetch, setIsUpdating, endEdit]);

  const scheduleUpdate = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(postUpdate, DEBOUNCE_MS);
  }, [postUpdate]);

  // If the user navigates away mid-burst, release the edit gate so the
  // counter doesn't leak.
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (editOpenRef.current) {
        editOpenRef.current = false;
        endEdit();
      }
    };
  }, [endEdit]);


  const isInAwayMode = settings?.[side].awayMode;
  if (isInAwayMode) return null;

  const disabled = isUpdating || isInAwayMode;
  const borderColor = theme.palette.grey[800];
  const iconColor = theme.palette.grey[500];

  // When the user is viewing in 'level' mode (-10..+10), one click should change
  // the displayed level by 1 — which is 2.75°F under the hood (since the scale
  // spans 55..110°F = 55°F over 20 levels). We snap the new value to the nearest
  // integer level so successive clicks stay on integer levels.
  // Always level mode (-10..+10); the F selector was removed.
  const isLevel = true;
  void settings;
  const handleClick = (direction: 1 | -1) => {
    if (!deviceStatus) return;
    const currentF = deviceStatus[side].targetTemperatureF;
    const nextF = isLevel
      ? levelToFahrenheit(fahrenheitToLevel(currentF) + direction)
      : currentF + direction;
    if (!editOpenRef.current) {
      editOpenRef.current = true;
      beginEdit();
    }
    setDeviceStatus({
      [side]: { targetTemperatureF: nextF },
    });
    scheduleUpdate();
  };

  const buttonStyle = {
    borderWidth: '2px',
    borderColor,
    width: 50,
    height: 50,
    borderRadius: '50%',
    minWidth: 0,
    padding: 0,
  };

  return (
    <Box
      sx={ {
        top: '75%',
        position: 'absolute',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '100px',
        width: '100%',
        marginLeft: 'auto',
        marginRight: 'auto',
      } }
    >
      <Button
        variant="outlined"
        color="primary"
        sx={ buttonStyle }
        onClick={ () => handleClick(-1) }
        disabled={ disabled || currentTargetTemp <= MIN_TEMP_F }
      >
        <Remove sx={ { color: iconColor } }/>
      </Button>
      <Button
        variant="outlined"
        sx={ buttonStyle }

        onClick={ () => handleClick(1) }
        disabled={ disabled || currentTargetTemp >= MAX_TEMP_F }
      >
        <Add sx={ { color: iconColor } }/>
      </Button>
    </Box>
  );
}
