import { Box, Typography } from '@mui/material';
import GlassCard from './GlassCard';
import { palette, typography } from './tokens';

type Stat = {
  /** Tiny uppercase tracked label, e.g. "TODAY" or "AT REST" */
  label: string;
  /** Big number with unit, e.g. "48 ms" or "52 bpm" or "1h 20m" */
  value: React.ReactNode;
  /** Optional color override for the value (defaults to white) */
  color?: string;
};

type MetricChartCardProps = {
  /** Optional metric name shown as the card title (e.g. "Heart rate"). */
  title?: string;
  /** 1–4 stat blocks shown horizontally across the top of the card. */
  stats: Stat[];
  /** Chart content rendered below the header. */
  children: React.ReactNode;
};

/**
 * Reusable card that matches the 8 Sleep-style layout used by every metric
 * chart on the Sleep page: a row of "section label / big number" pairs along
 * the top, then a chart filling the rest of the card.
 *
 * Examples of how the screenshots use this:
 *   stats=[{ label: "AT REST", value: "52 bpm" }, { label: "YOUR RANGE", value: "51–55 bpm" }]
 *   stats=[{ label: "TODAY", value: "48 ms" }, { label: "7-DAY AVERAGE", value: "46 ms" }]
 *   stats=[{ label: "DEEP SLEEP", value: "1h 20m" }, { label: "REM", value: "1h 11m" }]
 */
export default function MetricChartCard({ title, stats, children }: MetricChartCardProps) {
  return (
    <GlassCard sx={ { p: 2.5 } }>
      { title && (
        <Typography
          sx={ {
            ...typography.sectionLabel,
            color: palette.text.tertiary,
            mb: 1.5,
          } }
        >
          { title }
        </Typography>
      ) }
      <Box sx={ { display: 'flex', gap: { xs: 2.5, sm: 4 }, mb: 2.5, flexWrap: 'wrap' } }>
        { stats.map((s, i) => (
          <Box key={ i } sx={ { minWidth: 0 } }>
            <Typography
              sx={ {
                ...typography.sectionLabel,
                color: palette.text.tertiary,
                mb: 0.5,
              } }
            >
              { s.label }
            </Typography>
            <Typography
              sx={ {
                fontSize: { xs: '1.5rem', sm: '2rem' },
                fontWeight: 500,
                lineHeight: 1.05,
                letterSpacing: '-0.02em',
                color: s.color || palette.text.primary,
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
              } }
            >
              { s.value }
            </Typography>
          </Box>
        )) }
      </Box>
      { children }
    </GlassCard>
  );
}
