import { Card, CardProps, Typography, Box } from '@mui/material';
import { sx } from './tokens';

type GlassCardProps = CardProps & {
  /** Optional uppercase section label rendered inside the card */
  label?: string;
  /** Optional element rendered to the right of the label (e.g., a chevron) */
  labelTrailing?: React.ReactNode;
};

export default function GlassCard({
  label,
  labelTrailing,
  children,
  sx: sxProp,
  ...rest
}: GlassCardProps) {
  return (
    <Card elevation={ 0 } { ...rest } sx={ { ...sx.glassCard, ...sxProp } }>
      { label && (
        <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 } }>
          <Typography sx={ { ...sx.sectionLabel, mb: 0 } }>{ label }</Typography>
          { labelTrailing }
        </Box>
      ) }
      { children }
    </Card>
  );
}
