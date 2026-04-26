import { useEffect, useState } from 'react';
import moment from 'moment-timezone';
import {
  ToggleButtonGroup,
  ToggleButton,
  Box,
  ClickAwayListener,
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

function presenceColor(side: PresenceSide | undefined): string {
  if (!side) return '#6b7280';
  return side.present ? '#22c55e' : '#eab308';
}

// "5h 12m", "47m", "30s" — coarse human-readable duration.
function formatDuration(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  const remMin = min % 60;
  return remMin > 0 ? `${hr}h ${remMin}m` : `${hr}h`;
}

function presenceLabel(side: PresenceSide | undefined): string {
  if (!side) return 'Presence unavailable';
  if (!side.lastUpdatedAt) {
    return side.present ? 'Presence detected' : 'No presence';
  }
  const elapsed = Date.now() - moment(side.lastUpdatedAt).valueOf();
  const dur = formatDuration(elapsed);
  return side.present ? `In bed for ${dur}` : `No presence for ${dur}`;
}

function PresenceDot({ side }: { side: PresenceSide | undefined }) {
  const color = presenceColor(side);
  // Tap-to-show on mobile: MUI's tooltip opens on focus/hover but not on a
  // plain tap, so we manage `open` ourselves and dismiss with ClickAwayListener.
  const [open, setOpen] = useState(false);
  // Refresh the duration label once a minute so the tooltip stays accurate
  // when it stays open or gets re-opened.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <ClickAwayListener onClickAway={ () => setOpen(false) }>
      <Tooltip
        title={ presenceLabel(side) }
        open={ open }
        onClose={ () => setOpen(false) }
        disableFocusListener
        disableTouchListener
        leaveDelay={ 100 }
      >
        <Box
          onMouseEnter={ () => setOpen(true) }
          onMouseLeave={ () => setOpen(false) }
          onClick={ (e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          } }
          sx={ {
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: color,
            boxShadow: `0 0 6px ${color}`,
            ml: 0.75,
            flexShrink: 0,
            cursor: 'pointer',
          } }
        />
      </Tooltip>
    </ClickAwayListener>
  );
}

export default function SideControl({ showTemp }: SideControlProps) {
  const { side, setSide } = useAppStore();
  const { data: settings } = useSettings();
  const { data: deviceStatus } = useDeviceStatus();
  const { data: presence } = usePresence();

  // Temperature display is permanently in -10..+10 level mode now that the
  // user-facing format selector has been removed.
  const isLevel = true;
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

            formatTemperature(deviceStatus?.left?.targetTemperatureF, isLevel)
            : 'Off'
        ) }
        <PresenceDot side={ presence?.left }/>
      </ToggleButton>
      <ToggleButton value="right">
        { settings?.right?.name } &nbsp;
        { showTemp && side === 'left' && (

          deviceStatus?.right?.isOn ?
            formatTemperature(deviceStatus?.right?.targetTemperatureF, isLevel) : 'Off'

        ) }
        <PresenceDot side={ presence?.right }/>
      </ToggleButton>
    </ToggleButtonGroup>

  );
}
