import {
  ToggleButtonGroup,
  ToggleButton,
  Box,
  Tooltip,
} from '@mui/material';
import { useAppStore } from '@state/appStore.tsx';
import { useSettings } from '@api/settings.ts';
import { useDeviceStatus } from '@api/deviceStatus.ts';
import { usePresence, PresenceSide } from '@api/presence.ts';
import { formatTemperature } from '@lib/temperatureConversions.ts';

type SideControlProps = {
  showTemp?: boolean;
};

function presenceColor(side: PresenceSide | undefined): { color: string; label: string } {
  // Presence updates are event-driven (POSTed by biometrics only on transition),
  // so we trust whatever the last value was rather than treating older timestamps as stale.
  if (!side) return { color: '#6b7280', label: 'Presence unavailable' };
  return side.present
    ? { color: '#22c55e', label: 'Presence detected' }
    : { color: '#eab308', label: 'No presence' };
}

function PresenceDot({ side }: { side: PresenceSide | undefined }) {
  const { color, label } = presenceColor(side);
  return (
    <Tooltip title={ label }>
      <Box
        sx={ {
          width: 10,
          height: 10,
          borderRadius: '50%',
          backgroundColor: color,
          boxShadow: `0 0 6px ${color}`,
          ml: 0.75,
          flexShrink: 0,
        } }
      />
    </Tooltip>
  );
}

export default function SideControl({ showTemp }: SideControlProps) {
  const { side, setSide } = useAppStore();
  const { data: settings } = useSettings();
  const { data: deviceStatus } = useDeviceStatus();
  const { data: presence } = usePresence();

  const isCelsius = settings?.temperatureFormat === 'celsius';
  return (
    <ToggleButtonGroup
      color="primary"
      exclusive
      value={ side }
      onChange={ (event) => {
        // @ts-expect-error
        setSide(event.target.value);
      } }
      size="small"
    >
      <ToggleButton value="left" sx={ { p: 1 } }>
        { settings?.left?.name } &nbsp;
        { showTemp && side === 'right' && (

          deviceStatus?.left?.isOn ?

            formatTemperature(deviceStatus?.left?.targetTemperatureF, isCelsius)
            : 'Off'
        ) }
        <PresenceDot side={ presence?.left }/>
      </ToggleButton>
      <ToggleButton value="right">
        { settings?.right?.name } &nbsp;
        { showTemp && side === 'left' && (

          deviceStatus?.right?.isOn ?
            formatTemperature(deviceStatus?.right?.targetTemperatureF, isCelsius) : 'Off'

        ) }
        <PresenceDot side={ presence?.right }/>
      </ToggleButton>
    </ToggleButtonGroup>

  );
}
