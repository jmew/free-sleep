// Shared "glass card" style used across the HomePage.
// Subtle dark glass with soft border, rounded corners, generous padding.
import { SxProps, Theme } from '@mui/material/styles';

export const glassCard: SxProps<Theme> = {
  width: '100%',
  borderRadius: 4,
  padding: 2.5,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
  border: '1px solid rgba(255,255,255,0.06)',
  boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 12px 24px -12px rgba(0,0,0,0.5)',
  backdropFilter: 'blur(20px)',
};

export const sectionLabel: SxProps<Theme> = {
  fontSize: '0.7rem',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  fontWeight: 600,
  color: 'rgba(255,255,255,0.45)',
  mb: 1,
};

export const heroNumber: SxProps<Theme> = {
  fontSize: '4rem',
  fontWeight: 200,
  lineHeight: 1,
  letterSpacing: '-0.03em',
};
