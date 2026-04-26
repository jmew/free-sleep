// Design tokens — single source of truth for the new visual language.
// Inspired by Apple Home + the latest 8 Sleep app design (per shared screenshots).
//
// Use semantic names where possible so we can tweak the underlying palette
// without grepping every component.

export const palette = {
  bg: {
    base: '#000000',
    elevated: 'rgba(255,255,255,0.04)',
    hover: 'rgba(255,255,255,0.08)',
  },
  border: {
    subtle: 'rgba(255,255,255,0.06)',
    medium: 'rgba(255,255,255,0.12)',
  },
  text: {
    primary: 'rgba(255,255,255,0.95)',
    secondary: 'rgba(255,255,255,0.65)',
    tertiary: 'rgba(255,255,255,0.45)',
    disabled: 'rgba(255,255,255,0.25)',
  },
  // Apple system colors — proven to feel right on dark.
  accent: {
    blue: '#0a84ff',
    green: '#30d158',
    yellow: '#ffd60a',
    orange: '#ff9500',
    red: '#ff453a',
    pink: '#ff375f',
    purple: '#bf5af2',
  },
  // Sleep score color ramp (kept distinct from system colors so it stays consistent
  // with the SleepScoreCard).
  score: {
    excellent: '#22c55e',
    good: '#84cc16',
    fair: '#eab308',
    poor: '#f97316',
    veryPoor: '#ef4444',
  },
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,    // primary card radius
  xxl: 24,
  pill: 9999,
};

export const space = {
  // Numeric values for direct sx usage (multiplies of MUI's 8px base).
  // sx={{ p: space.cardPadding }} etc.
  cardPadding: 2.5,    // 20px
  cardGap: 2,          // 16px
  sectionGap: 3,       // 24px
  inlineGap: 1,        // 8px
};

export const typography = {
  hero: {
    fontSize: '4.5rem',
    fontWeight: 200,
    lineHeight: 1,
    letterSpacing: '-0.03em',
  },
  largeTitle: {
    fontSize: '2rem',
    fontWeight: 600,
    letterSpacing: '-0.02em',
    lineHeight: 1.15,
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: 600,
    letterSpacing: '-0.01em',
  },
  metricValue: {
    fontSize: '1.5rem',
    fontWeight: 500,
    fontVariantNumeric: 'tabular-nums',
  },
  body: {
    fontSize: '1rem',
    fontWeight: 400,
  },
  caption: {
    fontSize: '0.85rem',
    fontWeight: 400,
  },
  sectionLabel: {
    // Apple Home / 8 Sleep section header style.
    fontSize: '0.7rem',
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
  },
};

// Shared sx blocks — drop-in style snippets.
export const sx = {
  glassCard: {
    width: '100%',
    borderRadius: `${radius.xl}px`,
    p: space.cardPadding,
    background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
    border: `1px solid ${palette.border.subtle}`,
    boxShadow:
      '0 1px 0 rgba(255,255,255,0.04) inset, 0 12px 24px -12px rgba(0,0,0,0.5)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    overflowWrap: 'break-word' as const,
    wordBreak: 'break-word' as const,
  },
  // Glass aesthetic for an MUI Accordion. Drops the default divider, rounds
  // the corners, and applies the same gradient/border/shadow as a GlassCard
  // so accordion sections on the Schedules page visually match the Sleep
  // page's cards while keeping their collapse/expand behaviour.
  glassAccordion: {
    width: '100%',
    borderRadius: `${radius.xl}px`,
    background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
    border: `1px solid ${palette.border.subtle}`,
    boxShadow:
      '0 1px 0 rgba(255,255,255,0.04) inset, 0 12px 24px -12px rgba(0,0,0,0.5)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    '&:before': { display: 'none' },
    '&.Mui-expanded': { margin: 0 },
    '& .MuiAccordionSummary-root': {
      borderRadius: `${radius.xl}px`,
      px: space.cardPadding,
    },
    '& .MuiAccordionDetails-root': {
      px: space.cardPadding,
      pb: space.cardPadding,
    },
  },
  sectionLabel: {
    ...typography.sectionLabel,
    color: palette.text.tertiary,
    mb: 1.5,
  },
  rowDivider: {
    borderTop: `1px solid ${palette.border.subtle}`,
  },
};
