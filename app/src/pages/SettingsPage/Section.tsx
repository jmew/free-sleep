import { PropsWithChildren } from 'react';
import { Typography } from '@mui/material';
import GlassCard from '@design/GlassCard';
import { palette } from '@design/tokens';

type SectionProps = PropsWithChildren<{
  title?: string;
}>;

export default function Section({ title, children }: SectionProps) {
  return (
    <GlassCard>
      { title && (
        <Typography
          sx={ {
            fontSize: '1.25rem',
            fontWeight: 600,
            color: palette.text.primary,
            mb: 2,
            letterSpacing: '-0.01em',
          } }
        >
          { title }
        </Typography>
      ) }
      { children }
    </GlassCard>
  );
}
