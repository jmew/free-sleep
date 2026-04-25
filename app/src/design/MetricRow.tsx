import { Box, Typography } from '@mui/material';
import { palette, typography } from './tokens';

type StatusDotColor = 'green' | 'yellow' | 'orange' | 'red' | 'pink' | 'blue' | 'none';

const STATUS_COLORS: Record<StatusDotColor, string> = {
  green: palette.accent.green,
  yellow: palette.accent.yellow,
  orange: palette.accent.orange,
  red: palette.accent.red,
  pink: palette.accent.pink,
  blue: palette.accent.blue,
  none: 'transparent',
};

type MetricRowProps = {
  /** Bold label on the left, e.g. "Resting heart rate" */
  label: string;
  /** Big number on the right, e.g. "49 bpm" */
  value: React.ReactNode;
  /** Small dim sub-label under the value, e.g. "Below avg (51)" */
  valueSubtext?: string;
  /** Status indicator dot color (matches the 8 Sleep app pattern) */
  statusDot?: StatusDotColor;
  /** Optional row click handler — adds hover state */
  onClick?: () => void;
  /** Whether to render a top divider (use between rows in a list) */
  divider?: boolean;
};

export default function MetricRow({
  label,
  value,
  valueSubtext,
  statusDot = 'none',
  onClick,
  divider,
}: MetricRowProps) {
  return (
    <Box
      onClick={ onClick }
      sx={ {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        py: 1.75,
        borderTop: divider ? `1px solid ${palette.border.subtle}` : 'none',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background-color 0.15s ease',
        ...(onClick && {
          mx: -1,
          px: 1,
          borderRadius: 1,
          '&:hover': { backgroundColor: palette.bg.hover },
        }),
      } }
    >
      <Typography
        sx={ {
          fontSize: '1.05rem',
          fontWeight: 500,
          color: palette.text.primary,
          flex: 1,
          mr: 2,
        } }
      >
        { label }
      </Typography>
      <Box sx={ { textAlign: 'right' } }>
        <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.75 } }>
          <Typography
            sx={ {
              ...typography.metricValue,
              color: palette.text.primary,
            } }
          >
            { value }
          </Typography>
          { statusDot !== 'none' && (
            <Box
              sx={ {
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: STATUS_COLORS[statusDot],
              } }
            />
          ) }
        </Box>
        { valueSubtext && (
          <Typography sx={ { fontSize: '0.8rem', color: palette.text.tertiary, mt: 0.25 } }>
            { valueSubtext }
          </Typography>
        ) }
      </Box>
    </Box>
  );
}
