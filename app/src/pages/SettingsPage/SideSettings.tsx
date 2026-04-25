import Switch from '@mui/material/Switch';
import { Box, TextField, Typography } from '@mui/material';
import { DeepPartial } from 'ts-essentials';
import { useEffect, useState } from 'react';

import { Settings } from '@api/settingsSchema.ts';
import { Side, useAppStore } from '@state/appStore.tsx';
import { palette } from '@design/tokens';

type AwayModeSwitchProps = {
  side: Side;
  settings?: Settings;
  updateSettings: (settings: DeepPartial<Settings>) => void;
}

export default function SideSettings({ side, settings, updateSettings }: AwayModeSwitchProps) {
  const { isUpdating } = useAppStore();
  const sideTitle = side.charAt(0).toUpperCase() + side.slice(1);

  const [sideName, setSideName] = useState(settings?.[side]?.name || '');
  useEffect(() => {
    setSideName(settings?.[side]?.name || side);
  }, [settings, side]);

  const handleBlur = () => {
    if (sideName.trim().length === 0) return;
    if (sideName.trim() !== settings?.[side]?.name) {
      updateSettings({ [side]: { name: sideName.trim() } });
    }
  };

  return (
    <Box sx={ { display: 'flex', flexDirection: 'column', gap: 1.5 } }>
      <Typography
        sx={ {
          fontSize: '0.7rem',
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: palette.text.tertiary,
        } }
      >
        { sideTitle } side
      </Typography>
      <TextField
        label="Name"
        placeholder="Enter side name"
        value={ sideName }
        onChange={ (e) => setSideName(e.target.value) }
        onBlur={ handleBlur }
        disabled={ isUpdating }
        size="small"
        inputProps={ { maxLength: 20 } }
        fullWidth
      />
      <Box
        sx={ {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          py: 0.5,
        } }
      >
        <Typography sx={ { fontSize: '1rem', color: palette.text.primary } }>Away mode</Typography>
        <Switch
          disabled={ isUpdating }
          checked={ settings?.[side]?.awayMode || false }
          onChange={ (event) => updateSettings({ [side]: { awayMode: event.target.checked } }) }
        />
      </Box>
    </Box>
  );
}
