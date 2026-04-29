import { useEffect, useRef } from 'react';
import { CircularSliderWithChildren } from 'react-circular-slider-svg';
import { postDeviceStatus } from '@api/deviceStatus.ts';
import { useAppStore } from '@state/appStore';
import styles from './Slider.module.scss';
import TemperatureLabel from './TemperatureLabel.tsx';
import TemperatureButtons from './TemperatureButtons.tsx';
import { useControlTempStore } from './controlTempStore.tsx';
import { useTheme } from '@mui/material/styles';
import { useResizeDetector } from 'react-resize-detector';
import { useSettings } from '@api/settings.ts';
import { MAX_TEMP_F, MIN_TEMP_F, getTemperatureColor } from '@lib/temperatureConversions.ts';

type SliderProps = {
  isOn: boolean;
  currentTargetTemp: number;
  currentTemperatureF: number;
  refetch: any;
  displayCelsius: boolean;
}

export default function Slider({ isOn, currentTargetTemp, refetch, currentTemperatureF, displayCelsius }: SliderProps) {
  const { deviceStatus, setDeviceStatus, beginEdit, endEdit } = useControlTempStore();
  const { isUpdating, setIsUpdating, side } = useAppStore();
  const { data: settings } = useSettings();
  const isInAwayMode = settings?.[side].awayMode;
  const disabled = isUpdating || isInAwayMode || !isOn;
  const { width, ref } = useResizeDetector();
  const theme = useTheme();
  const sliderColor = getTemperatureColor(deviceStatus?.[side]?.targetTemperatureF);
  // Tracks whether this drag/click has already opened the edit gate. We open
  // it on the first onChange (or directly in handleControlFinished if the
  // user clicked without dragging) and close it once the POST settles.
  const dragOpenRef = useRef(false);

  const openGateIfClosed = () => {
    if (!dragOpenRef.current) {
      dragOpenRef.current = true;
      beginEdit();
    }
  };

  useEffect(() => {
    return () => {
      if (dragOpenRef.current) {
        dragOpenRef.current = false;
        endEdit();
      }
    };
  }, [endEdit]);

  const handleControlFinished = async () => {
    if (!deviceStatus) return;
    // Click without drag (no onChange fired) — still need to open the gate
    // so a stale WS push doesn't snap the value back during the POST.
    openGateIfClosed();

    setIsUpdating(true);
    void postDeviceStatus({
      [side]: {
        targetTemperatureF: deviceStatus[side].targetTemperatureF
      }
    })
      .then(() => {
        // Wait 1 second before refreshing the device status
        return new Promise((resolve) => setTimeout(resolve, 1_500));
      })
      .then(() => {
        if (dragOpenRef.current) {
          dragOpenRef.current = false;
          endEdit();
        }
        return refetch();
      })
      .catch(error => {
        if (dragOpenRef.current) {
          dragOpenRef.current = false;
          endEdit();
        }
        console.error(error);
      })
      .finally(() => {
        setIsUpdating(false);
      });
  };

  const arcBackgroundColor = theme.palette.grey[700];

  const sideStatus = deviceStatus?.[side];
  const minTemp = Math.min(sideStatus?.currentTemperatureF || 55, sideStatus?.targetTemperatureF || 55);
  const maxTemp = Math.max(sideStatus?.currentTemperatureF || 55, sideStatus?.targetTemperatureF || 55);
  const isHeating = (sideStatus?.currentTemperatureF ?? 55) < (sideStatus?.targetTemperatureF ?? 55);

  return (
    <div
      ref={ ref }
      style={ { position: 'relative', display: 'inline-block', width: '100%', maxWidth: '400px' } }
    >
      { /* Circular Slider */ }
      <div className={ `${styles.Slider} ${disabled && styles.Disabled} ${isHeating && styles.Heating}` }>
        <CircularSliderWithChildren
          disabled={ disabled }
          onControlFinished={ handleControlFinished }
          size={ width }
          trackWidth={ 6 }
          minValue={ MIN_TEMP_F }
          maxValue={ MAX_TEMP_F }
          startAngle={ 60 }
          endAngle={ 300 }
          angleType={ {
            direction: 'cw',
            axis: '-y'
          } }
          handle1={ {
            value: minTemp,
            onChange: (value) => {
              if (disabled) return;
              if (Math.round(value) !== deviceStatus?.[side]?.targetTemperatureF) {
                openGateIfClosed();
                setDeviceStatus({ [side]: { targetTemperatureF: Math.round(value) } });
              }
            },

          } }
          arcColor={ isOn ? sliderColor : arcBackgroundColor }
          arcBackgroundColor={ arcBackgroundColor }
          handle2={ {
            value: maxTemp,
            onChange: (value) => {
              if (disabled) return;
              if (Math.round(value) !== deviceStatus?.[side]?.targetTemperatureF) {
                openGateIfClosed();
                setDeviceStatus({ [side]: { targetTemperatureF: Math.round(value) } });
              }
            },
          } }
          handleSize={ 8 }
        >
          <TemperatureLabel
            isOn={ isOn }
            sliderTemp={ deviceStatus?.[side]?.targetTemperatureF || 55 }
            sliderColor={ sliderColor }
            currentTargetTemp={ currentTargetTemp }
            currentTemperatureF={ currentTemperatureF }
            displayCelsius={ displayCelsius }
          />
        </CircularSliderWithChildren>
      </div>
      {
        isOn && (
          <TemperatureButtons refetch={ refetch } currentTargetTemp={ currentTargetTemp }/>
        ) }
    </div>
  );
};
