import { Box } from '@mui/material';
import { palette } from '@design/tokens';

export default function Divider() {
  return (
    <Box
      sx={ {
        width: '100%',
        height: '1px',
        backgroundColor: palette.border.subtle,
        my: 1,
      } }
    />
  );
}
